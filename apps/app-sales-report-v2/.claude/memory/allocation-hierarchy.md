---
name: Allocation hierarchy — 2 cấp GMV + NMV
description: Booking Fee chia 2 platform theo GMV trước, sau đó từng platform chia SKU theo NMV. Free Gift treatment đặc biệt.
type: project
---

**Phát hiện từ file thật** (`BOOKING FEE.csv` ngày 2026-05-11):

### Allocation hierarchy

```
Total Booking Fee: 51,700,000 VND (manual input)
       ├── Shopee (73.32% GMV contribution): 37,907,072
       │      └── chia per SKU theo NMV contribution
       └── TikTok (26.68% GMV contribution): 13,792,928
              └── chia per SKU theo NMV contribution
```

→ **2 cấp allocation**:
1. **Cross-platform**: chia theo **GMV** contribution
2. **Within platform**: chia theo **NMV** contribution per SKU

### Applies to metrics

| Metric | Cấp 1 (cross-platform) | Cấp 2 (per SKU) |
|---|---|---|
| Total Affiliate Booking Fee | GMV split | NMV contribution |
| (Other manual single-input cross-platform metrics) | GMV split | NMV contribution |
| Shopee-only manual (Livestream) | N/A | NMV contribution |
| TikTok-only manual (Ad Spending, Livestream, Platform Fee) | N/A | NMV contribution |

### Free Gift treatment đặc biệt

Free Gift NOT allocated typical way. Quan sát từ `FINAL REPORT.csv`:
- Free Gift product riêng (vd `[GIFT] Combo 2 Wipes`) có **prime cost = 4,145,400** trong shopee
- Phân bổ về các SKU đã bán kèm theo NMV contribution
- SKU bán nhiều có CM âm rất lớn (vd `Bộ Muỗng Ăn Dặm Hai Giai Đoạn` CM = -2,544,258, Free Gift cost được tính 2,805,100)

→ Rule:
1. Identify Free Gift rows: `productName.startsWith('[GIFT]')` (CẢ Shopee và TikTok)
2. Sum tất cả Prime Cost của free gift rows = `Total Free Gift Cost`
3. Allocate `Total Free Gift Cost` về các SKU **không phải gift** theo NMV contribution → mỗi SKU có 1 cột `Free Gift` (cost)
4. Khi tính `Total Prime Cost` platform-level: ADD free gift cost vào (không exclude)
5. Khi tính CM line-level: subtract `Free Gift` (allocated portion)

**Why**: SRD ghi rule này nhưng không rõ chi tiết — file thật làm rõ allocation method.

**How to apply**:
- Update [cm-calculator skill §6](../../.claude/skills/cm-calculator/SKILL.md) với 2 cấp allocation
- DATA-MODEL.md `sal_product_metrics.prm_free_gift_vnd` = allocated portion (not original cost)
- Test case bắt buộc: SKU bán nhiều (X) cộng với SKU `[GIFT]` (Y) → Y prime cost được allocate về X
