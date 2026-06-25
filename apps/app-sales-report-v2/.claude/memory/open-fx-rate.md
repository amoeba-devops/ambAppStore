---
name: FX rate — VND/KRW
description: Tỷ giá VND/KRW default 17.543 (VND per 1 KRW), configurable trong app. Resolved bởi SRD v2.0 §Group 6.
type: project
---

**Resolved** (từ SRD v2.0 §Group 6 param "Default Exchange rate" = 17.543, type Number):

- **Default rate**: 17.543 VND per 1 KRW
- **Unit direction**: VND per KRW (mẫu số) — UI label "Exchange Rate (1 KRW = ? VND)"
- **Formula**: `KRW_value = VND_value / 17.543`
- **Configurable**: Operator có thể đổi rate per session qua manual input UI (FR-04 AC-02). Admin có thể set default mới qua Formula Configuration (FR-23 Group 6).
- **Effect**: đổi rate trigger recalc toàn bộ KRW display values (FR-04 AC-06).
- **Snapshot**: report finalized lưu `rep_fx_rate_snapshot` → không bị ảnh hưởng nếu rate đổi sau.

**Why** (2026-05-11): SRD chốt số 17.543 và behavior. Trước đó PRD ban đầu ghi 0.057 KRW per VND (= 1/17.5 ≈ inverse), gây confused — KRW per VND vs VND per KRW. SRD rõ ràng: 17.543 = VND per 1 KRW.

**How to apply**:
- DB column: `sal_fx_rates.fxr_vnd_per_krw DECIMAL(10,4)` default `17.5430` (precision đủ cho rate VND/KRW)
- KHÔNG hard-code 17.543 trong code — đọc từ DB (default global record với `ent_id = NULL`)
- Khi recalc do rate change: chỉ update KRW display, không recalc VND aggregates (NFR-08)
- Test case quan trọng: thay rate giữa kỳ → KRW old reports không đổi (đã snapshot)

**⚠️ Notation gotcha**: SRD client gửi ghi `17543` không có decimal — đây là VN locale (dấu `.` thường dùng cho thousand separator). Verify từ real data CSV: `1,682,035,200 VND / 95,876,006 KRW = 17.544`. Vì vậy rate chính xác là **17.543** (decimal), KHÔNG phải 17,543 (mười bảy nghìn). Sai notation gây lỗi 1000x.
