import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../app.module';
import { EmbeddingService } from '../domain/search-core/service/embedding.service';

/**
 * hsm_hs_references 임베딩 백필 (Phase 0, R1 전제).
 * hsr_embedding IS NULL 인 유효 행을 BGE-M3(TEI)로 임베딩 → pgvector 채움.
 * - 멱등: NULL 행만 대상. 중단 후 재실행 안전(이미 채워진 행 재처리 안 함).
 * - 무한루프 방지: 빈 품명 제외 + 배치 전량 실패(공급자 다운) 시 중단.
 *
 * 실행: nest build 후  `node dist/scripts/backfill-embeddings`
 *       (npm run backfill:embeddings). BACKFILL_BATCH_SIZE 로 배치 크기 조정.
 */
async function main(): Promise<void> {
  const logger = new Logger('BackfillEmbeddings');
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'warn', 'error'],
  });
  try {
    const ds = app.get(DataSource);
    const embedding = app.get(EmbeddingService);

    if (!embedding.isEnabled) {
      logger.error(
        'Embedding provider disabled — set EMBEDDING_PROVIDER + EMBEDDING_ENDPOINT. Aborting.',
      );
      process.exitCode = 1;
      return;
    }

    const batchSize = Math.max(1, Number(process.env.BACKFILL_BATCH_SIZE ?? '64'));
    const WHERE =
      `hsr_embedding IS NULL AND hsr_deleted_at IS NULL ` +
      `AND hsr_description IS NOT NULL AND btrim(hsr_description) <> ''`;

    const [{ count }] = (await ds.query(
      `SELECT COUNT(*)::int AS count FROM hsm_hs_references WHERE ${WHERE}`,
    )) as { count: number }[];
    logger.log(`Rows to backfill: ${count} (batch ${batchSize})`);

    let total = 0;
    for (;;) {
      const rows = (await ds.query(
        `SELECT hsr_id, hsr_description FROM hsm_hs_references
          WHERE ${WHERE}
          ORDER BY hsr_created_at ASC
          LIMIT $1`,
        [batchSize],
      )) as { hsr_id: string; hsr_description: string }[];
      if (rows.length === 0) break;

      const vecs = await embedding.embedBatch(rows.map((r) => r.hsr_description));
      let updated = 0;
      for (let i = 0; i < rows.length; i++) {
        const v = vecs[i];
        if (!v) continue;
        await ds.query(`UPDATE hsm_hs_references SET hsr_embedding = $1::vector WHERE hsr_id = $2`, [
          embedding.toVectorLiteral(v),
          rows[i].hsr_id,
        ]);
        updated++;
      }
      total += updated;
      logger.log(`Batch ${updated}/${rows.length} embedded (cumulative ${total})`);

      // 배치 전량 실패(예: TEI 다운) → 무한루프 방지.
      if (updated === 0) {
        logger.error('Batch produced 0 embeddings (provider error?). Stopping.');
        process.exitCode = 1;
        break;
      }
    }
    logger.log(`Backfill complete. Total embedded: ${total}`);
  } finally {
    await app.close();
  }
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exitCode = 1;
});
