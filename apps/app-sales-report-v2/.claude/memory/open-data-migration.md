---
name: Open — Data migration from v1
description: Chưa quyết định có import dữ liệu v1 (MySQL) sang v2 (Neon Postgres) hay fresh start
type: project
---

**Trạng thái**: OPEN — chưa chốt.

**Bối cảnh**: v1 dùng MySQL với integer PK (TypeORM), v2 dùng Postgres với UUID CHAR(36). Nếu import:
- Phải viết script transform PK → UUID
- Phải re-upload file Excel raw vào S3 nếu cần audit
- Cần map lại `ent_id` (có thể v1 chưa có ent_id rõ ràng)

**Why**: User chưa nói rõ là continue data v1 hay là dự án fresh start.

**How to apply**:
- Hỏi user trước khi viết PLAN-* tiếp theo
- Nếu fresh start: bỏ qua, MVP nhanh hơn
- Nếu cần import: phải có 1 phase riêng `scripts/migrate-from-v1.ts` + acceptance test compare CM v1 vs v2 cho period mẫu
