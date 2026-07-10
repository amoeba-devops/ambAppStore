/** 문서 업로드 매칭 비동기 큐 (BullMQ). */
export const MATCHING_QUEUE = 'matching-process';

/** 워커 동시성 — 2코어 + CPU TEI 보호를 위해 낮게 유지. */
export const MATCHING_WORKER_CONCURRENCY = 3;
