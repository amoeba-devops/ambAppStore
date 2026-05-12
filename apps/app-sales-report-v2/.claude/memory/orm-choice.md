---
name: ORM choice — Drizzle
description: Chọn Drizzle thay vì Prisma cho Neon Postgres trong v2
type: project
---

**Quyết định**: Drizzle ORM với `@neondatabase/serverless` HTTP driver (`drizzle-orm/neon-http`). Prisma loại.

**Why** (2026-05-11):
- Drizzle edge-compatible, hợp Next.js App Router + Server Action
- Type-safe nhưng vẫn gần với SQL → migration review dễ hơn schema-first của Prisma
- `neon-http` không cần connection pool → fit serverless
- Bundle size nhỏ hơn Prisma Client

**Trade-off**:
- Drizzle docs ít hơn Prisma → cần document pattern trong `.claude/skills/drizzle-neon/SKILL.md`
- Migration story ít mature hơn → bù bằng review SQL trước commit

**How to apply**:
- Schema files: `packages/db/src/schema/<table>.schema.ts`
- KHÔNG đụng vào Prisma — nếu thấy `prisma.*` trong code thì sai
- Khi cần raw SQL: dùng tagged template `sql\`SELECT ...\`` của Drizzle (không string concat)
- Migration generate qua `drizzle-kit generate`, KHÔNG dùng `push` trên staging/prod
