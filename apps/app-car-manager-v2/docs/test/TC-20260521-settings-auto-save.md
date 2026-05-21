# TC-20260521 — Settings Auto-Save Test Cases

Based on [PLAN-20260521-settings-auto-save.md](../plan/PLAN-20260521-settings-auto-save.md). Manual test cases (no Vitest suite yet per CLAUDE.md §6 P6).

**Pre-conditions**: Logged in as ADMIN, `/settings` page accessible.

---

## TC-1: Lazy seed on first load

| Step | Action | Expected |
|---|---|---|
| 1.1 | Truy cập `/settings` lần đầu cho tenant chưa có row | Page render thành công với default values (currency=VND, timezone=Asia/Ho_Chi_Minh, all notif=true, retention=5) |
| 1.2 | Kiểm tra DB: `SELECT * FROM car_tenant_settings WHERE ent_id = '<ent>'` | 1 row mới được seed với defaults |
| 1.3 | Refresh page | Vẫn render đúng giá trị từ DB (không seed lại) |

---

## TC-2: Tenant Name auto-save (debounce 500ms)

| Step | Action | Expected |
|---|---|---|
| 2.1 | Gõ ký tự đầu tiên vào input | Input update value ngay, KHÔNG fire action |
| 2.2 | Tiếp tục gõ thêm 5 ký tự liên tiếp (< 500ms giữa các keypress) | Vẫn KHÔNG fire action |
| 2.3 | Dừng gõ 500ms+ | Toast `Đã lưu` xuất hiện; DB row `tns_tenant_name` = giá trị mới |
| 2.4 | DB: kiểm tra `car_audit_logs` | 1 row mới: `action='SETTINGS.UPDATE'`, `audAfter.field='tenantName'`, `audAfter.value=<new>` |
| 2.5 | Xoá hết input → debounce → save | DB cột nullable → set NULL, toast `Đã lưu` |
| 2.6 | Gõ chuỗi 121 ký tự | Toast error "Tenant name max 120 chars" + input revert hoặc giữ giá trị (UX: giữ để user edit lại) |

---

## TC-3: Currency Select

| Step | Action | Expected |
|---|---|---|
| 3.1 | Đổi từ VND → KRW | Toast `Đã lưu`; DB `tns_currency='KRW'`; audit log entry |
| 3.2 | Đổi sang USD | Tương tự |
| 3.3 | Refresh page | Select hiển thị USD (persisted) |

---

## TC-4: Timezone Select

| Step | Action | Expected |
|---|---|---|
| 4.1 | Đổi từ Asia/Ho_Chi_Minh → Asia/Seoul | Toast + persist + audit |
| 4.2 | Refresh | Hiển thị Seoul |
| 4.3 | (Edge) Gọi action trực tiếp với `timezone='Invalid/Tz'` qua devtools | 400 + `CAR-E0001` + UI revert |

---

## TC-5: Notification preferences (3 toggles)

| Step | Action | Expected |
|---|---|---|
| 5.1 | Tắt "In-app" toggle | Switch animate to off ngay; toast `Đã lưu`; DB `tns_notif_inapp=false` |
| 5.2 | Bật lại | Tương tự ngược lại |
| 5.3 | Tắt "Email" + tắt "Digest" liên tiếp | 2 toast + 2 audit row, DB cả 2 column = false |
| 5.4 | Push toggle (existing component) | Vẫn hoạt động như cũ — không bị regression |

---

## TC-6: Retention selects

| Step | Action | Expected |
|---|---|---|
| 6.1 | Đổi Trip records từ "5 years" → "1 year" | Toast + persist + audit; `tns_retention_trip_years=1` |
| 6.2 | Đổi Audit log → "Indefinite" | `tns_retention_audit_years=NULL` |
| 6.3 | Đổi Audit log → "3 years" | `tns_retention_audit_years=3` |

---

## TC-7: Authz — non-Admin role

| Step | Action | Expected |
|---|---|---|
| 7.1 | Login as MANAGER, mở `/settings` | Trang render đầy đủ nhưng tất cả controls disabled + banner "View only" |
| 7.2 | Hack: gọi `updateTenantNameAction` qua devtools | Response: `{success:false, error:{code:'CAR-E0102', message:'Forbidden: requires ADMIN'}}` |
| 7.3 | Login as DRIVER, mở `/settings` | (Nếu route accessible) Tương tự MANAGER. Hoặc redirect to `/today` tuỳ middleware. |

---

## TC-8: Approval Rules card removed

| Step | Action | Expected |
|---|---|---|
| 8.1 | Mở `/settings` | KHÔNG còn card "Expense approval rules" |
| 8.2 | Grep code: `APPROVAL_RULES` | Không match (constant đã xoá) |
| 8.3 | Grep i18n: `"approval":` trong messages/*.json | Không có key `settings.approval*` (đã clean) |

---

## TC-9: Save status indicator

| Step | Action | Expected |
|---|---|---|
| 9.1 | Gõ tenantName chậm | Sau debounce, toast `Đang lưu…` (loading) thoáng qua → `Đã lưu` (success) |
| 9.2 | Disconnect network → đổi currency | Toast `Lưu lỗi: <message>` (error); UI revert về giá trị trước |
| 9.3 | Reconnect → thử lại | Persist thành công |

---

## TC-10: Concurrent edits

| Step | Action | Expected |
|---|---|---|
| 10.1 | Mở `/settings` ở 2 browser tabs (cùng admin) | Cả 2 hiển thị cùng dữ liệu |
| 10.2 | Tab A: đổi tenantName → save | Tab A toast success |
| 10.3 | Tab B: đổi currency → save | Tab B toast success; DB merged (tenantName mới + currency mới) |
| 10.4 | Refresh cả 2 tab | Cả 2 hiển thị state mới merge |

---

## TC-11: i18n

| Step | Action | Expected |
|---|---|---|
| 11.1 | Đổi locale → en | Toast/label hiện English (`Saved`, `Tenant name`, ...) |
| 11.2 | Đổi locale → ko | Tương tự Korean (`저장됨`, `테넌트 이름`, ...) |
| 11.3 | Grep `"saveStatus"` trong 3 file vi/en/ko | Tồn tại đủ 3 |

---

## TC-12: Migration safety

| Step | Action | Expected |
|---|---|---|
| 12.1 | Chạy migration 0006 trên dev DB sạch | `CREATE TABLE` + `CREATE TYPE` + `CREATE INDEX` thành công |
| 12.2 | Chạy lại migration | SHOULD fail rõ ràng (table exists) — hoặc dùng IF NOT EXISTS guards (preferred) |
| 12.3 | Rollback: `DROP TABLE car_tenant_settings; DROP TYPE car_currency;` | Thành công |
| 12.4 | Existing data: chạy `SELECT * FROM car_trips LIMIT 1` sau migration | Không bị ảnh hưởng |

---

**Definition of Done**: TC-1 → TC-12 đều PASS. Sẽ record kết quả trong [TR-20260521-settings-auto-save.md](TR-20260521-settings-auto-save.md).
