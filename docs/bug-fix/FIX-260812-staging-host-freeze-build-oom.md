# FIX-260812 — car-manager-v2 빌드 중 호스트 전체 프리즈 (RAM 고갈 + swap 없음)

- **날짜 / Date**: 2026-08-12
- **대상 / Scope**: 인프라 (호스트 apps.amoeba.site 박스 전체, 특정 앱 코드 아님)
- **호스트 / Host**: `ip-172-31-1-41.ap-southeast-1` — **2 vCPU / 7.7GB RAM / 50GB disk**
- **트리거 / Trigger**: `deploy-staging.sh build car-manager-v2`

## 1. 증상 / Symptom
`app-car-manager-v2` Docker 빌드 도중 **호스트가 2회 응답 불능**. SSH 접속 불가 → 강제 재부팅으로만 복구.

`last -x reboot` 기준 당일 재부팅 2회: **06:05**, **06:35**.

빌드가 실패하는 것이 아니라 **머신 자체가 멈춘다**는 점이 핵심 — 로그도 남지 않아 원인 파악이 어려웠다.

## 2. 원인 분석 / Root Cause
**RAM 고갈 + swap 0 → 커널 thrashing → OOM killer가 로그를 남기기도 전에 시스템 정지.**

근거 체인:
1. `journalctl -b -1` 마지막 줄이 06:29:37에서 **shutdown 시퀀스 없이 끊김** → 정상 종료가 아닌 **하드 프리즈**. (참고: `-b -2`는 06:05:34에 정상 poweroff 로그가 있음 → 이쪽은 수동 재부팅.)
2. `dmesg`/`journalctl`에 `oom-kill` 흔적 **없음**. swap이 0인 상태에서 메모리가 고갈되면 커널이 디스크 thrashing에 빠져 저널 flush 자체가 불가 → 로그가 유실된다. 로그 부재가 곧 증상.
3. 측정값 (본 수정 후 watchdog으로 5초 간격 샘플링, `--no-cache` 빌드 10분):
   - `next build` 구간 **호스트 RAM 피크 = 4.36GB** (07:02, "Creating an optimized production build" 단계).
   - `tei-hscode`(HS Code text-embeddings 추론 서버) 상주 **~3.5GB** = 호스트 RAM의 45.6%.
   - **4.36 + 3.5 ≈ 7.9GB > 7.7GB (총 RAM)** → 약 200MB 초과. swap이 없어 이 200MB 초과가 그대로 프리즈로 이어졌다.
4. 가중 요인:
   - `deploy-staging.sh` `build_app()`이 **`--no-cache`**로 빌드 → 매 배포마다 `npm ci` 전체 재실행(가장 무거운 경로) + 빌드 캐시 누적(발견 시 5.3GB).
   - 이 박스는 ambAppStore 외에 **Laravel 앱 2개**(`/var/www/html/memories`, `memories_dev`)와 분당 cron, php-fpm 5개 프로세스를 함께 돌린다.
   - Dockerfile builder 스테이지에 **heap 상한이 없어** V8이 호스트 메모리를 소진할 때까지 성장.

## 3. 수정 내용 / Fix
### 3.1 호스트 (영구)
- **swapfile 4GB 생성**: `/swapfile` (dd → mkswap → swapon), `/etc/fstab`에 등록하여 재부팅 후에도 유지.
- **`vm.swappiness=10`, `vm.vfs_cache_pressure=50`**: `/etc/sysctl.d/99-swap-tuning.conf`. RAM 우선 사용, 진짜 부족할 때만 swap.
- **빌드 캐시 정리**: `sudo docker builder prune -f` → disk 22GB → **16GB** 사용 (약 6GB 회수, 여유 35GB).

### 3.2 앱 (Dockerfile)
- `apps/app-car-manager-v2/Dockerfile` builder 스테이지에 **`ENV NODE_OPTIONS=--max-old-space-size=2048`** 추가.
  Node 내부 heap 한계로 GC를 유도 → 최악의 경우 **"heap out of memory"로 빌드가 실패**(복구 가능)하고, 호스트 프리즈(복구 불가)로 가지 않는다.

### 3.3 빌드 절차 (운영 수칙)
1. `sudo docker stop tei-hscode` — RAM available 2.4GB → **5.9GB**
2. 빌드 실행 (+ RAM watchdog 동반, §3.4)
3. `sudo docker start tei-hscode`

이 순서로 실제 빌드 성공: **06:55:07 → 07:05:12, exit 0**, 피크 4.36GB, swap 사용 16MB(거의 미사용), 최소 여유 3.48GB.

### 3.4 RAM watchdog
빌드와 함께 5초 간격으로 `MemAvailable`/`SwapFree`를 샘플링하고, **`MemAvailable < 250MB` AND `SwapFree < 512MB`**이면 BuildKit 세션을 취소한다. 실패한 빌드는 복구 가능하지만 멈춘 호스트는 아니다 — 이 트레이드오프가 watchdog의 존재 이유.

구현 시 주의: 빌드는 `sudo` 하위(root 소유)라 `kill -0 <pid>`가 ec2-user에서 **EPERM**을 반환해 루프가 즉시 종료된다. 생존 확인은 **`[ -d /proc/<pid> ]`**로 할 것.

## 4. 변경 파일 목록 / Changed Files
| 구분 | 파일 | 변경 |
|------|------|------|
| Host | `/swapfile` | 신규 4GB |
| Host | `/etc/fstab` | `/swapfile none swap sw 0 0` 추가 |
| Host | `/etc/sysctl.d/99-swap-tuning.conf` | 신규 (swappiness=10) |
| Docker | `apps/app-car-manager-v2/Dockerfile` | builder 스테이지 `ENV NODE_OPTIONS` 추가 |

## 5. 검증 / Verification
| 항목 | 수정 전 | 수정 후 |
|------|--------|--------|
| swap | 0B | **4.0GB** (fstab 등록, 재부팅 유지) |
| disk 사용 | 22GB / 50GB (43%) | **16GB (31%)** |
| 빌드 결과 | 호스트 프리즈 ×2 | **exit 0, 10분** |
| RAM 피크 | (측정 불가 — 프리즈) | **4.36GB**, 최소 여유 3.48GB |
| swap 사용량 | — | 16MB (안전망으로만 존재) |

## 6. 재발 방지 패턴 / Prevention
1. **이 박스에서 Next.js 빌드 전 `tei-hscode`를 반드시 정지.** 측정된 합계가 총 RAM을 초과한다(4.36 + 3.5 > 7.7). swap이 있어 이제 프리즈까지는 가지 않지만, thrashing으로 빌드 시간이 크게 늘어난다.
2. **swap 없는 2 vCPU 박스에서 컨테이너 빌드 금지.** swap은 성능이 아니라 **복구 가능성**을 위한 장치다.
3. **로그 없는 정지 = 메모리 고갈 의심.** 부팅 로그가 shutdown 시퀀스 없이 끊겼는지(`journalctl -b -1 | tail`) 먼저 확인할 것. OOM 로그가 없다는 사실 자체가 단서.
4. **미해결 개선안 (별도 판단 필요)**:
   - `deploy-staging.sh`의 `--no-cache` 제거 검토. Dockerfile은 이미 레이어 캐싱에 맞게 설계(manifest 먼저 COPY, source 나중)되어 있어 `--no-cache`는 그 설계를 무력화한다. 빌드 시간·메모리·디스크 모두 개선 가능하나 **배포 스크립트 동작 변경이므로 미적용**.
   - `ec2-user`가 `docker` 그룹에 없음(`ambhscode`만 소속) → 모든 배포 명령에 `sudo` 필요. 루트 CLAUDE.md의 서술과 불일치. **미변경**.
   - `tei-hscode`에 `mem_limit` 설정 검토 (현재 무제한 상주 3.5GB).
   - `/var/mail/root`가 과대 성장해 postfix가 cron 메일을 계속 bounce 중. 본 이슈와 무관하나 I/O 노이즈.
