---
name: drizzle-neon
description: Drizzle ORM conventions cho Neon Postgres serverless trong app-sales-report-v2. Dùng khi viết schema, query, migration.
---

# Skill: drizzle-neon

## Khi nào dùng
- Viết schema mới trong `packages/db/src/schema/`
- Query phức tạp (join, aggregate)
- Tạo migration
- Optimize query slow

## Setup khuyến nghị

```ts
// packages/db/src/client.ts
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });
```

Dùng `neon-http` (không phải `neon-serverless`) cho edge/serverless — không cần kết nối persistent.

Nếu cần transaction (Excel batch insert), dùng `neon-serverless` driver hoặc Postgres connection trực tiếp:
```ts
// packages/db/src/client-pool.ts
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const dbTx = drizzle(pool, { schema });
```

## Schema convention

1 file per bảng tại `packages/db/src/schema/<table>.schema.ts`:

```ts
// schema/sku.schema.ts
import { pgTable, char, varchar, decimal, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';

export const salSkus = pgTable('sal_skus', {
  skuId: char('sku_id', { length: 36 }).primaryKey(),
  entId: char('ent_id', { length: 36 }).notNull(),
  spuId: char('spu_id', { length: 36 }).notNull(),
  skuCode: varchar('sku_code', { length: 64 }).notNull(),
  skuNameVi: varchar('sku_name_vi', { length: 255 }),
  skuNameEn: varchar('sku_name_en', { length: 255 }),
  skuPrimeCostVnd: decimal('sku_prime_cost_vnd', { precision: 15, scale: 2 }),
  skuSellingPriceVnd: decimal('sku_selling_price_vnd', { precision: 15, scale: 2 }),
  skuListingPriceVnd: decimal('sku_listing_price_vnd', { precision: 15, scale: 2 }),
  skuIsActive: boolean('sku_is_active').notNull().default(true),
  skuCreatedAt: timestamp('sku_created_at', { withTimezone: true }).defaultNow().notNull(),
  skuUpdatedAt: timestamp('sku_updated_at', { withTimezone: true }),
  skuDeletedAt: timestamp('sku_deleted_at', { withTimezone: true }),
}, (t) => ({
  uniqEntCode: uniqueIndex('uniq_sal_skus_ent_code').on(t.entId, t.skuCode),
  idxEntSpu: index('idx_sal_skus_ent_spu').on(t.entId, t.spuId),
}));

export type SalSku = typeof salSkus.$inferSelect;
export type SalSkuInsert = typeof salSkus.$inferInsert;
```

**Rules**:
- DB column: `snake_case` (đối số đầu của `char()`/`varchar()` etc.)
- TS property: `camelCase` (key trong object)
- PK luôn CHAR(36) — dùng UUID v4 generate ở app layer (`crypto.randomUUID()`)
- KHÔNG dùng serial / int PK

## Relations

```ts
// schema/relations.ts (file riêng)
import { relations } from 'drizzle-orm';
import { salSpus, salSkus, salSkuCostHistory } from './';

export const salSpusRelations = relations(salSpus, ({ many }) => ({
  skus: many(salSkus),
}));

export const salSkusRelations = relations(salSkus, ({ one, many }) => ({
  spu: one(salSpus, { fields: [salSkus.spuId], references: [salSpus.spuId] }),
  costHistory: many(salSkuCostHistory),
}));
```

## Query patterns

### Multi-tenancy helper
```ts
// packages/db/src/lib/with-ent.ts
import { eq } from 'drizzle-orm';

export function withEnt<T extends { entId: any }>(table: T, entId: string) {
  return eq(table.entId, entId);
}
```

### Standard list
```ts
const skus = await db
  .select()
  .from(salSkus)
  .where(and(
    withEnt(salSkus, entId),
    isNull(salSkus.skuDeletedAt),
  ))
  .orderBy(desc(salSkus.skuCreatedAt))
  .limit(50);
```

### Join
```ts
const result = await db
  .select({
    sku: salSkus,
    spuName: salSpus.spuNameVi,
  })
  .from(salSkus)
  .innerJoin(salSpus, eq(salSkus.spuId, salSpus.spuId))
  .where(withEnt(salSkus, entId));
```

### Batch insert (Excel parser)
```ts
const CHUNK = 500;
for (let i = 0; i < rows.length; i += CHUNK) {
  await db.insert(salRawOrders).values(rows.slice(i, i + CHUNK));
}
```

### Aggregate
```ts
import { sql, sum, count } from 'drizzle-orm';

const result = await db
  .select({
    totalGmv: sum(salRawOrders.netGmvVnd),
    orderCount: count(salRawOrders.ordId),
  })
  .from(salRawOrders)
  .where(withEnt(salRawOrders, entId));
```

### Upsert
```ts
await db.insert(salReports)
  .values(newReport)
  .onConflictDoUpdate({
    target: [salReports.entId, salReports.repGranularity, salReports.repPeriodStart],
    set: { repNetGmvVnd: newReport.repNetGmvVnd, /* ... */ },
  });
```

## Migration

```bash
# Generate SQL từ schema diff
pnpm drizzle-kit generate

# Apply lên dev (fast iter)
pnpm drizzle-kit push

# Apply lên staging/prod (migration history)
pnpm drizzle-kit migrate
```

`drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/schema/*.schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  verbose: true,
  strict: true,
});
```

## Soft delete

```ts
// Helper
export async function softDelete<T extends { entId: any; ... }>(table: T, id: string, entId: string) {
  return db.update(table)
    .set({ [`${prefix}DeletedAt`]: new Date() })
    .where(and(eq(table[pkCol], id), eq(table.entId, entId)));
}

// Default query helper
function notDeleted<T extends { ...DeletedAt: any }>(table: T) {
  return isNull(table[`${prefix}DeletedAt`]);
}
```

## Anti-patterns ❌

- ❌ Raw SQL string concat → SQL injection (dùng `sql` tagged template)
- ❌ Query không có `entId` filter → multi-tenant leak
- ❌ `.then()` chain trên Drizzle query (đã là Promise, await thẳng)
- ❌ Tạo nhiều client `drizzle()` instances → connection leak
- ❌ `synchronize: true` → KHÔNG có, đã safe
- ❌ Migration không review SQL trước commit
