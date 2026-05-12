---
name: OI-001 + OI-002 — resolved
description: User chốt overwrite mode + hybrid finalize (auto on download + Admin unfinalize)
type: project
---

## OI-001 — Upload trùng date range: **OVERWRITE**

**Quyết định** (user, 2026-05-11): replace toàn bộ file + raw rows + derived metrics khi user upload lại cùng period.

**How to apply**:
- Trước khi delete: archive bản cũ vào S3 `archive/<ent_id>/<ups_id>/<timestamp>/` (NFR-06 raw file unmodified)
- Reset `sal_uploaded_files`, `sal_raw_*`, `sal_product_metrics`, `sal_platform_metrics`, `sal_reports` cho period đó
- Show warning dialog: "Data for {period} already exists. Overwrite? Old data will be archived but report needs recalc."
- Log action `UPLOAD_OVERWRITE` (FR-20)

## OI-002 — "Finalized" definition: **D - Hybrid (Auto + Admin override)**

**Quyết định** (user, 2026-05-11): cần mở rộng và làm rõ.

**Behavior**:
- **Auto-finalize**: Khi user click Download lần đầu → `rep_finalized_at` set, snapshot lock
- **Admin unfinalize**: Chỉ role `ADMIN` mới có button "Re-open report" → set `rep_finalized_at = NULL`, log action `REPORT_UNFINALIZE`, có warning "Data will be recalculated with current Prime Cost / Formula Config"
- **Re-finalize**: Sau khi unfinalize, download tiếp → re-finalize với snapshot mới

**Implications**:
- `sal_reports` thêm cột `rep_finalize_count` để track số lần đã finalize
- `sal_reports` thêm cột `rep_last_unfinalized_by` + `rep_last_unfinalized_at` cho audit
- Activity Log action `REPORT_UNFINALIZE` → log immutable (NFR-13)

**Edge cases cần làm rõ thêm**:
- Nếu Admin unfinalize → snapshot Prime Cost version cũ có giữ lại không, hay xóa?
  - Đề xuất: GIỮ snapshot cũ trong `sal_product_metrics_history` table, để regen historical (NFR-09)
- Nếu unfinalize rồi không re-finalize, report đó status gì? `DRAFT` lại?
  - Đề xuất: status `REOPENED` riêng để phân biệt với `DRAFT` ban đầu
- Có giới hạn số lần unfinalize không (vd max 3)?
  - Đề xuất: unlimited nhưng cảnh báo khi > 5 lần → audit suspicious

**Why**: User chốt D. Lý do mở rộng: trong thực tế kế toán đôi khi phát hiện sai sót sau khi đã "khóa sổ", cần re-mở để sửa. Restrict ở Admin để tránh lạm dụng.

**How to apply**:
- Trong [DATA-MODEL.md](../../docs/architecture/DATA-MODEL.md) §7 `sal_reports` — thêm 3 cột mới
- Trong [INTEGRATION-amb.md](../../docs/architecture/INTEGRATION-amb.md) — Admin role mới có permission `report:unfinalize`
- UI: nút "Re-open" chỉ visible cho ADMIN, có confirm dialog 2 bước
