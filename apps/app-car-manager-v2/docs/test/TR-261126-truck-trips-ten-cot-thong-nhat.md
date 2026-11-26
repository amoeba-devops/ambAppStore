# TR-261126 — Truck: thống nhất tên / thứ tự / kiểu dữ liệu cột giữa Danh sách chuyến đi ↔ File xuất ↔ File mẫu

- **Ngày test**: 2026-11-26
- **Branch / commit**: `fix/car-v2-truck-trips-consistent-names` @ `0cd7b26d` (tách từ `main` @ `db6bfa5e`)
- **Tài liệu sửa lỗi**: [FIX-261126-truck-trips-ten-cot-thong-nhat.md](../bug-fix/FIX-261126-truck-trips-ten-cot-thong-nhat.md)
- **Bằng chứng**: ảnh màn hình (`01`…`11`), file .xlsx đã tải / đã dựng, script kiểm tra và trang so sánh `so-sanh-bang-file-xuat-file-mau.html` lưu ở `docs/test/TR-261126-evidence/` trên máy test. **Không commit**: repo không lưu file nhị phân trong `docs/`. Các tên file nhắc trong báo cáo này đều nằm trong thư mục đó.

## 1. Kết luận

| | Kết quả |
|---|---|
| Tổng | **11 TC — 10 PASS, 1 PASS có ghi chú (TC-09), 0 FAIL** |
| Lỗi do branch gây ra | **Không có** |
| Lỗi có sẵn phát hiện thêm (ngoài phạm vi branch) | 1 lỗi đáng sửa (OBS-1: ô Đơn giá nhân ×10/×100) — **đã sửa** trên cùng branch, xem [FIX-261126-truck-don-gia-nhien-lieu-so-le.md](../bug-fix/FIX-261126-truck-don-gia-nhien-lieu-so-le.md). Vài điểm lệch chữ nhỏ (mục 5) chưa sửa |

Bảng, file mẫu và file xuất giờ dùng chung tên cột (glossary `columns.truck`), chung thứ tự và chung number format.
Xuất rồi nhập lại cho kết quả giống hệt: **81/81 ô** trùng cả giá trị, kiểu ô và format (TC-07).

## 2. Môi trường

| Mục | Giá trị |
|---|---|
| Mã nguồn | Git worktree riêng `.claude/worktrees/truck-names-test` (main checkout đang có ~380 file chưa commit ở branch docs nên không checkout đè). `node_modules` junction từ main checkout. `package.json` / `package-lock.json` của `0cd7b26d` giống hệt main checkout (`git diff --stat` rỗng) nên không cần `npm install` |
| DB | `DATABASE_URL` → Neon **`ep-steep-tooth`** (dev). **Không phải** prod `ep-misty-butterfly`. Mọi script SQL đều chặn cứng nếu host không phải `ep-steep-tooth` |
| Server | `next dev` (Next 15.5.18, Node 22.21.1) tại `http://localhost:3001`, `BASE_PATH` / `NEXT_PUBLIC_BASE_PATH` trống |
| Đăng nhập | Theo yêu cầu: vào thẳng bằng role qua `/dev-login` (`DEMO_AUTO_LOGIN=true`), không qua AMA. OWNER → ADMIN cho các TC chính |
| Trình duyệt | Claude in Chrome (desktop). TC-02 dùng browser pane của app với viewport mobile 375×812 (cửa sổ Chrome đang maximize, không co được) |
| Đọc file | `openpyxl 3.1.5` + đọc thẳng XML (`<cols>`, `styles.xml`, `<pane>`) — script ở `TR-261126-evidence/scripts/inspect_xlsx.py` |

### Bước 1 — Kiểm tra tĩnh

| Lệnh | Kết quả |
|---|---|
| `tsc --noEmit -p apps/web` | ✅ 0 lỗi |
| `tsc --noEmit -p packages/shared` | ✅ 0 lỗi |
| `next lint` (apps/web) | ✅ 0 error. Trong các file branch sửa chỉ có cảnh báo cũ `'_issue' is defined but never used` ở `truck-import-panel.tsx:220`. 14 cảnh báo còn lại nằm ở file không liên quan (có từ trước) |
| Key i18n vi / en / ko | ✅ 3 file cùng bộ key (0 key lệch). `columns.truck` đủ mọi key mà bảng / file dùng. Không còn chỗ nào gọi key đã xoá (`exportContent.truckTrips.colTotalCost/colProfit`, `screens.truckImport.colDate/colCustomer/colRevenue/f.*`). `finance/export` gọi `t('colProfit')` nhưng thuộc `exportContent.truckFinance` (key vẫn còn) |

## 3. Kết quả từng test case

| TC | Nội dung | Kết quả | Bằng chứng |
|---|---|---|---|
| TC-01 | Danh sách chuyến — desktop vi | ✅ PASS | ảnh `01`, DOM `thead` |
| TC-02 | Danh sách — mobile | ✅ PASS | ảnh `02` |
| TC-03 | Tải file mẫu | ✅ PASS | `xlsx/TC03-*`, output script |
| TC-04 | File mẫu gõ tay → nhập | ✅ PASS | ảnh `03`, `xlsx/TC04-*`, DB |
| TC-05 | Xuất Excel | ✅ PASS | `xlsx/TC05-*`, XML ô |
| TC-06 | Tên cột bảng ↔ file, vi/en/ko | ✅ PASS | ảnh `08`, HTML SSR + header file |
| TC-07 | Xuất → nhập lại → xuất lại | ✅ PASS | ảnh `04`, `xlsx/TC07-*`, so 81 ô |
| TC-08 | File định dạng cũ | ✅ PASS | ảnh `05`, `xlsx/TC08-*`, DB |
| TC-09 | Phân quyền | ⚠️ PASS có ghi chú | curl |
| TC-10 | Header xem trước màn Nhập Excel | ✅ PASS | ảnh `03`, `06`, `07` |
| TC-11 | Hồi quy | ✅ PASS | curl 3 ngôn ngữ, console, log |

### Dữ liệu test tạo qua UI (xe 29C-99999, tài xế Bùi Văn Thắng, tháng 11/2026)

| Chuyến | Loại | Đặc điểm |
|---|---|---|
| TR-3007 (a) | Ghi nhận hoàn thành | 5 phí (cầu đường 150.000 · vệ sinh 60.000 · sửa chữa 120.000 · cầu phà 40.000 · bốc dỡ 200.000), phát sinh "Rửa xe 50.000" + "Bến bãi 30.000", 40,25 L × 21.350,5 đ/L, doanh thu 5.000.000 |
| TR-3008 (b) | Ghi nhận hoàn thành | Qua đêm 22:05 → 02:15 |
| TR-3009 (c) | Ghi nhận hoàn thành | BOL `0123`, CDF `00045`, 10,5 L |
| TR-3010 (d) | Giao tài xế | Chưa hoàn thành (CONFIRMED) |

> Form tạo chuyến không nhập được đơn giá lẻ (xem OBS-1). Vì vậy TR-3007 được tạo qua UI với 21.350 đ/L, sau đó sửa đúng 1 cột `trp_fuel_price = 21350.50` bằng SQL trên DB dev. Đơn giá lẻ cũng được kiểm tra qua đường nhập Excel thật ở TC-04 (dòng 2) và TC-07.

### TC-01 — Danh sách chuyến (desktop, vi) ✅

Header thực tế (DOM `thead`, 18 cột):
`STT | Ngày | Xe | Khu vực | Tài xế | Khách hàng · Số BOL | Tổng km | Phí cầu đường | Phí vệ sinh phương tiện | Phí sửa chữa | Phí cầu phà | Phí bốc dỡ hàng hóa | Chi phí phát sinh | Phí nhiên liệu thực tế | Tổng chi phí | Trạng thái | Cập nhật | Hành động`

- Thứ tự đúng như TC. Cột cuối có tên "Hành động" (TC ghi "Thao tác"). Đây là cột chỉ có trên bảng, branch không đổi.
- Giá trị nằm đúng cột. Dòng TR-3007: `… 80.000 ₫ (phát sinh) | 859.358 ₫ (nhiên liệu thực tế) | 1.509.358 ₫ (tổng)`.
- Tự tính lại cho (a): 40,25 × 21.350,5 = 859.357,6 → **859.358**. Tổng = 859.358 + 150.000 + 60.000 + 120.000 + 40.000 + 200.000 + 80.000 = **1.509.358** ✓
- Tooltip (`title` native, đọc từ HTML SSR) có đủ ở 4 cột:
  - Tổng km: "= Km cuối − Km đầu"
  - Chi phí phát sinh: "= Tổng các khoản chi phí phát sinh của chuyến …"
  - Phí nhiên liệu thực tế: "= Đơn giá × Lượng nhiên liệu / …"
  - Tổng chi phí: "= Phí nhiên liệu thực tế + Phí cầu đường + Phí vệ sinh phương tiện + Phí sửa chữa + Phí cầu phà + Phí bốc dỡ hàng hóa + Chi phí phát sinh / …"

### TC-02 — Mobile ✅

Thẻ TR-3007: `Phí cầu đường: 150.000 ₫ → Phí cố định & phát sinh: 500.000 ₫ → Phí nhiên liệu thực tế: 859.358 ₫ → Tổng chi phí: 1.509.358 ₫`. Thứ tự đúng, 500.000 = 4 phí cố định + 80.000 phát sinh.

### TC-03 — File mẫu ✅

`CR-Vietnam-Truck-v1_Mau-Nhap-Chuyen.xlsx`, sheet "Nhật ký chuyến":
- `max_row = 1` (chỉ có dòng tiêu đề), dòng tiêu đề in đậm, `<pane ySplit="1" state="frozen"/>`.
- **24 cột, đúng thứ tự TC**: Ngày | Xe | Tài xế | Khách hàng | Số BOL | Số CDF | Giờ bắt đầu | Giờ kết thúc | Điểm lấy hàng | Điểm ghé | Điểm giao hàng | Km đầu (km) | Km cuối (km) | Phí cầu đường (đ) | Phí vệ sinh phương tiện (đ) | Phí sửa chữa (đ) | Phí cầu phà (đ) | Phí bốc dỡ hàng hóa (đ) | Chi phí phát sinh (đ) | Ghi chú phát sinh | Đơn giá (đ/L) | Lượng nhiên liệu (L) | Doanh thu (đ) | Ghi chú chuyến.
- Number format theo `<cols>`: Ngày `dd/mm/yyyy` · 2 cột Giờ `hh:mm` · Km `#,##0` · 6 cột tiền + Doanh thu `#,##0` · Đơn giá, Lượng `#,##0.00` · mọi cột chữ còn lại `@`.
- en (`Date | Vehicle | … | Trip notes`) và ko (`날짜 | 차량 | … | 운행 메모`): 24 cột, cùng format, không lộ tên key.

### TC-04 — File mẫu gõ tay rồi nhập ✅

File `TC04-file-mau-go-tay.xlsx`: 3 dòng điền vào file mẫu vi bằng openpyxl, mỗi ô ghi đúng kiểu và format của cột. Ngày 26/11/2026 là serial date. Giờ 08:30 / 17:45 là phần lẻ của ngày. BOL `0123` là chuỗi. Phí cầu đường 2.500.000, lít 10,5. Dòng 2 có đủ 5 phí, 2 khoản phát sinh và đơn giá 21.350,5. Nhập vào xe 60C-522.18.

- **Tự map**: 22 trường dữ liệu map đúng cột. "Trạng thái" = *(không dùng)* vì file mẫu không có cột này (đúng thiết kế, `FIELDS` có 23 mục tính cả Trạng thái). Xe và Tài xế chọn trên màn hình.
- Xem trước: "3 dòng hợp lệ", đúng ngày và doanh thu.
- Sau khi nhập (TR-3011…3013), DB: ngày `2026-11-26`, giờ `08:30` / `17:45`, BOL `0123` / CDF `00045` giữ số 0 ở đầu, phí 2.500.000, lít 10,50, đơn giá 21.350,50. Phát sinh tách đúng thành `[Rửa xe 50.000, Bến bãi 30.000]`, điểm ghé tạo thành stopover.
- Mở chi tiết TR-3012 trên UI: 26/11/2026 · 08:30 → 17:45 · 50.120 → 50.240 km · BOL 0124 · CDF 00046 · đủ 3 điểm · phí và 2 khoản phát sinh khớp file.

### TC-05 — Xuất Excel (tháng 11, các chuyến a–d) ✅

`DanhSachChuyen_T11_2026.xlsx`, sheet "Danh sách chuyến", 4 dòng, dòng tiêu đề in đậm và cố định.
- **31 cột đúng TC**: Mã chuyến | Ngày | Xe | Khu vực | Tài xế | Khách hàng | Số BOL | Số CDF | Giờ bắt đầu | Giờ kết thúc | Điểm lấy hàng | Điểm ghé | Điểm giao hàng | Km đầu (km) | Km cuối (km) | Tổng km | Phí cầu đường (đ) | Phí vệ sinh phương tiện (đ) | Phí sửa chữa (đ) | Phí cầu phà (đ) | Phí bốc dỡ hàng hóa (đ) | Chi phí phát sinh (đ) | Ghi chú phát sinh | Đơn giá (đ/L) | Lượng nhiên liệu (L) | Phí nhiên liệu thực tế (đ) | Doanh thu (đ) | Tổng chi phí (đ) | Lợi nhuận (đ) | Trạng thái | Ghi chú chuyến.
- So với file mẫu (vi/en/ko): 24 cột chung **cùng tên, cùng thứ tự tương đối, cùng number format**.
- XML ô (dòng TR-3008): `B4 <v>46347</v>` (serial = 21/11/2026, style dd/mm/yyyy, không phải chữ), `I4 <v>0.92013…</v>` = 22:05, `J4 <v>0.09375</v>` = 02:15. Không có chuỗi "2026-11" trong sharedStrings.
- BOL `0123`, CDF `00045` là ô chuỗi (`t="s"`). Km và tiền là ô số.
- Đơn giá `21350.5` và lít `40.25` giữ đủ (`#,##0.00`).
- Trạng thái: "Đã hoàn thành" / "Chưa hoàn thành" (en "Completed" / "Open", ko "완료" / "미완료"), trùng chữ trên bảng.
- Tổng chi phí khớp bảng: 1.509.358 / 710.000 / 260.000 / 0.
- Lợi nhuận = Doanh thu − Tổng: 3.490.642 / 2.290.000 / 1.740.000 / 0 ✓

### TC-06 — Tên cột bảng ↔ file (vi / en / ko) ✅

So header bảng (HTML SSR theo cookie `NEXT_LOCALE`, cùng cơ chế với nút đổi ngôn ngữ) với header file xuất sau khi bỏ phần đơn vị trong ngoặc:

| | Cột chung trùng tên | "Khách hàng · Số BOL" = 2 cột file | Chỉ có trên bảng |
|---|---|---|---|
| vi | 14/14 ✅ | `Khách hàng` + `Số BOL` ✅ | STT, Cập nhật, Hành động |
| en | 14/14 ✅ | `Customer` + `BOL No.` ✅ | No., Updated, Actions |
| ko | 14/14 ✅ | `고객` + `BOL 번호` ✅ | 번호, 수정, 관리 |

Không có header nào hiện tên key (`columns.truck.*`) trên bảng, file mẫu hay file xuất. Đã chụp danh sách ở KO (ảnh `08`) sau khi đổi ngôn ngữ qua UI.

### TC-07 — Xuất xong nhập lại ✅

Nhập file xuất ở TC-05 vào xe 51C-458.32, tài xế Trần Văn Sơn:
- **Tự nhận đúng 23/23 trường** theo đúng thứ tự `FIELDS`. *Tổng km, Phí nhiên liệu thực tế (đ), Tổng chi phí (đ), Lợi nhuận (đ), Mã chuyến, Khu vực* **không** map vào trường nào.
- "4 dòng · 3 dòng hợp lệ · 1 dòng bỏ qua". Dòng "Chưa hoàn thành" (TR-3010) bị gắn "Chưa hoàn tất — bỏ qua".
- Sau khi nhập (TR-3014…3016): qua đêm 22:05 / 02:15, BOL `0123`, đơn giá 21.350,50 / 40,25 L, phát sinh tách lại thành 2 khoản.
- Xuất lại theo xe 51C và so từng ô với file trước (bỏ Mã chuyến / Xe / Khu vực / Tài xế): **81 ô so sánh, 0 khác biệt**. Mỗi ô trùng cả 3: giá trị, kiểu ô và number format.
- Thêm: chạy chính `TRUCK_IMPORT_ALIASES` (bằng `node --experimental-strip-types`) trên header 6 file. File mẫu vi/en/ko map 22/23 (trừ Trạng thái), file xuất vi/en/ko map 23/23. Không có 2 trường nào trùng cột, từng trường map đúng cột ở cả en và ko.

### TC-08 — Tương thích file cũ ✅

File `TC08-file-dinh-dang-cu.xlsx` theo layout trước branch: mọi ô ngày/giờ là **chữ**, không number format, header "Tổng chi phí theo thực tế (đ)" / "Lợi nhuận theo thực tế (đ)". Thêm 1 dòng ngày dạng chữ `27/11/2026` và giờ `8:30` (giả lập Excel ở locale khác).

| Dòng | Ngày | Giờ | Trạng thái | Kết quả |
|---|---|---|---|---|
| R1 | "2026-11-26" | "08:30"–"17:45" | Hoàn tất | ✅ nhập: 2026-11-26, 08:30–17:45, BOL 0777 |
| R2 | "2026-11-26" | | Đang di chuyển | ✅ bỏ qua |
| R3 | "27/11/2026" | "8:30"–"23:15" | Hoàn tất | ✅ nhập: 2026-11-27, 08:30–23:15 |
| R4 | "2026-11-27" | trống | Đã xác nhận | ✅ bỏ qua |

Header "Tổng chi phí theo thực tế (đ)" không bị map nhầm. 23/23 trường còn lại map đúng.

### TC-09 — Phân quyền ⚠️ PASS có ghi chú

| Người gọi | `/truck/import/template` | `/truck/trips/export?month=2026-11` |
|---|---|---|
| MEMBER (→ DRIVER, sub mặc định) | 307 → `/today` | 307 → `/today` |
| Tài xế xe tải (MEMBER, persona `drv-truck`) | 307 → `/today` | 307 → `/today` |
| MANAGER chỉ phòng CAR (persona `mgr-car`) | 307 → `/dashboard` | 307 → `/dashboard` |
| MANAGER phòng TRUCK (persona `mgr-truck`) | 200 xlsx | 200 xlsx |
| Chưa đăng nhập / cookie rác | 307 → `/login` | 307 → `/login` |

- **Về bảo mật: đạt.** Không vai trò nào ngoài quyền tải được file (body rỗng, không phải xlsx).
- **Lệch kỳ vọng mã HTTP**: TC chờ 403/401 nhưng thực tế là 307. Nguyên nhân là `apps/web/src/middleware.ts` chặn `/truck/*` trước khi tới route handler: DRIVER ngoài allowlist → `/today` (dòng 177–178), MANAGER không có fleet TRUCK → trang chủ phòng mình (dòng 181–195), không có phiên → `/login` (dòng 168–169). Nhánh 401/403 trong `template/route.ts` và `export/route.ts` là lớp phòng thủ thứ hai và không tới được qua middleware. Branch không đổi middleware, hành vi này có từ trước.
- Đề xuất: sửa kỳ vọng của TC thành "307 về trang chủ theo vai trò / `/login`". Đổi middleware để trả 401/403 cho đường dẫn tải file là thay đổi riêng, không bắt buộc.

### TC-10 — Header xem trước màn Nhập Excel ✅

| | Header bảng xem trước | Dòng bị bỏ qua |
|---|---|---|
| vi | Ngày \| Khách hàng \| Doanh thu | Chưa hoàn tất — bỏ qua |
| en | Date \| Customer \| Revenue | Not completed — skipped |
| ko | 날짜 \| 고객 \| 매출 | 미완료 — 제외 |

Trùng glossary `columns.truck.date/customer/revenue`. Đổi ngôn ngữ bằng nút chuyển ngôn ngữ trên UI. Không có lỗi i18n (`MISSING_MESSAGE` / `IntlError`) ở console hay log server.

### TC-11 — Hồi quy ✅

- Với vi / en / ko, mọi trang sau trả 200 và HTML (đã bỏ `<script>`) không chứa tên key `columns.* / screens.* / exportContent.*`, `MISSING_MESSAGE`, `CAR-E####` hay chuỗi lỗi ứng dụng: `/truck/dashboard`, `/truck/finance?month=2026-11`, `/truck/pnl?month=2026-11`, chi tiết chuyến (TR-3007, TR-3012), `/truck/import`, `/truck/trips`.
- Export của Chi phí & Lợi nhuận (`/truck/finance/export`, 13 cột) và P&L (`/truck/pnl/export`) ở 3 ngôn ngữ đều 200 xlsx, header không lộ key.
- Truck Dashboard và danh sách hiển thị bình thường ở KO (ảnh `08`).
- **Console trình duyệt**: chỉ có cảnh báo *hydration mismatch* do extension của trình duyệt chèn thuộc tính `bis_skin_checked="1"` vào DOM. Đây không phải lỗi app. Lọc bỏ loại này thì 0 lỗi.
- **Log `next dev`**: chỉ có `⨯ Failed to patch lockfile` lúc khởi động. Lỗi này do môi trường worktree (Next gọi `yarn config` và gặp field `packageManager`), không liên quan code. Không có lỗi request nào.

## 4. Lỗi tìm thấy

**Không có lỗi nào do branch gây ra.**

### OBS-1 — Ô "Đơn giá (đ/L)" trên form tạo/sửa chuyến Truck bỏ dấu thập phân → giá trị bị nhân 10 / 100 (có từ trước, ngoài phạm vi branch) — ✅ ĐÃ SỬA

> Sửa theo yêu cầu sau khi test. Chi tiết và kết quả kiểm tra lại ở [FIX-261126-truck-don-gia-nhien-lieu-so-le.md](../bug-fix/FIX-261126-truck-don-gia-nhien-lieu-so-le.md).
> Tóm tắt: `MoneyInput` có thêm `decimals` (mặc định 0, các ô tiền khác không đổi). Đơn giá và Lượng nhiên liệu trên form dùng `decimals={2}`, màn hoàn tất chuyến đổi `step="0.01"`.
> Kiểm tra lại live: ô sửa chuyến "21.350,5" gõ thêm "0" → "21.350,50", phí nhiên liệu giữ 859.358 đ, lưu xong DB vẫn 21350.50 (ảnh `10`, `11`). Bộ test parse/format 45/45 đạt.
>
> Mô tả lúc phát hiện:

- **Triệu chứng**
  - Tạo chuyến: không nhập được 21.350,5. Gõ `21350.5` hoặc `21350,5` đều thành `213505`.
  - Sửa chuyến có đơn giá lẻ (nhập từ Excel, đang hiện "21.350,5"): gõ thêm 1 chữ số → ô thành **2.135.050**, "Chi phí nhiên liệu" nhảy lên 85.935.763 đ (ảnh `09`). Nếu bấm Lưu, phí nhiên liệu sai khoảng ×100. Khi test **đã không lưu**, DB vẫn là 21350.50.
- **Nguyên nhân gốc**: `truck-trip-form.tsx:472` dùng `MoneyInput` cho đơn giá. `MoneyInput` (`apps/web/src/components/inputs/money-input.tsx`) có `digitsOnly = text.replace(/[^\d]/g, '')`, tức bỏ cả `,` lẫn `.`. Trong khi đó DB (`numeric(…,2)`), file mẫu / file xuất (`#,##0.00`) và màn Nhập Excel đều nhận 2 số lẻ.
- **Đề xuất sửa (đã làm)**: thêm prop `decimals={2}` cho `MoneyInput`. Ô nhận dấu `,` (vi-VN) hoặc `.` làm phần thập phân, tối đa 2 số lẻ, và chỉ gắn dấu nghìn cho phần nguyên. Dùng cho cả `fuelPrice` lẫn `fuelLiters` để UI giống format file.

## 5. Ghi nhận nhỏ (không chặn merge)

| # | Ghi nhận | Vị trí |
|---|---|---|
| OBS-2 | TC-09 trả 307 thay vì 403/401 (xem TC-09) | `middleware.ts` |
| OBS-3 | Lý do bỏ dòng ở màn Nhập Excel vẫn ghi "Chưa hoàn **tất** — bỏ qua", còn trạng thái giờ là "Chưa hoàn **thành**". en ghi "Not completed", trạng thái ghi "Open" | `screens.truckImport.rowNotCompleted` |
| OBS-4 | Màn khác vẫn dùng key riêng cho cùng trường. Bảng "chuyến gần đây" ở Truck Dashboard dùng `screens.truckTrips.thCustomer` = "Khách hàng · BOL" (danh sách đã là "Khách hàng · Số BOL"). Chi tiết chuyến ghi "Nhiên liệu thực tế", "Cầu đường" thay vì "Phí nhiên liệu thực tế", "Phí cầu đường". Ngoài phạm vi TC (bảng ↔ file) nhưng cùng nguyên tắc "một trường một tên" | `truck/dashboard/page.tsx:607`, `trips/[id]/_components/truck-trip-detail.tsx` |
| OBS-5 | Bảng xem trước ở màn Nhập Excel hiện ngày dạng ISO `2026-11-26` (danh sách dùng `dd/mm/yyyy`). Doanh thu luôn có dấu nghìn kiểu vi kể cả khi UI là en/ko | `truck-import-panel.tsx` |
| OBS-6 | Chuyến chưa hoàn thành xuất Đơn giá / Lượng = `0` thay vì để trống. Không ảnh hưởng nhập lại vì dòng đó bị bỏ qua | `export/route.ts` (`fuelPrice`/`fuelLiters`) |
| OBS-7 | TC ghi cột cuối là "Thao tác", UI là "Hành động" (cột chỉ có trên bảng, branch không đổi). TC-04 ghi "23 trường", file mẫu chỉ map được 22 vì không có cột Trạng thái (đúng thiết kế) | tài liệu TC |

## 6. Dữ liệu test đã tạo và đã dọn

Tất cả trên **DB dev `ep-steep-tooth`**, entity `00000000-0000-4000-8000-000000000010`. Ghi chú mọi chuyến có tiền tố `TEST-NAMES`.

| Chuyến | Tạo bằng | Xe |
|---|---|---|
| TR-3007 … TR-3010 | Form UI (a–d). TR-3007 sửa `trp_fuel_price = 21350.50` bằng SQL | 29C-99999 |
| TR-3011 … TR-3013 | Nhập Excel — TC-04 | 60C-522.18 |
| TR-3014 … TR-3016 | Nhập Excel — TC-07 (round-trip) | 51C-458.32 |
| TR-3017, TR-3018 | Nhập Excel — TC-08 | 60C-522.18 |
| TR-3019 | Form UI — kiểm tra lại sau khi sửa OBS-1 (ghi chú `TEST-OBS1`) | 29C-99999 |

- **Đã dọn**: 13/13 chuyến đã soft delete qua nút **Xoá** trên trang chi tiết chuyến. SQL xác nhận: `total 12 · soft_deleted 12` (TEST-NAMES) + TR-3019 `deleted = true`, tháng 11/2026 còn 0 chuyến.
- Kiểm tra màn hoàn tất chuyến có mở form trên chuyến TRK-9002 (dữ liệu seed) nhưng **không bấm hoàn tất**. DB xác nhận TRK-9002 vẫn `IN_PROGRESS`, `trp_updated_at` không đổi.
- Còn lại (đúng thiết kế, không xoá): các dòng `car_trip_extra_costs` / `car_trip_stopovers` gắn với chuyến đã soft delete, và các dòng `car_audit_logs` của thao tác tạo / nhập / xoá (bảng chỉ cho INSERT).
- Không tạo xe, tài xế hay user mới. Persona dev (`mgr-car`, `mgr-truck`, `drv-truck`) chỉ được `/dev-login` tự đảm bảo tồn tại.
- Không bấm Nhập, tạo, sửa hay xoá nào trên DB khác ngoài dev. Không commit, push hay deploy.
