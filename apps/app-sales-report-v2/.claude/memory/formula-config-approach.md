---
name: Formula Configuration — DB-driven, no code change
description: 48 formula parameters trong DB, Admin edit qua UI, snapshot per report (NFR-07, NFR-08, FR-23)
type: project
---

**Quyết định**: 48 formula parameters (7 groups) lưu trong `sal_formula_configs` table. Admin edit qua UI, KHÔNG dùng code deploy.

**Why** (từ SRD v2.0 NFR-07, FR-23):
- Client business rules thay đổi theo thời gian (column header sàn đổi, fee structure đổi)
- KHÔNG cho phép code change cho mỗi thay đổi (slow, deploy required)
- Audit trail rõ ràng: ai đổi param nào khi nào (Activity Log)

**How to apply**:
- Mọi formula trong calculation engine PHẢI đọc param từ `sal_formula_configs` thông qua interpreter
- 4 types: `FIELD_MAP`, `CALCULATED`, `SELECT`, `NUMBER`
- `CALCULATED` là read-only (derived expression), `FIELD_MAP` populate options từ column header của uploaded file
- Mỗi report finalized snapshot toàn bộ config dùng vào `sal_reports.formula_config_snapshot JSONB` → regen historical đảm bảo cùng kết quả (NFR-09)
- **Cấm**: hard-code field name như `"SKU phân loại hàng"` trong parser/calc → phải qua config (xem skill excel-parser §3)
- Implementation pattern đề xuất: simple AST interpreter cho `CALCULATED` expressions (chỉ + − × ÷, sum, allocate by, lookup) — KHÔNG dùng `eval()`

**Trade-off**:
- Thêm complexity engine interpreter
- Bù lại: 0 code change cho thay đổi rule, audit perfect, regen exact match
- Nếu MVP gấp: hard-code Phase 1 + interpreter Phase 2, NHƯNG schema `sal_formula_configs` từ Phase 1 để không phải migrate sau
