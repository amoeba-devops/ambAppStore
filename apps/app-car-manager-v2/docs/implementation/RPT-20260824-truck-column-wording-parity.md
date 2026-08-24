# RPT-20260824 — Đồng bộ tên cột trên 5 bề mặt (glossary `columns.truck`)

> REQ: [REQ-20260824](../analysis/REQ-20260824-truck-column-wording-parity.md)

## 1. Thay đổi

| # | File | Nội dung |
|---|------|----------|
| 1 | `apps/web/messages/{vi,en,ko}.json` | Thêm namespace **`columns.truck`** (32 khoá: 27 nhãn + 4 đơn vị) — nguồn nhãn duy nhất. Sửa nhãn form nhập chuyến cho khớp. **Xoá 12 khoá chết** `screens.truckTrips.th*` giờ do glossary phục vụ |
| 2 | `packages/shared/src/zod/truck-import.zod.ts` | `TRUCK_TEMPLATE_ORDER` (thứ tự 18 cột, tách khỏi chữ) · `TRUCK_IMPORT_ALIASES` (từ khoá nhận diện: nhãn chuẩn 3 ngôn ngữ + wording cũ, kèm danh sách **phủ định**) · giữ `TRUCK_IMPORT_HEADERS` (deprecated, tài liệu hoá layout cũ) |
| 3 | `app/(app)/truck/import/template/route.ts` | Header dựng từ glossary theo ngôn ngữ người tải (trước: luôn tiếng Việt) |
| 4 | `app/(app)/truck/import/_components/truck-import-panel.tsx` | Nhãn field ← glossary; auto-map ← alias; **bỏ fallback theo vị trí** trừ khi tiêu đề không nhận ra được gì |
| 5 | `app/(app)/truck/trips/export/route.ts` | Header ← glossary + đơn vị; **thêm cột "Điểm ghé"** (25 → 26 cột) |
| 6 | `server/queries/truck-trips.queries.ts` | `TruckTripRow.stopover` — gom các chặng WAYPOINT (`" · "`) để export có dữ liệu điểm ghé |
| 7 | `app/(app)/truck/trips/page.tsx` | Tiêu đề cột bảng + thẻ mobile ← glossary |

Không đụng DB, không migration, không đổi công thức nào.

## 2. Kiểm chứng (local, qua UI + file thật, 3 ngôn ngữ) — **10/10 PASS**

| Kiểm chứng | vi | en | ko |
|---|---|---|---|
| Template đúng ngôn ngữ người tải | ✅ `Ngày…` | ✅ `Date…` | ✅ `날짜…` |
| 18 nhãn template đều xuất hiện trong file xuất | ✅ | ✅ | ✅ |
| **Round-trip**: thả file xuất vào Import | ✅ **17/17** | ✅ **17/17** | ✅ **17/17** |

Regression: file dựng theo **template cũ** (nhãn tiếng Việt cũ: "Chi phí khác", "Ghi chú chi phí khác",
"Km đầu"…) vẫn nhập đúng — dầu 12 L × 24.000, DT 5.000.000, BOL `B9`.

Header cột bảng Danh sách chuyến đi sau khi sửa:

- vi: `STT · NGÀY · XE · KHU VỰC · TÀI XẾ · KHÁCH HÀNG · BOL · TỔNG KM · PHÍ NHIÊN LIỆU THỰC TẾ · PHÍ CẦU ĐƯỜNG · CHI PHÍ PHÁT SINH · TRẠNG THÁI · CẬP NHẬT · HÀNH ĐỘNG`
- en: `NO. · DATE · VEHICLE · REGION · DRIVER · CUSTOMER · BOL · TOTAL KM · ACTUAL FUEL COST · TOLL · OTHER COST · STATUS · UPDATED · ACTIONS`
- ko: `번호 · 날짜 · 차량 · 지역 · 기사 · 고객 · BOL · 총 주행 · 실제 연료비 · 통행료 · 기타 비용 · 상태 · 수정 · 관리`

`turbo run typecheck` 5/5 · `turbo run lint` pass. Dữ liệu test đã dọn.

Một lỗi tự gây trong lúc làm, đã bắt và sửa trước khi commit: cột "Tổng chi phí theo thực tế" bị dán
đơn vị hai lần (`(đ) (đ)`) vì nhãn i18n vốn đã mang đơn vị — nay dùng thẳng, không bọc thêm.

## 3. Lưu ý vận hành

- **File template và file xuất đổi chữ** ở một số cột (vd "Chi phí khác" → "Chi phí phát sinh",
  "Số Bill" → "Số BOL"). Ai đang có macro/công thức Excel bám theo tên cột cũ cần cập nhật; dữ liệu và
  thứ tự cột **không đổi** (trừ file xuất chèn thêm "Điểm ghé" ở vị trí thứ 11).
- File làm từ **template cũ vẫn nhập được** — bảng alias giữ nguyên wording cũ.
- Từ nay thêm/đổi tên cột chỉ sửa **một chỗ**: `columns.truck` trong 3 file i18n.

---

## 4. Bổ sung — đối chiếu DỮ LIỆU (không chỉ tiêu đề)

Test tiếp theo: tải template → điền giá trị đã biết → nhập → **xuất ra so từng ô** → **nhập lại chính
file xuất**. Lần chạy đầu lộ 1 lỗi cuối: **giờ bắt đầu/kết thúc lệch 7 tiếng** (điền `08:15`, file xuất
in `01:15`).

**Nguyên nhân:** giờ chuyến là *wall clock* người dùng gõ, nhưng hai đầu dùng hai khung giờ khác nhau —
ghi bằng `new Date("2027-12-08T08:15")` (diễn giải theo **múi giờ máy chủ**) còn đọc bằng
`toISOString()` (**luôn UTC**). Render chạy UTC nên hai bên trùng và lỗi không lộ trên staging/prod;
bất kỳ máy chủ nào khác múi giờ (máy dev ở GMT+7) là lệch đúng bằng offset.

**Sửa:** thêm `parseWallClockUtc()` (shared) và dùng ở **mọi** đường ghi giờ chuyến — 6 chỗ trong
`truck-trip.actions.ts` (form tạo/sửa/hoàn thành, cả bản tài xế) và `combineDateTime` của import; hai
form sửa đọc lại bằng `getUTC*` thay vì giờ máy. Trên Render kết quả **y hệt trước** (server vốn UTC),
nên dữ liệu cũ và hành vi prod không đổi — chỉ bỏ được sự phụ thuộc vào múi giờ máy chủ.

**Kết quả sau khi sửa:**

| Vòng | Kết quả |
|---|---|
| Điền → nhập → DB → xuất | **17/17 trường khớp** cả 3 chặng (trước: 15/17) |
| Cột dẫn xuất | Tổng km 150 · Phí nhiên liệu thực tế 1.126.250 = 42,5 × 26.500 ✓ |
| Nhập lại chính file xuất (vòng 2) | **13/13 trường giữ nguyên** — round-trip không mất mát |
| Bộ parity 4 bề mặt (chạy lại) | **10/10 PASS** |
