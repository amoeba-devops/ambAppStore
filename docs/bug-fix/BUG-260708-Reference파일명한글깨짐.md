# BUG-260708 — Reference 파일명 한글 깨짐 (multipart latin1 + macOS NFD)

- **작성일**: 2026-07-08
- **앱**: HS Code Manager (`/app-hscode`)
- **화면**: SCR-005 Reference (`/app-hscode/reference`) — import 배치 목록
- **증상**: 업로드 파일명의 한글이 mojibake로 표시
  ```
  BaoCaoHangChiTiet BOSUNG VINA áá©áá¥á¼ááµáá¡ áá®áá®á¯ááµá¸ ... _ 2025.4.28.xls
  (정상: BaoCaoHangChiTiet BOSUNG VINA 보성비나 수출입 기록 _ 2025.4.28.xls)
  ```

## 1. 원인

`ReferenceController.import()`가 `file.originalname`을 그대로 저장([reference.controller.ts:58](../../apps/app-hscode-manager/backend/src/domain/reference/controller/reference.controller.ts#L58) → `hsm_import_batches.imb_file_name`).

**multer/busboy는 multipart 파일명 헤더를 latin1로 디코드**한다. 따라서 UTF-8 한글 파일명이 깨진 문자열로 저장된다. 추가로 업로더가 **macOS(darwin)**라 파일명이 **NFD(한글 자모 분리, U+11xx)** 형태였고, U+11xx의 UTF-8 선행 바이트가 `0xE1`(=`á`)이라 정확히 `á…` 패턴의 mojibake가 발생한다.

검증(로컬 재현): NFD 한글 → UTF-8 bytes → latin1 문자열 = 관측된 `…VINA áá®á¼…`와 동일. 역변환 `Buffer.from(x,'latin1').toString('utf8').normalize('NFC')` → 원본 복구.

## 2. 수정

**신규** `backend/src/common/utils/multipart-filename.util.ts`:
```ts
export function decodeMultipartFilename(originalname: string): string {
  if (!originalname) return originalname;
  return Buffer.from(originalname, 'latin1').toString('utf8').normalize('NFC');
}
```
- latin1 바이트로 되돌려 UTF-8 재디코드 + NFC 정규화(macOS NFD 통합). ASCII 파일명은 멱등.

**수정** `reference.controller.ts`: `file.originalname` → `decodeMultipartFilename(file.originalname)`.

- 백엔드 전체 `originalname` 사용처는 이 1곳뿐(excel은 고정 출력명 사용 → 무관).
- `tsc --noEmit` 그린.

## 3. 기존 데이터 복구 (staging)

이미 깨져 저장된 행(1건)을 Postgres에서 복구:
```sql
UPDATE hsm_import_batches
SET imb_file_name = normalize(convert_from(convert_to(imb_file_name, 'LATIN1'), 'UTF8'), NFC)
WHERE imb_id='b155c7c0-12b4-439c-be14-3f4493a3ee3c';
-- → 'BaoCaoHangChiTiet BOSUNG VINA 보성비나 수출입 기록 _ 2025.4.28.xls'
```
(DB `db_hsm` / `postgres-hscode`. `convert_to(_,LATIN1)`은 코드포인트>0xFF행에서 실패하므로 깨진 행에만 적용.)

## 4. 배포 / 검증

- rsync 오버레이(변경 2파일) → `docker compose -f docker-compose.app-hscode.yml build bff-app-hscode` → `up -d --no-deps bff-app-hscode`.
- 실행 이미지에 `dist/common/utils/multipart-filename.util.js` 존재 확인, health 200.
- 기존 행 복구 확인 완료. 신규 업로드는 컨트롤러 수정으로 정상 저장.

## 5. 후속

- 코드 수정이 **git 미반영**(스테이징=rsync 드리프트). main 반영용 PR 권장(PR #93과 동일 방식).
- 다른 앱(car-manager 등)에도 파일 업로드+파일명 저장이 있으면 동일 `decodeMultipartFilename` 적용 검토.
