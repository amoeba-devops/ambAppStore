# BUG-260731 — Lập báo cáo tháng lỗi `CAR-E0500` sau khi người dùng đổi ngôn ngữ

| | |
|---|---|
| **Ngày** | 2026-07-31 |
| **Phạm vi** | `i18n/request.ts` (toàn app) → báo cáo tháng 3 sheet (MONTHLY_SUMMARY) + template thông báo email/push |
| **Mức độ** | **Cao** — không lập được báo cáo tháng (chức năng chính), lỗi 100% với mọi user đã từng đổi ngôn ngữ |
| **Branch** | `staging-car-truck` |
| **Trạng thái** | ✅ Đã sửa (đã repro + verify trên local) |

> **Báo cáo của người dùng (2026-07-31)**: *"check tải báo cáo app truck bị lỗi hệ thống"*

---

## 1. Hiện tượng

`/truck/reports/new` → chọn tháng/khu vực → **Lập báo cáo** → modal lỗi:

```
CAR-E0500 — Lỗi hệ thống — vui lòng thử lại sau hoặc liên hệ quản trị viên
```

Không có file nào được tạo. Log server (đã repro nguyên văn trên local):

```
[action] Unexpected CAR-E0500 at 2026-07-31T06:52:50.012Z {
  message: 'Worksheet name already exists: Korean', name: 'Error', ...
}
Error: Worksheet name already exists: Korean
    at set name (exceljs/lib/doc/worksheet.js:170:13)
    at Workbook.addWorksheet (exceljs/lib/doc/workbook.js:89:23)
    at writeSummarySheet (src/server/lib/truck-monthly-summary-workbook.ts:181:19)
    at buildTruckMonthlySummaryWorkbook (…:161:9)
    at buildReportWorkbook (src/server/actions/truck-report.actions.ts:135:125)
```

**Điều kiện xảy ra** — giải thích vì sao test bằng curl trước đó không thấy lỗi:

| Trạng thái cookie `NEXT_LOCALE` | Kết quả |
|---|---|
| Chưa có (chưa bao giờ bấm đổi ngôn ngữ) | ✅ Chạy đúng, 3 sheet vi/en/ko |
| Có — **bất kể** `vi`, `en` hay `ko` | ❌ `CAR-E0500` |

Cookie chỉ do `setLocaleAction` (nút đổi ngôn ngữ ở sidebar / trang login / Cài đặt) ghi ra. Phiên curl mới
tinh không có cookie nên đi vào đúng nhánh chạy được; người dùng thật đã đổi ngôn ngữ nên luôn lỗi.

## 2. Nguyên nhân

Báo cáo tháng bản R1 (2026-07-31) là **1 file 3 sheet** — mỗi sheet 1 ngôn ngữ. Builder lấy text từng sheet
bằng `getTranslations({ locale, namespace })` với `locale` = `vi` / `en` / `ko`
([truck-report.actions.ts:91](../../apps/web/src/server/actions/truck-report.actions.ts)).

`getRequestConfig` trong `i18n/request.ts` xếp thứ tự ưu tiên **cookie trước**:

```ts
const candidate = cookieLocale ?? requested ?? '';   // ← lỗi
```

next-intl truyền locale được yêu cầu vào chính tham số `requestLocale`
(`getConfig.js`: `get requestLocale() { return localeOverride ? Promise.resolve(localeOverride) : … }`).
Đặt cookie lên trước nghĩa là **yêu cầu tường minh bị cookie đè**: cả 3 lần gọi đều nhận về message của
ngôn ngữ người dùng đang xem.

Hệ quả xâu chuỗi:

1. `t('sheetName')` trả **cùng một** giá trị 3 lần → `Korean`, `Korean`, `Korean`
2. ExcelJS chặn tab trùng tên bằng cách **throw** (`worksheet.js:169-171`, so sánh không phân biệt hoa/thường)
3. `generateOneTruckReport` bắt lỗi → soft-delete dòng vừa insert (đúng thiết kế: không để lại số chính thức
   mà không có file) → **throw lại**
4. `runAction` → `CAR-E0500` + message bị mask → UI hiện `errors.internal` = "Lỗi hệ thống"

**Không chỉ báo cáo.** Mọi chỗ render nhiều ngôn ngữ trong 1 request đều bị: `renderNotification()`
([notification-template.service.ts:142](../../apps/web/src/server/services/notification-template.service.ts))
nhận `locale` của **người nhận**, nhưng thực tế gửi mail/push theo ngôn ngữ của **người gây ra sự kiện**.

Vì sao app không có next-intl middleware mà vẫn chạy đúng cho page: không có middleware và không có
segment `[locale]` trên URL nên `requestLocale` **luôn** `undefined` ở render bình thường → rơi xuống cookie.
`requestLocale` chỉ có giá trị khi có người gọi `getTranslations({ locale })`.

## 3. Phương án sửa

**(1) Đảo thứ tự ưu tiên** — `apps/web/src/i18n/request.ts`:

```ts
const candidate = requested ?? cookieLocale ?? '';
```

An toàn vì `requested` chỉ khác `undefined` khi có yêu cầu tường minh (xem đoạn cuối §2), nên page vẫn theo cookie.

**(2) Chốt an toàn** — `truck-monthly-summary-workbook.ts`: tên tab trùng thì thêm hậu tố locale thay vì để
ExcelJS throw. Một message file sai không được phép giết cả file báo cáo:

```ts
function uniqueSheetName(wb, name, locale) { … `${name} (${locale})` … }
```

## 4. File thay đổi

| File | Loại | Nội dung |
|---|---|---|
| `apps/web/src/i18n/request.ts` | sửa | `requested` ưu tiên trước `cookieLocale` + comment giải thích |
| `apps/web/src/server/lib/truck-monthly-summary-workbook.ts` | sửa | thêm `uniqueSheetName()`, dùng ở `addWorksheet` |

## 5. Kiểm chứng (local, DB local)

Gọi trực tiếp server action `generateTruckReportAction` qua HTTP (`Next-Action`) với cookie từng ngôn ngữ:

| Cookie | Trước sửa | Sau sửa | Sheet | Tên file |
|---|---|---|---|---|
| `ko` | ❌ `CAR-E0500` `Worksheet name already exists: Korean` | ✅ | `tiếng việt` · `English` · `Korean` | `차량비용보고서_2026-07.xlsx` |
| `vi` | ❌ (trùng `tiếng việt`) | ✅ | 3 sheet đúng | `BaoCao_DoiXe_T7_2026_Report.xlsx` |
| `en` | ❌ (trùng `English`) | ✅ | 3 sheet đúng | `Fleet_Cost_Report_2026-07.xlsx` |
| không có | ✅ (đã chạy được từ trước) | ✅ | 3 sheet đúng | `BaoCao_DoiXe_T7_2026_Report.xlsx` |

Tiêu đề B7 từng sheet sau khi sửa: `BÁO CÁO XE TRUCK HÀNG THÁNG` / `MONTHLY TRUCKING REPORT` / `월간 운송 보고서`.

Không hồi quy:

- Trang `/truck/reports/new` với cookie `ko` vẫn render tiếng Hàn (18 chỗ `보고서 작성`) → page vẫn theo cookie
- Export ad-hoc vẫn theo ngôn ngữ người export: cookie `en` → `Trip_List_2026-07.xlsx`, tab `Trip list`,
  header `Ref · Date · Vehicle · Driver`; không cookie → `DanhSachChuyen_T7_2026.xlsx`, tab `Danh sách chuyến`
- `tsc --noEmit` exit 0 · `next lint` không warning

## 6. Chống tái phát

| Vấn đề | Quy tắc |
|---|---|
| Cookie đè yêu cầu tường minh | Trong `getRequestConfig`, **`requestLocale` luôn thắng**; cookie chỉ là fallback. Đừng đảo lại. |
| Lỗi 1 sheet giết cả file | Workbook nhiều sheet phải bảo đảm tên tab unique trước khi gọi `addWorksheet` (ExcelJS throw, không tự đổi tên). |
| Bug chỉ hiện khi có cookie | Test tính năng đa ngôn ngữ phải chạy **cả 4 trạng thái**: không cookie + `vi` + `en` + `ko`. Session curl mới không có cookie ⇒ không đại diện cho người dùng thật. |
| `getTranslations({ locale })` cho locale ≠ locale đang xem | Sau khi sửa mới thật sự hoạt động. Chỗ được hưởng lợi thứ hai: `renderNotification()` — email/push giờ đúng ngôn ngữ người nhận. |
