---
name: Client context — FIRGI / Socialbean Vietnam
description: Khách hàng, người liên hệ, phạm vi nghiệp vụ chính của Sales Report v2
type: project
---

**Client**: Socialbean Vietnam Co., Ltd.
**Internal brand**: FIRGI (Sales Report Application)
**Document author (client side)**: Truc Hoang
**SRD version**: v2.0, dated 2026-05-06 (Document ID: FIRGI-SRS-SALESREPORT-001)

**Business context**:
- Bán hàng tiêu dùng trên Shopee Vietnam + TikTok Shop Vietnam
- Báo cáo cho đối tác Hàn Quốc → cần KRW conversion
- Quy mô nhỏ: 1–5 concurrent users (operations team)
- Volume: ~52 weeks/year × 2 platforms = ~104 weekly reports

**Why** (2026-05-11): Khi đụng vấn đề "client muốn gì" — đây là tổ chức + người ra spec. KHÔNG được nhầm với Socialbean Korea hay nhãn khác.

**How to apply**:
- Tài liệu chính thức tham chiếu: [docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md](../../docs/analysis/SRD-20260506-FIRGI-SalesReport-v2.md)
- Câu hỏi nghiệp vụ → ping Truc Hoang qua channel/email tương ứng (chưa biết)
- Open issues OI-001 (overwrite/append) và OI-002 (definition of "finalized") cần Truc Hoang chốt
- Khi viết error message hoặc i18n string khách-thấy: dùng "Sales Report" hoặc "FIRGI" — KHÔNG "ambManagement" / "AMA"
