# FIX-260921 — Build staging thất bại do hết disk (ENOSPC)

## 1. Triệu chứng / Symptom
`bash platform/scripts/deploy-staging.sh build car-manager-v2` thất bại tại bước
`RUN npm ci --include=dev` (Dockerfile:34):

```
npm warn tar TAR_ENTRY_ERROR ENOSPC: no space left on device
failed to solve: process "/bin/sh -c npm ci --include=dev" did not complete successfully: exit code: 1
```

Triệu chứng dễ bị chẩn đoán nhầm thành OOM (box này 2 vCPU / 7.7GB vốn đã
chật khi build Next.js), nhưng nguyên nhân thật là **hết dung lượng đĩa**.

## 2. Phân tích nguyên nhân / Root Cause

`df -h /` tại thời điểm lỗi: **50G, dùng 50G, còn trống 901MB (99%)**.

`docker system df` cho thấy phần chiếm chỗ:

| Hạng mục | Dung lượng | Có thể thu hồi |
|----------|-----------|----------------|
| Build Cache (buildkit) | 20.59 GB | 20.59 GB (100%) |
| Images | 11.06 GB | 6.84 GB (61%) |
| systemd journal | 2.9 GB | ~2.6 GB |
| yum cache | 825 MB | 825 MB |
| Container json logs | 60 MB | 60 MB |

Nguyên nhân gốc — **không có cơ chế thu hồi nào được cấu hình**:

1. **Docker không bao giờ tự dọn build cache.** Mỗi lần deploy dùng
   `--no-cache` (do `deploy-staging.sh` quy định để tránh stale build args)
   sinh ra một lớp cache mới nhưng lớp cũ không bị xoá → tích luỹ tuyến tính
   theo số lần deploy cho tới khi đầy đĩa.
2. **Mỗi lần rebuild để lại một dangling image ~1.5GB** (image cũ mất tag khi
   tag `latest` trỏ sang image mới).
3. **`/etc/docker/daemon.json` không tồn tại** → container log mặc định không
   giới hạn kích thước, không xoay vòng.
4. **`journald.conf` để mặc định** → journal phình tới 2.9GB.

## 3. Nội dung khắc phục / Fix

### 3.1 Thu hồi ngay (one-off)
```bash
docker builder prune -af      # 29.15 GB
docker image prune -f         #  6.22 GB + 1.34 GB (lần 2)
journalctl --vacuum-size=200M #  2.60 GB
yum clean all                 #  0.83 GB
: > /var/lib/docker/containers/*/*-json.log   # 60 MB (truncate, không rm)
```
Kết quả: **99% → 44%** (còn trống 901MB → 29GB).

Lưu ý: dọn log dùng truncate (`: > file`) chứ không `rm`, vì `rm` sẽ làm
container đang chạy giữ file descriptor mồ côi → dung lượng không thực sự
được trả về cho tới khi container restart.

### 3.2 Phòng tái phát (cấu hình lâu dài)

**Docker log rotation** — tạo mới `/etc/docker/daemon.json`:
```json
{
  "log-driver": "json-file",
  "log-opts": { "max-size": "20m", "max-file": "3" }
}
```
⚠️ `log-opts` **không** áp dụng qua `SIGHUP` — cần `systemctl restart docker`
(sẽ bounce toàn bộ container) hoặc chờ container được tạo lại ở lần
`deploy-staging.sh restart` kế tiếp. Giới hạn trần: 20m × 3 file × 11 container
≈ 660MB.

**Giới hạn journal** — `/etc/systemd/journald.conf`:
```
[Journal]
SystemMaxUse=300M
```
Đã `systemctl restart systemd-journald`, có hiệu lực ngay.

**Dọn dẹp định kỳ** — thêm `platform/scripts/docker-maint.sh` (chạy hàng tuần,
chỉ xoá build cache >7 ngày + dangling image, không đụng container/volume đang
chạy). Cần cài đặt thủ công một lần:
```bash
sudo install -m 755 platform/scripts/docker-maint.sh /usr/local/bin/docker-maint.sh
echo '0 3 * * 0 root /usr/local/bin/docker-maint.sh' | sudo tee /etc/cron.d/docker-maint
```

## 4. Danh sách file thay đổi / Changed Files

| File | Loại | Ghi chú |
|------|------|---------|
| `platform/scripts/docker-maint.sh` | Mới | Script dọn dẹp định kỳ |
| `docs/bug-fix/FIX-260921-staging-build-enospc.md` | Mới | Tài liệu này |
| `/etc/docker/daemon.json` | Mới (ngoài repo) | Log rotation — **cần restart docker** |
| `/etc/systemd/journald.conf` | Sửa (ngoài repo) | `SystemMaxUse=300M` |

## 5. Mẫu phòng ngừa tái phát / Prevention Pattern

- **Trước mỗi lần build, kiểm tra đĩa chứ không chỉ RAM**: `df -h /`. Dưới 5GB
  trống thì chạy `docker builder prune -af` trước.
- **ENOSPC trong `npm ci` là lỗi đĩa, không phải lỗi dependency.** Không đi
  sửa `package-lock.json` khi gặp thông báo này.
- **RAM vẫn phải xử lý riêng**: box 7.7GB cần dừng `tei-hscode` (chiếm 3.5GB)
  trước khi build Next.js — xem quy trình hiện hành.

## 6. Số liệu đo được sau tối ưu / Measured Results

Chạy lại build sạch (`--no-cache`) toàn bộ code mới để kiểm chứng:

| Chỉ số | Giá trị đo |
|--------|-----------|
| Kết quả build | ✅ Thành công (exit 0) |
| RAM thấp nhất trong suốt build | **3214 MB còn trống** |
| Disk trống trước build | 29 GB |
| Disk trống sau build | 23 GB |
| **Chi phí đĩa cho 1 lần build no-cache** | **~6 GB** |
| Disk sau khi prune | 32 GB trống (38%) |

Hai kết luận quan trọng:

1. **RAM chưa bao giờ là nút thắt thật** — sau khi dừng `tei-hscode`, mức thấp
   nhất vẫn còn 3.2GB dư. Nguyên nhân duy nhất làm build chết là đĩa.
2. **Mỗi lần build no-cache tốn ~6GB đĩa.** Với 32GB trống hiện tại, còn dư
   khoảng 5 lần build trước khi cần dọn lại → đó chính là lý do phải có
   `docker-maint.sh` chạy định kỳ, không thể dọn thủ công theo trí nhớ.

## 7. Việc còn lại cần người thực hiện / Manual Follow-up

| # | Việc | Lệnh | Vì sao chưa làm |
|---|------|------|-----------------|
| 1 | Kích hoạt log rotation | `sudo systemctl restart docker` | Sẽ restart toàn bộ 11 container — cần chọn thời điểm |
| 2 | Cài cron dọn dẹp hàng tuần | xem mục 3.2 | Cần quyền ghi `/etc/cron.d` |

Cho tới khi (1) được chạy, container hiện tại vẫn có `LogConfig.Config = {}`
(không giới hạn). File `daemon.json` đã sẵn sàng, chỉ chờ daemon restart.
