# COMPANY CAR MANAGEMENT SYSTEM (CCMS)

> Hệ thống Quản lý Xe Công ty – Phân hệ Quản lý Điều Xe & Kiểm Soát Chi Phí Nội Bộ
> Tài liệu phân tích nghiệp vụ tổng hợp (SRS + PRD + Personas + User Flows + Business Logic)
> Mục tiêu: cung cấp **bức tranh toàn cảnh** để Claude Code (và đội phát triển) hiểu rõ vấn đề trước khi đi vào thiết kế kỹ thuật.

---

## MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Vấn đề & Giải pháp (Problem–Solution Mapping)](#2-vấn-đề--giải-pháp)
3. [Bức tranh tổng thể nghiệp vụ](#3-bức-tranh-tổng-thể-nghiệp-vụ)
4. [Personas (Chân dung người dùng)](#4-personas-chân-dung-người-dùng)
5. [PRD – Product Requirements](#5-prd--product-requirements)
6. [SRS – Functional Requirements](#6-srs--functional-requirements)
7. [Yêu cầu phi chức năng (Business-level)](#7-yêu-cầu-phi-chức-năng-business-level)
8. [Mô hình dữ liệu khái niệm](#8-mô-hình-dữ-liệu-khái-niệm)
9. [Business Logic & Rules](#9-business-logic--rules)
10. [Vòng đời chuyến đi & chi phí](#10-vòng-đời-chuyến-đi--chi-phí)
11. [User Flows](#11-user-flows)
12. [Permission Matrix](#12-permission-matrix)
13. [Sự kiện & Thông báo (Event Map)](#13-sự-kiện--thông-báo-event-map)
14. [Reporting Requirements](#14-reporting-requirements)
15. [Edge Cases & Open Questions](#15-edge-cases--open-questions)
16. [Glossary](#16-glossary)

---

## 1. Tổng Quan Dự Án

### 1.1 Bối cảnh

Công ty đang vận hành **3 xe công ty** phục vụ nhu cầu di chuyển của cấp **Manager / Director**. Quy trình điều xe hiện tại được thực hiện thủ công qua **nhóm chat** (Zalo / KakaoTalk / WhatsApp), gây ra hàng loạt vấn đề về quản lý, truy vết, và kiểm soát chi phí.

### 1.2 Mục tiêu chiến lược

| # | Mục tiêu | Cách đo |
|---|----------|---------|
| G1 | Số hóa 100% quy trình đăng ký điều xe | Tỷ lệ chuyến đi tạo qua hệ thống / tổng số chuyến |
| G2 | Minh bạch vận hành — mọi chuyến đi có người chịu trách nhiệm rõ ràng | 0% chuyến đi không xác định được người sử dụng / tài xế |
| G3 | Kiểm soát toàn bộ chi phí theo từng đầu xe | 100% chi phí được gắn vào xe / chuyến đi cụ thể |
| G4 | Cảnh báo bảo dưỡng định kỳ chủ động | Số lần bảo dưỡng trễ hạn giảm về 0 |
| G5 | Báo cáo định kỳ tự động | Thời gian tạo báo cáo tháng < 5 phút |

### 1.3 Phạm vi

**Trong phạm vi (In-scope):**
- Quản lý 3 xe (thiết kế phải mở rộng được).
- Đăng ký, xác nhận, vận hành, hoàn thành chuyến đi.
- Ghi nhận 5 loại chi phí: xăng, dầu nhớt, tai nạn, ăn uống, sửa chữa.
- Phê duyệt chi phí (cấu hình được theo loại và ngưỡng).
- Báo cáo dashboard + xuất file Excel/PDF.
- Chia sẻ đường đi qua Google Maps.
- Thông báo (in-app, push, email).
- Đa ngôn ngữ: **English, Korean (한국어), Vietnamese (Tiếng Việt)**.

**Ngoài phạm vi (Out-of-scope, giai đoạn 1):**
- Tính lương / công tác phí tài xế.
- Theo dõi GPS real-time của xe.
- Kết nối tới cây xăng / garage / bảo hiểm.
- Tích hợp ERP / kế toán.
- Thanh toán điện tử.

### 1.4 Nền tảng sử dụng

- **Web App** – chính cho Admin & Manager (quản lý, báo cáo, phê duyệt).
- **Mobile App** – chính cho Driver & Manager (đăng ký, xác nhận, chụp chứng từ).

> *Lưu ý: tài liệu này không cố định công nghệ triển khai. Mọi yêu cầu được mô tả ở cấp độ nghiệp vụ và hành vi hệ thống.*

---

## 2. Vấn Đề & Giải Pháp

### 2.1 Bản đồ vấn đề → giải pháp

| Vấn đề hiện tại | Hệ quả | Giải pháp trong CCMS |
|-----------------|--------|----------------------|
| Đặt xe qua chat, lịch không tập trung | Trùng lịch, quên lịch, mất thông tin | **Form đăng ký có cấu trúc**, lưu vào hệ thống, có lịch sử |
| Không biết tài xế đã thấy lịch hay chưa | Manager phải nhắn lại, gọi lại để chốt | **Cơ chế xác nhận / từ chối** rõ ràng, có thông báo realtime |
| Không có lịch sử có cấu trúc | Không tra cứu được, không audit được | **Audit trail** + tìm kiếm / lọc lịch sử |
| Chi phí xăng, sửa chữa, ăn uống ghi sổ tay hoặc nhớ trong đầu | Sót, không có chứng từ, không kiểm soát | **Ghi nhận chi phí có chứng từ ảnh**, phân loại, gắn vào xe/chuyến |
| Không biết khi nào cần thay dầu, bảo dưỡng | Bảo dưỡng trễ hạn, xe hỏng đột ngột | **Cảnh báo bảo dưỡng** theo km và thời gian |
| Cuối tháng cộng Excel thủ công | Mất thời gian, dễ sai | **Báo cáo tự động** theo nhiều chiều, xuất file một click |
| Không biết xe nào đang ở đâu, làm gì | Mù mờ về tình trạng đội xe | **Dashboard** trạng thái đội xe real-time |

### 2.2 Giá trị cốt lõi (Value Proposition)

> *"Một nguồn sự thật duy nhất (single source of truth) cho mọi hoạt động liên quan đến xe công ty — từ lúc đặt chuyến, lái xe, đến khi quyết toán chi phí — thay thế hoàn toàn việc quản lý qua chat."*

Ba giá trị chính mang lại cho ba persona:
- **Manager** → đặt xe nhanh, không phải hỏi-đáp, biết ngay tài xế đã nhận lịch.
- **Driver** → thấy rõ hôm nay chạy đâu, ghi chi phí nhẹ nhàng, không bị "đòi" chứng từ.
- **Admin** → kiểm soát chi phí, có báo cáo tự động, phát hiện bất thường sớm.

---

## 3. Bức Tranh Tổng Thể Nghiệp Vụ

### 3.1 Sơ đồ ngữ cảnh hệ thống (Business Context)

```
                        ┌─────────────────────────────────┐
                        │     CÔNG TY (Tổ chức sử dụng)   │
                        └─────────────────────────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        ▼                              ▼                              ▼
┌──────────────┐               ┌──────────────┐               ┌──────────────┐
│   ADMIN      │               │   MANAGER /  │               │   DRIVER     │
│ (Văn phòng/  │               │   DIRECTOR   │               │  (Tài xế)    │
│   HR)        │               │ (Người dùng) │               │              │
└──────┬───────┘               └──────┬───────┘               └──────┬───────┘
       │ Cấu hình, duyệt              │ Đặt chuyến, xem lịch sử      │ Xác nhận lịch,
       │ chi phí, xuất báo            │                              │ ghi chi phí,
       │ cáo                          │                              │ cập nhật trạng thái
       │                              │                              │
       └─────────────────────┬────────┴──────────────────────────────┘
                             ▼
                ╔════════════════════════════╗
                ║    COMPANY CAR MGMT        ║
                ║    SYSTEM (CCMS)           ║
                ║                            ║
                ║  • Trip Management         ║
                ║  • Expense Management      ║
                ║  • Maintenance Alert       ║
                ║  • Reporting               ║
                ║  • Multi-language (EN/KR/VN)║
                ╚════════════════════════════╝
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  ┌──────────┐         ┌──────────┐         ┌────────────┐
  │  Google  │         │  Email   │         │  Push      │
  │   Maps   │         │  System  │         │  Notify    │
  │ (share)  │         │          │         │  (mobile)  │
  └──────────┘         └──────────┘         └────────────┘
```

### 3.2 Bản đồ Module và quan hệ nghiệp vụ

```
       ┌─────────────────────────────────────────────────────────┐
       │              MODULE 1: TRIP MANAGEMENT                  │
       │  Đăng ký → Phân công → Xác nhận → Vận hành → Hoàn thành │
       └──────────────┬──────────────────────────────────────────┘
                      │  Mỗi chuyến đi có thể phát sinh chi phí
                      ▼
       ┌─────────────────────────────────────────────────────────┐
       │             MODULE 2: EXPENSE MANAGEMENT                │
       │  Ghi nhận → (Phê duyệt nếu cần) → Vào sổ                │
       │  Loại: Xăng / Dầu / Tai nạn / Ăn uống / Sửa chữa        │
       └──────────────┬──────────────────────────────────────────┘
                      │  Dữ liệu chi phí + km tích lũy
                      ▼
       ┌─────────────────────────────────────────────────────────┐
       │           MODULE 2b: MAINTENANCE ALERT                  │
       │  Tính chu kỳ thay dầu → Cảnh báo Admin                  │
       └──────────────┬──────────────────────────────────────────┘
                      │
                      ▼
       ┌─────────────────────────────────────────────────────────┐
       │           MODULE 3: REPORT & ANALYTICS                  │
       │  Dashboard real-time + Export Excel/PDF                 │
       └─────────────────────────────────────────────────────────┘
```

### 3.3 Hành trình nghiệp vụ điển hình (End-to-End Story)

> *Câu chuyện minh họa giúp hiểu cách các module ghép lại:*

1. **Thứ Hai sáng**: Director cần đi gặp khách hàng lúc 14:00 chiều thứ Ba. Mở app, tạo chuyến đi.
2. **Admin** (hoặc Director) chọn xe và tài xế. Hệ thống gửi push cho tài xế.
3. **Tài xế** mở app, thấy thông báo, xem chi tiết, bấm **Xác nhận**. Director nhận thông báo "Đã xác nhận".
4. **Thứ Ba 14:00**: Tài xế bấm **Bắt đầu chuyến đi**. Trạng thái chuyển sang `IN_PROGRESS`.
5. **Trên đường về**, tài xế đổ 30 lít xăng. Mở app, vào **Chi phí**, chọn loại **Xăng**, nhập 30 lít × 24,000đ, chụp ảnh hóa đơn, bấm gửi.
6. **Về tới công ty**: Tài xế bấm **Kết thúc chuyến đi**, nhập số km hiện tại.
7. **Hệ thống** tự cộng km vào đồng hồ ảo của xe. Phát hiện xe đã chạy gần đến chu kỳ thay dầu → gửi cảnh báo cho Admin.
8. **Cuối tháng**: Admin mở dashboard, thấy tổng chi phí xe, vào báo cáo, xuất Excel gửi giám đốc.

Tất cả các bước trên **đều được lưu lại**, có thể tra cứu, lọc, và đối soát.

---

## 4. Personas (Chân Dung Người Dùng)

### 4.1 Persona A — Administrator (Quản lý hệ thống)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên gọi nội bộ** | Admin / HR-Admin / Văn phòng |
| **Tuổi** | 28–40 |
| **Mức công nghệ** | Trung bình–cao, dùng máy tính nhiều |
| **Thiết bị chính** | Laptop (Web App) |
| **Trách nhiệm** | Cấu hình hệ thống, quản lý danh sách xe & tài xế, phê duyệt chi phí, xuất báo cáo cho ban giám đốc |
| **Mục tiêu** | – Biết xe nào đang ở đâu, làm gì. – Kiểm soát chi phí, phát hiện bất thường. – Báo cáo gọn cho cấp trên cuối tháng. |
| **Pain points** | – Phải hỏi từng người để biết lịch sử. – Phê duyệt chi phí qua tin nhắn, dễ sót. – Cuối tháng phải gộp Excel thủ công. |
| **Tần suất sử dụng** | Hằng ngày |
| **Quyền hạn** | **Toàn quyền** – cấu hình, báo cáo, phê duyệt, điều xe, gán/đổi tài xế |

### 4.2 Persona B — Manager / Director (Người sử dụng xe)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên gọi nội bộ** | Người sử dụng xe / Trưởng phòng / Giám đốc |
| **Tuổi** | 35–55 |
| **Mức công nghệ** | Trung bình, dùng điện thoại nhiều hơn máy tính |
| **Thiết bị chính** | Mobile App (chính), Web App (thi thoảng) |
| **Trách nhiệm** | Đặt xe cho nhu cầu công việc của mình hoặc team |
| **Mục tiêu** | – Đặt xe nhanh < 1 phút. – Biết tài xế đã nhận lịch chưa. – Xem lại lịch sử chuyến đi của mình. |
| **Pain points** | – Phải chat nhiều người để chốt lịch. – Không biết xe đó có rảnh không. – Quên lịch đã đặt. |
| **Tần suất sử dụng** | Vài lần / tuần |
| **Quyền hạn** | Đăng ký chuyến đi, xem lịch sử cá nhân, hủy chuyến đi của chính mình (trước khi tài xế xác nhận) |

### 4.3 Persona C — Driver (Tài xế)

| Thuộc tính | Mô tả |
|------------|-------|
| **Tên gọi nội bộ** | Tài xế / Bác tài |
| **Tuổi** | 30–55 |
| **Mức công nghệ** | Thấp–trung bình, chỉ thao tác đơn giản được |
| **Thiết bị chính** | **Mobile App (chủ yếu)** |
| **Trách nhiệm** | Xác nhận lịch, lái xe, ghi nhận chi phí phát sinh, báo cáo trạng thái chuyến đi |
| **Mục tiêu** | – Biết hôm nay chạy đâu, mấy giờ, đón ai. – Ghi nhận xăng/sửa chữa nhanh, không phải nhớ. – Không bị "đòi" chứng từ. |
| **Pain points** | – Khó nhớ hết các chuyến trong tuần. – Mất hóa đơn giấy. – Phải nhắn tin báo cáo nhiều nơi. |
| **Tần suất sử dụng** | Hằng ngày |
| **Quyền hạn** | Xác nhận / từ chối lịch được phân công, ghi nhận chi phí, cập nhật trạng thái chuyến đi, upload chứng từ |

### 4.4 Stakeholder Map (Bản đồ các bên liên quan)

| Bên liên quan | Quan tâm điều gì | Tương tác với hệ thống |
|---------------|------------------|------------------------|
| Ban Giám đốc | Tổng chi phí, hiệu quả sử dụng xe | Nhận báo cáo (qua Admin) |
| HR / Admin | Quản trị toàn bộ hệ thống | Người dùng trực tiếp (toàn quyền) |
| Manager / Director | Đặt xe nhanh, không vướng | Người dùng trực tiếp (mobile) |
| Driver | Lịch rõ ràng, ghi chi phí dễ | Người dùng trực tiếp (mobile) |
| Kế toán | Chứng từ chi phí xe để hạch toán | Nhận export từ Admin |

---

## 5. PRD – Product Requirements

### 5.1 Vision Statement

> *Một nguồn sự thật duy nhất cho mọi hoạt động liên quan đến xe công ty, thay thế hoàn toàn quản lý qua chat, đem lại minh bạch và kiểm soát chi phí cho ban quản lý.*

### 5.2 Success Metrics (KPIs)

| KPI | Mục tiêu sau 3 tháng go-live |
|-----|------------------------------|
| Tỷ lệ chuyến đi đăng ký qua app | ≥ 95% |
| Thời gian trung bình tạo 1 chuyến đi | < 60 giây |
| Tỷ lệ chi phí có chứng từ đính kèm | ≥ 90% |
| Tỷ lệ tài xế xác nhận lịch trong 30 phút | ≥ 80% |
| Số lần trùng lịch xe / tháng | 0 |
| Mức hài lòng người dùng (CSAT) sau 3 tháng | ≥ 4/5 |

### 5.3 Phân loại tính năng theo MoSCoW

**Must have — bắt buộc cho MVP (Release 1):**
- Đăng ký chuyến đi đầy đủ trường thông tin.
- Xác nhận / từ chối lịch của tài xế.
- Trạng thái chuyến đi vòng đời đầy đủ: Pending → Confirmed → In-progress → Completed → Cancelled.
- Ghi nhận 5 loại chi phí.
- Upload ảnh chứng từ.
- Dashboard cơ bản (xe đang chạy / sẵn sàng / sửa chữa).
- Export Excel + PDF.
- Thông báo: in-app + push.
- 3 ngôn ngữ (EN/KR/VI).

**Should have — nên có:**
- Calendar view tuần / tháng.
- Cảnh báo bảo dưỡng (đến hạn thay dầu, đăng kiểm).
- Báo cáo Top user / Top cost.
- Cấu hình ngưỡng auto-approve chi phí.

**Could have — có thể có (giai đoạn 2):**
- Tự sinh route polyline trên Google Maps (không chỉ link share).
- Phân quyền theo phòng ban.
- Quản lý lịch nghỉ tài xế.
- Mobile app offline mode (cache chi phí, sync khi có mạng).

**Won't have — không làm trong giai đoạn 1:**
- GPS tracking real-time.
- Tính lương / overtime tài xế.
- Tích hợp ngân hàng / thanh toán điện tử.

### 5.4 Ràng buộc nghiệp vụ

- Số xe hiện tại: **3**. Thiết kế phải mở rộng được mà không cần thiết kế lại.
- Quy mô người dùng dự kiến: **< 50 active users** trong năm đầu.
- Đa ngôn ngữ: **chuyển ngữ runtime**, không hardcode chữ vào giao diện.
- Mobile phải dùng được trên thiết bị phổ thông của tài xế (cấu hình thấp).

---

## 6. SRS – Functional Requirements

### MODULE 1 — Đăng Ký & Quản Lý Chuyến Đi

#### FR-1.1 — Tạo yêu cầu chuyến đi

Người dùng có vai trò **Manager / Director / Admin** có thể tạo yêu cầu sử dụng xe với các trường:

| # | Trường | Bắt buộc | Loại | Mô tả |
|---|--------|----------|------|-------|
| 1 | Người sử dụng xe | Tùy chọn | Tham chiếu nhân viên | Mặc định = người tạo |
| 2 | Ngày đi | **Bắt buộc** | Ngày | Không cho phép quá khứ (trừ Admin) |
| 3 | Giờ đi | **Bắt buộc** | Giờ | Bước 15 phút |
| 4 | Điểm đón | **Bắt buộc** | Văn bản tự do | Có thể autocomplete từ địa chỉ cũ |
| 5 | Điểm đến | **Bắt buộc** | Văn bản tự do | |
| 6 | Điểm ghé (Stopover) | Tùy chọn | Mảng văn bản | Có thể thêm **nhiều** điểm ghé |
| 7 | Tài xế | Tùy chọn | Tham chiếu tài xế | Để trống → Admin gán sau |
| 8 | Loại xe | Tùy chọn | Tham chiếu xe | Hiển thị biển số + model. Để trống → Admin gán |
| 9 | Link Google Maps | Tự sinh | URL | Tự sinh từ pickup + stopovers + destination |
| 10 | Ghi chú | Tùy chọn | Văn bản nhiều dòng | Thông tin bổ sung |

**Acceptance criteria:**
- Sau khi save, Trip được tạo với trạng thái:
  - `PENDING_DRIVER_CONFIRMATION` nếu đã có tài xế.
  - `PENDING_ASSIGNMENT` nếu chưa có tài xế hoặc chưa có xe.
- Link Google Maps được tự sinh theo định dạng share đường đi với origin, destination, và waypoints.

#### FR-1.2 — Xử lý & Xác nhận lịch

- Sau khi gửi yêu cầu, hệ thống gửi **thông báo** (push + email) đến tài xế được phân công.
- Tài xế có thể **Xác nhận** hoặc **Từ chối** (kèm lý do).
- Trạng thái hiển thị rõ: `Chưa xác nhận` / `Đã xác nhận` / `Từ chối`.
- Nếu từ chối, **Admin nhận thông báo** và có thể **phân công lại** tài xế khác.
- ~~Kiểm tra xung đột lịch xe~~ → **Đã loại bỏ ở R2** theo yêu cầu khách hàng (không check conflict trong MVP). Có thể bật lại ở phase 2 dưới dạng cảnh báo mềm.

#### FR-1.3 — Hủy / Sửa chuyến đi

- **Manager** có thể hủy chuyến đi của chính mình **trước khi tài xế xác nhận**, hoặc sửa các trường (trừ Người sử dụng).
- **Admin** có thể hủy / sửa bất kỳ chuyến đi nào ở mọi trạng thái (trừ `COMPLETED`).
- Khi hủy: trạng thái → `CANCELLED`, gửi thông báo cho tài xế (nếu đã confirm).
- Mọi thay đổi đều ghi log (ai, khi nào, đổi gì).

#### FR-1.4 — Cập nhật trạng thái chuyến đi

Tài xế cập nhật trạng thái khi vận hành:

- **Bắt đầu chuyến đi**: trạng thái → `IN_PROGRESS`, ghi nhận thời điểm thực tế + (tùy chọn) số km đầu.
- **Kết thúc chuyến đi**: trạng thái → `COMPLETED`, ghi nhận thời điểm thực tế + (tùy chọn) số km cuối.
- Sau `COMPLETED`, tài xế vẫn có thể gắn chi phí trong **7 ngày**.

---

### MODULE 2 — Quản Lý Chi Phí & Bảo Dưỡng

#### FR-2.1 — Ghi nhận chi phí vận hành

Tài xế hoặc Admin có thể ghi nhận chi phí theo từng xe, hoặc gắn vào một chuyến đi cụ thể:

| # | Loại chi phí | Trường bắt buộc | Trường tùy chọn | Ghi chú |
|---|--------------|-----------------|------------------|---------|
| 1 | **Đổ xăng** | Ngày, số lít, đơn giá, trạm xăng | Số km hiện tại, ảnh hóa đơn | Tổng tiền = lít × đơn giá (tự tính). Ghi km giúp tính mức tiêu hao |
| 2 | **Thay dầu nhớt** | Ngày, loại dầu, chi phí, km hiện tại | Garage, ảnh hóa đơn | Hệ thống **cảnh báo khi đến hạn** (km hoặc thời gian) |
| 3 | **Tai nạn** | Ngày, mô tả, ảnh hiện trường, chi phí xử lý | Bên thứ 3, hồ sơ bảo hiểm | **Bắt buộc** upload ảnh, **bắt buộc** Admin phê duyệt |
| 4 | **Ăn uống** | Ngày, số người, số tiền | Ảnh hóa đơn, chuyến đi liên quan | Áp dụng chuyến xa có phát sinh bữa ăn |
| 5 | **Sửa chữa & Bảo trì** | Ngày, hạng mục, đơn vị thực hiện, chi phí | Ảnh hóa đơn, km hiện tại | **Yêu cầu phê duyệt** trước khi thực hiện (với khoản lớn) |

#### FR-2.2 — Phê duyệt chi phí

> ⚠️ **Tài liệu gốc có 2 phát biểu mâu thuẫn:**
> (A) "Phê duyệt 2 cấp: Tài xế gửi → Admin/Manager phê duyệt"
> (B) "Chỉ cần ghi nhận chi phí, k cần phê duyệt"
>
> **Cách diễn giải đề xuất (cần khách hàng xác nhận):** hệ thống **cấu hình được** theo từng loại chi phí — có flag `requires_approval` và `auto_approve_threshold`.

**Mặc định đề xuất:**

| Loại chi phí | Bắt buộc duyệt | Ngưỡng auto-approve |
|--------------|:--------------:|---------------------|
| Xăng | Không (chỉ ghi nhận) | – |
| Dầu nhớt | Không (chỉ ghi nhận) | – |
| Ăn uống | Không (chỉ ghi nhận, cảnh báo nếu vượt) | < 500,000 VND |
| **Tai nạn** | **Có** | – |
| **Sửa chữa** | **Có** | < 1,000,000 VND auto-approve |

- Admin có thể chỉnh ngưỡng trong **System Settings**.
- Khi cần phê duyệt: Admin nhận thông báo, có thể **Approve** hoặc **Reject (kèm lý do)**.

#### FR-2.3 — Cảnh báo bảo dưỡng định kỳ

- Mỗi xe có cấu hình chu kỳ bảo dưỡng (mặc định: thay dầu mỗi **5,000 km** hoặc **3 tháng**, tùy điều kiện nào đến trước).
- Hệ thống tính dựa trên km tích lũy (từ log xăng / odometer) và thời gian từ lần thay dầu gần nhất.
- Khi đạt **80% chu kỳ** → cảnh báo Admin.
- Khi đến / vượt **100% chu kỳ** → cảnh báo khẩn cấp.

---

### MODULE 3 — Báo Cáo & Thống Kê

#### FR-3.1 — Dashboard quản lý

Hiển thị thông tin gần real-time:

- **Tổng quan đội xe**: số xe đang chạy / sẵn sàng / đang sửa chữa.
- **Lịch điều xe** dạng **calendar view** (tuần / tháng) — mỗi chuyến là 1 block màu theo xe.
- **Chuyến đi trong kỳ**: tổng số, breakdown theo trạng thái.
- **Tổng chi phí trong kỳ** và **chi phí theo loại** (biểu đồ tròn).
- **Top người sử dụng xe** (biểu đồ cột, top 5).
- **Cảnh báo bảo dưỡng** (xe nào sắp đến hạn).
- Bộ lọc: khoảng thời gian, xe, loại chi phí.

#### FR-3.2 — Báo cáo xuất file

- Xuất **Excel (.xlsx)** và **PDF**.
- Các loại báo cáo:
  - Chi phí theo **xe** (period).
  - Chi phí theo **tháng**.
  - Chi phí theo **người sử dụng**.
  - Lịch sử **chuyến đi đầy đủ**.
  - **Tai nạn** (riêng).
  - **Sửa chữa & bảo dưỡng** (riêng).
- Header báo cáo: tên công ty, kỳ báo cáo, người xuất, ngày xuất.

---

## 7. Yêu Cầu Phi Chức Năng (Business-level)

> *Mô tả ở góc độ trải nghiệm và yêu cầu nghiệp vụ, không cố định công nghệ.*

| # | Loại | Yêu cầu |
|---|------|---------|
| NFR-1 | **Tốc độ phản hồi** | Người dùng cảm nhận thao tác chính (tạo trip, ghi chi phí, mở dashboard) phản hồi gần như tức thì. Dashboard load nhanh ngay cả khi có hàng nghìn bản ghi. |
| NFR-2 | **Khả năng mở rộng** | Hỗ trợ tăng từ 3 → 50 xe và 50 → 500 người dùng mà không cần thiết kế lại hệ thống. |
| NFR-3 | **Tính sẵn sàng** | Hoạt động ổn định trong giờ hành chính (8:00–18:00 GMT+7). |
| NFR-4 | **Bảo mật** | Đăng nhập có xác thực; dữ liệu truyền tải mã hóa; phân quyền theo vai trò; chỉ người có quyền mới thấy/sửa dữ liệu tương ứng. |
| NFR-5 | **Đa ngôn ngữ** | Hỗ trợ EN / KO / VI. Toàn bộ chữ giao diện đến từ file ngôn ngữ. Định dạng ngày, giờ, tiền tệ tự động theo locale. |
| NFR-6 | **Bản địa hóa** | Tiền tệ mặc định **VND**. Có thể thêm KRW / USD ở phase 2. |
| NFR-7 | **Dễ dùng** | Tài xế (low-tech) phải tạo/xác nhận/ghi chi phí trong ≤ **3 thao tác chính** trên mobile. Giao diện rõ, ít chữ, icon dễ hiểu. |
| NFR-8 | **Khả năng truy cập** | Font đủ lớn cho mobile, độ tương phản tốt cho người lớn tuổi. |
| NFR-9 | **Truy vết (Audit)** | Mọi thao tác tạo / sửa / xóa Trip / Expense / User đều được ghi log: ai, khi nào, đổi gì. |
| NFR-10 | **Lưu trữ dữ liệu** | Tối thiểu **5 năm** dữ liệu chuyến đi và chi phí. |
| NFR-11 | **Tải lên ảnh** | Hỗ trợ ảnh phổ thông (JPG/PNG/HEIC) và PDF. Tự nén ảnh dung lượng lớn về kích thước hợp lý. |
| NFR-12 | **Sao lưu** | Sao lưu hằng ngày, giữ ít nhất 30 ngày gần nhất. |

---

## 8. Mô Hình Dữ Liệu Khái Niệm

> *Mô hình ở cấp độ khái niệm — mô tả các thực thể nghiệp vụ và quan hệ. Chưa fix schema chi tiết để đội phát triển có không gian thiết kế.*

### 8.1 Các thực thể chính

**User (Người dùng)**
- Thông tin: họ tên, email, số điện thoại, vai trò (`ADMIN` | `MANAGER` | `DRIVER`), ngôn ngữ ưa thích, trạng thái hoạt động.

**Vehicle (Xe)**
- Thông tin: biển số (duy nhất), model, hãng, năm sản xuất, màu, loại nhiên liệu, trạng thái (`AVAILABLE` | `IN_USE` | `MAINTENANCE` | `RETIRED`), số km hiện tại, km/ngày thay dầu lần cuối, chu kỳ bảo dưỡng cấu hình được.

**Driver (Tài xế)**
- Có thể là User có role = DRIVER, hoặc tách bảng riêng.
- Thông tin: số bằng lái, ngày hết hạn bằng, trạng thái sẵn sàng.

**Trip (Chuyến đi)**
- Thông tin: người tạo, người sử dụng, tài xế, xe, ngày-giờ đi, điểm đón, điểm đến, ghi chú, link Google Maps, trạng thái, thời điểm thực tế bắt đầu / kết thúc, số km đầu / cuối.

**TripStopover (Điểm ghé)**
- Mỗi Trip có thể có nhiều stopover. Thông tin: vị trí, thứ tự.

**Expense (Chi phí)**
- Thông tin: xe liên quan, chuyến đi liên quan (nếu có), loại chi phí (`FUEL` | `OIL` | `ACCIDENT` | `MEAL` | `REPAIR`), ngày, số tiền, tiền tệ, mô tả, trạng thái (`RECORDED` | `PENDING_APPROVAL` | `APPROVED` | `REJECTED`), người tạo, người duyệt, lý do từ chối (nếu có).
- Có các trường mở rộng theo từng loại (vd: số lít với Fuel, hạng mục với Repair...).

**ExpenseAttachment (Chứng từ chi phí)**
- Ảnh / file PDF gắn với chi phí.

**Notification (Thông báo)**
- Người nhận, loại sự kiện, tiêu đề, nội dung, đối tượng liên quan, đã đọc hay chưa.

**AuditLog (Nhật ký truy vết)**
- Người thực hiện, hành động, thực thể liên quan, dữ liệu trước / sau, thời điểm.

### 8.2 Sơ đồ quan hệ nghiệp vụ

```
User (Manager) ─────────────► tạo ──────────► Trip
                                                │
User (Driver) ──────────────► được gán ────────►│
                                                │
Vehicle ───────────────────► được dùng ────────►│
                                                │
                                                ├──── có ────► TripStopover (N)
                                                │
                                                └──── phát sinh ────► Expense (N)
                                                                        │
                                                                        ├── có ──► ExpenseAttachment (N)
                                                                        │
                                                                        └── được duyệt bởi ──► User (Admin)
```

---

## 9. Business Logic & Rules

### 9.1 Trip State Machine (Vòng đời chuyến đi)

```
PENDING_ASSIGNMENT  ──(Admin gán driver + xe)──►  PENDING_DRIVER_CONFIRMATION
                                                            │
                            ┌───────────────────────────────┼─────────────────────────┐
                            ▼                               ▼                         ▼
                     (Driver Accept)                (Driver Reject)            (Manager Cancel)
                            │                               │                         │
                            ▼                               ▼                         ▼
                       CONFIRMED                  REJECTED_BY_DRIVER              CANCELLED
                            │                               │
                  (Driver Start Trip)             (Admin gán driver khác)
                            │                               │
                            ▼                               ▼
                      IN_PROGRESS               PENDING_DRIVER_CONFIRMATION
                            │
                  (Driver End Trip)
                            │
                            ▼
                       COMPLETED
```

**Quy tắc chuyển trạng thái:**

| Từ | Đến | Ai được phép | Điều kiện |
|----|-----|--------------|-----------|
| `PENDING_ASSIGNMENT` | `PENDING_DRIVER_CONFIRMATION` | Admin | Đã gán driver + vehicle |
| `PENDING_DRIVER_CONFIRMATION` | `CONFIRMED` | Driver được gán | — |
| `PENDING_DRIVER_CONFIRMATION` | `REJECTED_BY_DRIVER` | Driver được gán | Có lý do từ chối |
| `REJECTED_BY_DRIVER` | `PENDING_DRIVER_CONFIRMATION` | Admin | Gán driver khác |
| Bất kỳ (trừ COMPLETED) | `CANCELLED` | Admin | — |
| `PENDING_DRIVER_CONFIRMATION` | `CANCELLED` | Manager (creator) | Chưa được driver confirm |
| `CONFIRMED` | `IN_PROGRESS` | Driver | Có thể cảnh báo nếu start trước giờ đặt > 1h |
| `IN_PROGRESS` | `COMPLETED` | Driver | — |

### 9.2 Expense State Machine (Vòng đời chi phí)

```
                          ┌─ requires_approval = false ─►  RECORDED  ──(end)
                          │
   (Tạo expense) ─────────┤
                          │
                          └─ requires_approval = true ──►  PENDING_APPROVAL
                                                                │
                                                ┌───────────────┴───────────────┐
                                                ▼                               ▼
                                          (Admin Approve)                 (Admin Reject)
                                                │                               │
                                                ▼                               ▼
                                            APPROVED                        REJECTED
```

**Logic auto-approve:**
```
IF expense.requires_approval == true
   AND expense.amount < auto_approve_threshold (của loại đó)
   AND loại chi phí được phép auto-approve
THEN status = APPROVED, approved_by = SYSTEM
ELSE status = PENDING_APPROVAL, gửi notify Admin
```

### 9.3 Tập quy tắc nghiệp vụ (Business Rules)

- **R-1:** Một xe **không thể** được book overlap nhau (cùng thời điểm). *(Tạm bỏ ở MVP theo R2; đề xuất bật lại ở phase 2 dưới dạng cảnh báo mềm.)*
- **R-2:** Một tài xế **không thể** được gán 2 chuyến overlap. *(Cùng note như R-1.)*
- **R-3:** Phạm vi nhìn thấy chuyến đi:
  - Manager / Director: chỉ thấy chuyến liên quan đến mình (tạo hoặc là người sử dụng).
  - Driver: chỉ thấy chuyến mình được gán.
  - Admin: thấy toàn bộ.
- **R-4:** Driver chỉ ghi chi phí cho xe **mà mình đang/đã được gán** (trừ Admin override).
- **R-5:** Sau khi Trip `COMPLETED`, có thể gắn chi phí trong vòng **7 ngày**. Sau 7 ngày khóa lại, chỉ Admin mới ghi được.
- **R-6:** Khi expense `Accident` được tạo → tự động đặt vehicle.status = `MAINTENANCE`. Phải có Admin xác nhận trước khi đổi lại `AVAILABLE`.
- **R-7:** Khi expense `Repair` đang `PENDING_APPROVAL` → vehicle vẫn `AVAILABLE` (chưa đem đi sửa). Khi `APPROVED` và Admin đánh dấu "đang sửa" → vehicle.status = `MAINTENANCE`.
- **R-8:** Cảnh báo bảo dưỡng:
  ```
  km_chạy_từ_lần_thay_cuối = vehicle.current_odometer - vehicle.last_oil_change_km
  thời_gian_từ_lần_thay_cuối = today - vehicle.last_oil_change_date

  IF km_chạy_từ_lần_thay_cuối ≥ 80% × chu_kỳ_km
     OR thời_gian_từ_lần_thay_cuối ≥ 80% × chu_kỳ_tháng
  THEN gửi cảnh báo "Sắp đến hạn thay dầu xe {biển số}"

  IF ≥ 100% → cảnh báo khẩn cấp
  ```
- **R-9:** Link Google Maps sinh theo dạng share đường đi bao gồm origin + waypoints + destination, với địa chỉ đã được url-encode.
- **R-10:** Khi Manager tạo chuyến mà không chọn vehicle / driver, hệ thống chuyển thẳng sang Admin (notification) để gán; Manager nhận thông báo khi đã có người nhận.
- **R-11:** Nếu Driver không xác nhận / từ chối trong **X giờ** (đề xuất X = 4) → escalate cho Admin tự động.

---

## 10. Vòng Đời Chuyến Đi & Chi Phí

### 10.1 Trip Lifecycle Timeline

```
Thời gian:    T0           T1                T2              T3            T4               T5
            ────┼────────────┼─────────────────┼───────────────┼──────────────┼─────────────────┼────►
                │            │                 │               │              │                 │
              Manager       Driver           Driver         Driver           Driver           7 ngày
              tạo trip      nhận               xác nhận      bắt đầu          kết thúc           sau:
                            thông báo                        chuyến           chuyến             khóa
                                                                                                 ghi
                                                                                                 chi phí

Trạng thái: PENDING_DRIVER     →    CONFIRMED    →      IN_PROGRESS      →    COMPLETED  →   (read-only)
            _CONFIRMATION

Có thể        Sửa / Hủy           Hủy (Admin)         Cập nhật          Ghi chi phí       Chỉ Admin
              (Manager)                                trạng thái                          ghi được
                                                      thực tế
```

### 10.2 Expense Lifecycle Timeline

```
Tạo chi phí ─► [Kiểm tra loại & ngưỡng] ─┬─► Loại không cần duyệt ─► RECORDED ─► Vào báo cáo
                                          │
                                          ├─► Dưới ngưỡng auto-approve ─► APPROVED (auto) ─► Vào báo cáo
                                          │
                                          └─► Cần duyệt ─► PENDING_APPROVAL
                                                                │
                                                                ├─► Admin Approve ─► APPROVED ─► Vào báo cáo
                                                                │
                                                                └─► Admin Reject ─► REJECTED ─► Notify creator
```

### 10.3 Trip ↔ Expense Lifecycle interaction

```
TRIP                                       EXPENSE
────                                       ───────
PENDING_DRIVER_CONFIRMATION
CONFIRMED
IN_PROGRESS  ─────── driver đổ xăng ─────► Fuel expense RECORDED
             ─────── ăn trưa ─────────────► Meal expense RECORDED
COMPLETED    ─────── nộp chứng từ ────────► Repair expense PENDING_APPROVAL
             [7 ngày tiếp theo]                                │
                                                               ▼
                                                          APPROVED → Vào báo cáo
```

---

## 11. User Flows

### 11.1 Flow 1 — Manager đăng ký chuyến đi

```
[Manager mở Mobile App]
        │
        ▼
[Đăng nhập (nếu chưa)]
        │
        ▼
[Tap "Tạo chuyến đi mới"]
        │
        ▼
[Form: Date, Time, Pickup, Destination (bắt buộc)]
[+ Stopover, Driver, Vehicle, Note (tùy chọn)]
        │
        ▼
[Tap "Gửi yêu cầu"]
        │
        ▼
[Hệ thống tự sinh link Google Maps]
        │
        ▼
[Trip lưu với status = PENDING_DRIVER_CONFIRMATION (nếu đã có driver)
                          hoặc PENDING_ASSIGNMENT (nếu chưa)]
        │
        ▼
[Thông báo → Driver (nếu có) HOẶC Admin (để gán driver)]
        │
        ▼
[Manager thấy trip xuất hiện trong "Chuyến đi của tôi" kèm badge trạng thái]
        │
        ▼
[Khi Driver confirm/reject → Manager nhận thông báo]
```

### 11.2 Flow 2 — Driver xác nhận lịch

```
[Driver nhận thông báo: "Bạn có 1 chuyến mới chờ xác nhận"]
        │
        ▼
[Tap thông báo → mở chi tiết chuyến đi]
        │
        ▼
[Xem: ngày, giờ, người đi, điểm đón/đến, Maps link, ghi chú]
        │
        ▼
   ┌─── [Tap "Xác nhận"] ──► [status = CONFIRMED] ──► [notify Manager + Admin]
   │
   └─── [Tap "Từ chối"] ──► [nhập lý do] ──► [status = REJECTED_BY_DRIVER]
                                                 │
                                                 ▼
                                        [notify Admin để re-assign]
```

### 11.3 Flow 3 — Driver chạy xe

```
[Đến giờ đi]
        │
        ▼
[Driver mở chi tiết chuyến → Tap "Bắt đầu chuyến đi"]
        │
        ▼
[(Tùy chọn) Nhập số km đầu]
        │
        ▼
[status = IN_PROGRESS, ghi nhận giờ bắt đầu thực tế]
        │
        ▼
[Driver lái xe, có thể tap link Maps để dẫn đường]
        │
        ▼
[Đến nơi → Tap "Kết thúc chuyến đi"]
        │
        ▼
[(Tùy chọn) Nhập số km cuối]
        │
        ▼
[status = COMPLETED]
        │
        ▼
[Gợi ý: "Có chi phí phát sinh không? Bấm để thêm"]
```

### 11.4 Flow 4 — Driver ghi chi phí

```
[Driver mở app → "Chi phí"]
        │
        ▼
[Tap "+ Thêm chi phí"]
        │
        ▼
[Chọn xe (mặc định = xe đang/vừa lái)]
[Chọn (tùy chọn) chuyến đi liên quan]
        │
        ▼
[Chọn loại: Xăng / Dầu / Tai nạn / Ăn / Sửa chữa]
        │
        ▼
[Form trường tương ứng theo loại]
        │
        ▼
[Upload ảnh chứng từ (camera / thư viện)]
        │
        ▼
[Tap "Gửi"]
        │
        ▼
   ┌── Không cần duyệt → status = RECORDED → vào báo cáo
   │
   └── Cần duyệt → status = PENDING_APPROVAL → notify Admin
```

### 11.5 Flow 5 — Admin phê duyệt chi phí

```
[Admin nhận thông báo: "Có 1 chi phí Tai nạn chờ duyệt"]
        │
        ▼
[Mở Web App → Tab "Pending Approvals"]
        │
        ▼
[Xem danh sách, click vào expense]
        │
        ▼
[Chi tiết: loại, ngày, số tiền, mô tả, ảnh đính kèm, người tạo]
        │
        ▼
   ┌── [Approve] ──► status = APPROVED, vào báo cáo
   │
   └── [Reject + lý do] ──► status = REJECTED, notify người tạo
```

### 11.6 Flow 6 — Admin xem Dashboard & xuất báo cáo

```
[Admin mở Web App → Dashboard]
        │
        ▼
[Xem real-time: xe đang chạy / sẵn sàng / sửa chữa]
[Calendar view: chuyến đi tuần này]
[Biểu đồ: chi phí theo loại, top user]
        │
        ▼
[Chọn "Báo cáo" → loại báo cáo + khoảng thời gian]
        │
        ▼
[Preview → Tap "Export Excel" hoặc "Export PDF"]
        │
        ▼
[Tải file về máy]
```

### 11.7 Flow 7 — Cảnh báo bảo dưỡng (System-initiated)

```
[Tác vụ định kỳ chạy mỗi ngày]
        │
        ▼
[Với mỗi vehicle, tính km và thời gian từ lần thay dầu cuối]
        │
        ▼
[Nếu ≥ 80% chu kỳ → tạo Notification cho Admin]
        │
        ▼
[Admin nhận thông báo: "Xe {biển số} sắp đến hạn thay dầu (còn ~500km)"]
        │
        ▼
[Admin lên lịch bảo dưỡng → khi xong, ghi expense loại OIL]
        │
        ▼
[Hệ thống cập nhật last_oil_change_km & last_oil_change_date]
        │
        ▼
[Cảnh báo cho xe đó được reset]
```

---

## 12. Permission Matrix

> ✅ = được phép, ❌ = không, ⚠️ = có điều kiện

| Hành động | Admin | Manager / Director | Driver |
|-----------|:-----:|:------------------:|:------:|
| **Trip** |  |  |  |
| Tạo chuyến đi | ✅ | ✅ | ❌ |
| Xem tất cả chuyến đi | ✅ | ⚠️ chỉ của mình | ⚠️ chỉ chuyến được gán |
| Sửa chuyến đi | ✅ | ⚠️ trước khi driver confirm | ❌ |
| Hủy chuyến đi | ✅ | ⚠️ của mình, trước khi confirm | ❌ |
| Gán/đổi driver | ✅ | ❌ | ❌ |
| Gán/đổi vehicle | ✅ | ❌ | ❌ |
| Xác nhận / Từ chối | ❌ | ❌ | ⚠️ chuyến được gán |
| Bắt đầu / Kết thúc trip | ⚠️ override | ❌ | ✅ |
| **Expense** |  |  |  |
| Ghi chi phí | ✅ | ❌ | ✅ |
| Xem chi phí | ✅ tất cả | ⚠️ chi phí gắn trip của mình | ⚠️ chi phí mình tạo |
| Duyệt / Từ chối expense | ✅ | ❌ | ❌ |
| Sửa chi phí đã APPROVED | ✅ | ❌ | ❌ |
| **Vehicle** |  |  |  |
| Thêm / sửa / xóa xe | ✅ | ❌ | ❌ |
| Xem danh sách xe | ✅ | ✅ | ✅ |
| **User** |  |  |  |
| Thêm / sửa / xóa user | ✅ | ❌ | ❌ |
| **Report** |  |  |  |
| Xem Dashboard | ✅ | ⚠️ phạm vi giới hạn | ❌ |
| Xuất báo cáo | ✅ | ❌ | ❌ |
| **System Settings** |  |  |  |
| Cấu hình ngưỡng auto-approve | ✅ | ❌ | ❌ |
| Cấu hình chu kỳ bảo dưỡng | ✅ | ❌ | ❌ |

---

## 13. Sự Kiện & Thông Báo (Event Map)

### 13.1 Bảng sự kiện ↔ thông báo

| Sự kiện | Người nhận | Kênh |
|---------|-----------|------|
| Trip mới được tạo, đã có driver | Driver | Push + Email |
| Trip mới được tạo, chưa có driver | Admin | Push + Email |
| Driver xác nhận trip | Manager, Admin | Push |
| Driver từ chối trip | Admin, Manager | Push + Email |
| Trip bị hủy | Driver (nếu đã confirm) | Push |
| Trip sắp đến giờ (1 giờ trước) | Driver, Manager | Push |
| Trip hoàn thành | Manager | Push |
| Driver chưa xác nhận sau X giờ | Admin (escalate) | Push + Email |
| Chi phí mới chờ duyệt | Admin | Push + Email |
| Chi phí được duyệt / từ chối | Driver (người tạo) | Push |
| Cảnh báo bảo dưỡng | Admin | Push + Email |
| Tai nạn được ghi nhận | Admin (ưu tiên cao) | Push + Email |

### 13.2 Tích hợp bên ngoài

| Hệ thống ngoài | Mục đích sử dụng |
|----------------|------------------|
| **Google Maps** | Sinh link chia sẻ đường đi (origin + waypoints + destination) |
| **Hệ thống email** | Gửi thông báo qua email |
| **Push notification** | Thông báo realtime trên mobile |
| **(Phase 2) Lịch cá nhân** | Đồng bộ chuyến đi vào lịch Google/Outlook của Manager |

---

## 14. Reporting Requirements

### 14.1 Danh sách báo cáo

| Báo cáo | Bộ lọc chính | Cột chính | Định dạng |
|---------|--------------|----------|-----------|
| Chi phí theo xe | Period, vehicle | Ngày, Loại, Số tiền, Người tạo, Trạng thái | Excel/PDF |
| Chi phí theo tháng | Năm, Tháng | Xe, Breakdown theo loại, Tổng | Excel/PDF |
| Chi phí theo người dùng | Period, User | Số chuyến, Tổng chi phí | Excel/PDF |
| Lịch sử chuyến đi | Period, Vehicle/User/Driver | Ngày, Pickup, Destination, Driver, Vehicle, Trạng thái, Chi phí | Excel/PDF |
| Báo cáo tai nạn | Period | Ngày, Xe, Mô tả, Chi phí, Trạng thái, Ảnh đính kèm | Excel/PDF |
| Báo cáo sửa chữa & bảo dưỡng | Period, Vehicle | Ngày, Hạng mục, Đơn vị, Chi phí, Trạng thái | Excel/PDF |

### 14.2 Dashboard widgets

1. **Fleet status card** — đếm theo trạng thái xe.
2. **Trips this week** — số chuyến, breakdown theo trạng thái.
3. **Total cost this month** — số lớn + so sánh tháng trước (%).
4. **Cost by type** — biểu đồ tròn.
5. **Top users** — biểu đồ cột (top 5).
6. **Calendar view** — Tuần / Tháng, mỗi chuyến là 1 block.
7. **Maintenance alerts** — danh sách xe cần thay dầu / đăng kiểm.

---

## 15. Edge Cases & Open Questions

### 15.1 Câu hỏi cần xác nhận với khách hàng

| # | Vấn đề | Đề xuất |
|---|--------|---------|
| Q1 | **Mâu thuẫn về phê duyệt chi phí** giữa "phê duyệt 2 cấp" và "chỉ cần ghi nhận k cần duyệt". | Cấu hình theo loại + ngưỡng auto-approve (xem 6.2.2). **Cần chốt với khách hàng.** |
| Q2 | Conflict check đã bỏ ở R2 — có muốn cảnh báo **soft warning** (không block) không? | Đề xuất: có, hiển thị cảnh báo nhưng không chặn. |
| Q3 | Tài xế có app riêng, hay chung app với Manager (chỉ khác giao diện theo role)? | Đề xuất: chung app, định tuyến giao diện theo role. |
| Q4 | Có cần hỗ trợ **xe ngoài** (Grab / taxi thuê) trong cùng hệ thống không? | MVP: không. |
| Q5 | Tiền tệ — đa tiền tệ (VND + KRW) hay chỉ VND? | MVP: chỉ VND, phase 2 mở rộng. |
| Q6 | Báo cáo PDF có cần chữ ký số / logo công ty không? | Đề xuất: có logo + header công ty. |
| Q7 | Người sử dụng xe có thể là **người không phải user** (khách, đối tác) không? | Đề xuất: cho phép nhập tay text nếu không có trong list. |
| Q8 | Khi Driver nghỉ việc — các chuyến đã gán cho họ xử lý sao? | Đề xuất: cảnh báo Admin, tự động chuyển về `PENDING_ASSIGNMENT`. |

### 15.2 Edge cases vận hành

- E1: Driver không xác nhận trong **X giờ** → escalate cho Admin.
- E2: Driver bắt đầu trip nhưng quên kết thúc → tác vụ daily nhắc nhở.
- E3: Manager tạo trip cho ngày trong quá khứ (backfill) → cho phép, nhưng log riêng.
- E4: Xe bị đưa đi sửa giữa chuyến → Admin manual cancel + tạo trip mới với xe khác.
- E5: Mất kết nối khi driver đang nhập chi phí (mobile) → cache local, sync khi có mạng.
- E6: Upload ảnh dung lượng lớn → tự nén phía client trước khi upload.
- E7: Báo cáo > 10,000 dòng → export bất đồng bộ, gửi link tải khi xong.
- E8: Quên mật khẩu, đổi mật khẩu.
- E9: Một người dùng có thể có nhiều role không? (vd: Manager kiêm tài xế?) → đề xuất: không, mỗi user 1 role chính.
- E10: Đặt 2 chuyến gần kề (ngay sau khi kết thúc) → cần đủ thời gian buffer cho tài xế?

---

## 16. Glossary

| Thuật ngữ | Định nghĩa |
|-----------|-----------|
| **Trip** | Một chuyến đi cụ thể, có ngày giờ, điểm đón/đến, người sử dụng, tài xế, xe |
| **Stopover (Via point)** | Điểm dừng / ghé giữa pickup và destination |
| **Expense** | Khoản chi phí phát sinh, gắn vào 1 xe và (tùy chọn) 1 chuyến đi |
| **Auto-approve threshold** | Ngưỡng số tiền mà chi phí dưới ngưỡng được duyệt tự động |
| **Fleet** | Toàn bộ đội xe của công ty |
| **Odometer** | Số km hiển thị trên đồng hồ công-tơ-mét xe |
| **Period** | Khoảng thời gian dùng để lọc báo cáo (vd: tháng, quý, custom range) |
| **MVP** | Minimum Viable Product — phiên bản tối thiểu khả dụng |
| **Persona** | Chân dung đại diện cho một nhóm người dùng |
| **MoSCoW** | Phương pháp ưu tiên: Must / Should / Could / Won't have |
| **Audit trail** | Nhật ký truy vết: ai làm gì, khi nào |
| **Escalate** | Đẩy sự việc lên cấp cao hơn xử lý (vd: Driver không phản hồi → đẩy cho Admin) |
| **Backfill** | Nhập dữ liệu cho thời điểm trong quá khứ |
| **Single source of truth** | Nguồn dữ liệu duy nhất, mọi người tham chiếu cùng một chỗ |

---

**End of document.**
*Tài liệu này là phiên bản consolidated tập trung vào phân tích nghiệp vụ — không cố định công nghệ. Đội phát triển có tự do thiết kế kỹ thuật miễn là đáp ứng các yêu cầu chức năng và phi chức năng nêu trên.*
