**PRD (Product Requirements Document)** và **SRD (Software Requirements Document)** chi tiết dựa trên dữ liệu báo cáo bán hàng tháng 4 của bạn. Bản này được thiết kế để Claude Code có thể hiểu rõ cấu trúc dữ liệu, các logic tính toán và mục tiêu của hệ thống để bắt đầu chia nhỏ task (break tasks).-----# 📄 PRODUCT REQUIREMENTS DOCUMENT (PRD)## 1\. Project Overview  * **Tên dự án:** Hệ thống Phân tích Doanh thu & Lợi nhuận (Sales & Profit Analytics System) - Tháng 04.
  * **Mục tiêu:** Tự động hóa việc tổng hợp dữ liệu bán hàng từ nhiều nền tảng (Shopee, TikTok), tính toán chi phí giá vốn (Prime Cost), chi phí sàn và chi phí marketing để xác định biên lợi nhuận (Contribution Margin) thực tế.
  * **Đối tượng sử dụng:** Quản lý kinh doanh, Bộ phận Tài chính.## 2\. Key Features (Tính năng chính)1.  **Consolidated Reporting:** Tổng hợp dữ liệu từ Shopee và TikTok vào một báo cáo duy nhất (Final Report).
2.  **Automated COGS Mapping:** Tự động khớp mã sản phẩm (Product ID/SKU) với bảng giá vốn (COGS Master File) để tính tổng tiền hàng.
3.  **Multi-Currency Support:** Hỗ trợ hiển thị và tính toán theo cả VND và KRW (tỷ giá 1 VND = 0.057 KRW).
4.  **Profitability Analysis:** Tính toán các chỉ số quan trọng:
      * Net GMV (Doanh thu thuần sau giảm giá).
      * Platform Fee (Phí sàn).
      * Marketing Spend (Chi phí quảng cáo, Affiliate).
      * Contribution Margin (Biên lợi nhuận đóng góp).## 3\. User Stories  * "Là một quản lý, tôi muốn biết sản phẩm nào đang có biên lợi nhuận thấp nhất để điều chỉnh giá bán hoặc chiến dịch marketing."
  * "Là một kế toán, tôi muốn tự động tính tổng Prime Cost dựa trên số lượng bán ra mà không phải tra cứu thủ công."## 4\. Success Metrics  * Độ chính xác của biên lợi nhuận đạt 100% so với công thức kế toán.
  * Thời gian tổng hợp báo cáo giảm từ vài giờ xuống vài phút.-----

 **SOFTWARE REQUIREMENTS DOCUMENT (SRD)** chi tiết. Tài liệu này được thiết kế để làm cơ sở cho việc phát triển hệ thống quản lý bán hàng và lợi nhuận tự động, giúp tối ưu hóa việc xử lý dữ liệu từ các sàn TMĐT (Shopee, TikTok) và tính toán chi phí (Prime Cost/COGS).-----# SOFTWARE REQUIREMENTS DOCUMENT (SRD)**Project Name:** Sales Performance & Prime Cost Management System (SPCM)  
**Target:** Automated Financial Reporting for E-commerce Operations## 1\. GIỚI THIỆU (INTRODUCTION)### 1.1 Mục tiêuXây dựng hệ thống quản lý dữ liệu bán hàng tập trung, tự động tính toán giá vốn hàng bán (COGS), lợi nhuận gộp (Gross Profit) và hiệu quả vận hành dựa trên dữ liệu từ các sàn TMĐT (Shopee, TikTok) và danh mục chi phí gốc (Prime Cost).### 1.2 Phạm viHệ thống sẽ xử lý dữ liệu từ 3 nguồn chính:  * **COGS Master:** Danh mục gốc quản lý SKU và giá vốn.
  * **Prime Cost:** Bảng kê chi tiết giá niêm yết và giá bán thực tế.
  * **Final Report:** Báo cáo tổng hợp hiệu suất kinh doanh đa kênh.-----## 2\. KIẾN TRÚC DỮ LIỆU (DATA ARCHITECTURE)### 2.1 Thực thể Sản phẩm (Product/SKU Entity)Dựa trên bảng `COGS MASTER FILE` và `PRIME COST`:  * **Product ID / Variation ID:** Mã định danh duy nhất từ sàn.
  * **SKU (Stock Keeping Unit):** Mã kho dùng để đồng bộ giữa các bảng.
  * **Product Name (VE/EN):** Tên sản phẩm đa ngôn ngữ (Tiếng Việt/Tiếng Anh).
  * **Prime Cost:** Giá vốn gốc (VNĐ).
  * **Selling Price / New Listing Price:** Giá bán hiện tại và giá niêm yết mới.### 2.2 Thực thể Báo cáo (Reporting Entity)Dựa trên cấu trúc bảng `FINAL REPORT`:  * **Net GMV:** Tổng giá trị giao dịch thuần.
  * **Discount Costs:** Chi phí giảm giá (Voucher, Flash sale).
  * **Promotional Costs:** Chi phí marketing/quảng cáo.
  * **Platform Fees:** Phí sàn (Shopee/TikTok).
  * **Currency Conversion:** Hỗ trợ quy đổi VNĐ ↔ KRW (Tỷ giá tham chiếu: 1 VNĐ = 0.057 KRW).-----## 3\. YÊU CẦU CHỨC NĂNG (FUNCTIONAL REQUIREMENTS)### 3.1 Quản lý Danh mục & Giá vốn (Module COGS)  * **F1:** Cho phép nhập và cập nhật giá vốn (Prime Cost) theo SKU từ file Master.
  * **F2:** Theo dõi lịch sử thay đổi giá vốn (ví dụ: Update 07.08).
  * **F3:** Tự động cảnh báo nếu `Selling Price` thấp hơn `Prime Cost` (bán lỗ).### 3.2 Xử lý Dữ liệu Bán hàng (Module Sales Integration)  * **F4:** Import dữ liệu từ Shopee/TikTok và khớp nối với SKU trong Master File.
  * **F5:** Tính toán `Net GMV` sau khi trừ các khoản giảm giá và hoàn hàng.
  * **F6:** Phân bổ chi phí quảng cáo và phí sàn cho từng SKU hoặc nhóm ngành hàng.### 3.3 Phân tích & Báo cáo (Module Analytics)  * **F7 (Overview Performance):** Hiển thị các chỉ số chính (Net GMV, Item Sold, Orders, AOV) theo tháng.
  * **F8 (Margin Analysis):** Tính toán tỷ lệ % Prime Cost/Net GMV (Target hiện tại đang ở mức \~30.25%).
  * **F9 (Multi-currency):** Tự động chuyển đổi toàn bộ báo cáo sang KRW để báo cáo cho đối tác Hàn Quốc.-----## 4\. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)### 4.1 Độ chính xác (Accuracy)  * Hệ thống phải xử lý được các dòng dữ liệu trống (NaN) và các ô bị gộp (merged cells) từ báo cáo thô của sàn TMĐT.
  * Làm tròn số thập phân chính xác cho các chỉ số % và tỷ giá quy đổi.### 4.2 Hiệu suất (Performance)  * Xử lý file dữ liệu lên đến 10,000 dòng (SKU/Đơn hàng) trong thời gian dưới 5 giây.### 4.3 Bảo mật (Security)  * Phân quyền người dùng: Chỉ Admin mới được sửa `Prime Cost` trong Master File.-----## 5\. LUỒNG DỮ LIỆU (DATA FLOW)1.  **Input:** User tải lên các bảng `COGS Master`, `Prime Cost` và `Sales Report`.
2.  **Processing:**
      * Hệ thống dùng `SKU` làm khóa chính (Primary Key) để Map giá vốn vào dữ liệu bán hàng.
      * Tính toán: `Profit = Net GMV - Prime Cost - Promo Costs - Fees`.
3.  **Output:** Xuất ra Dashboard tổng hợp (tương tự tab `FINAL REPORT`) và chi tiết lợi nhuận từng SKU.-----**Ghi chú cho Developer:**  * Cần đặc biệt lưu ý cột `SKU` trong các bảng (ví dụ: `MBSD17U0019`, `SAFG35U0007`) để đảm bảo không bị sai lệch khi mapping dữ liệu.
  * Cấu trúc bảng `FINAL REPORT` hiện tại có nhiều dòng tiêu đề phụ (Overview Performance, Net GMV...), cần viết script parser để trích xuất đúng giá trị số từ các cột tương ứng.