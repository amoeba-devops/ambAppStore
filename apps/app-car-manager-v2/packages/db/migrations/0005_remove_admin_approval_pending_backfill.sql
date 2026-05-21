-- Backfill PENDING expenses to AUTO_APPROVED after admin approval flow removal.
--
-- Context: user-flow §3.2 was updated to "bỏ admin duyệt" — every new expense
-- now lands in AUTO_APPROVED at submit time (see expense-approval.service.ts).
-- Existing rows submitted before this change may still carry expStatus =
-- PENDING (REPAIR ≥ 1M VND, all ACCIDENT). Those rows would otherwise be
-- stranded forever because no /costs admin queue exists anymore.
--
-- Treatment:
--   - PENDING → AUTO_APPROVED (the explicit auto-decision now applies retro)
--   - APPROVED / REJECTED rows are left untouched — they already reflect a
--     final admin verdict from before the flow was removed.
--
-- Note on enum cleanup: PENDING / APPROVED / REJECTED values stay in
-- car_expense_status because Postgres can't drop enum values without rebuilding
-- the column. Keeping them inert is fine — the application code only writes
-- AUTO_APPROVED going forward.

UPDATE car_expenses
SET exp_status = 'AUTO_APPROVED'
WHERE exp_status = 'PENDING';
