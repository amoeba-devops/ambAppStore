# REQ-20260512 — PRD vs SRS vs Prototype Audit

> **Status**: ✅ Resolved · **Decision date**: 2026-05-12
> **Resolution**: Bám PRD.md cho MVP. SRS gốc và prototype là tham chiếu, không phải spec.
> **Stakeholder**: dev@amoeba.group (decision maker)

---

## 1. Mục đích audit

Khi P0 foundation hoàn tất và bắt đầu lên kế hoạch P1 Trip MVP, phát hiện trong folder `resources/claude-design/uploads/` có **SRS gốc của khách hàng** (file `.docx`, 147 dòng). Cần đối chiếu 3 nguồn:

1. **SRS gốc** (`resources/claude-design/uploads/COMPANY CAR MANAGEMENT SYSTEM.docx`) — yêu cầu khách hàng ban đầu
2. **PRD.md** — bản consolidated do team xây cho MVP (968 dòng)
3. **Prototype** (`resources/claude-design/`) — Claude Design export, 24+ screens

Mục tiêu: chốt source of truth duy nhất, đảm bảo MVP đi đúng scope, không over-engineer theo prototype hoặc under-deliver so với SRS.

---

## 2. Nguồn đã quét

| Nguồn | Path | Kích thước |
|---|---|---|
| SRS gốc | `resources/claude-design/uploads/COMPANY CAR MANAGEMENT SYSTEM.docx` | 18 KB · 147 paragraphs · 4,681 chars tiếng Việt |
| SRS duplicate | `resources/claude-design/uploads/COMPANY CAR MANAGEMENT SYSTEM-9b840a90.docx` | Byte-identical (md5: fd64152a) |
| PRD | `PRD.md` | 968 dòng tiếng Việt |
| Prototype | `resources/claude-design/{tokens,ui,app,design-canvas,tweaks-panel,ios-frame}.jsx + 16 screens/*.jsx` | ~15,000 dòng JSX |
| Prototype entry | `resources/claude-design/index.html` + `index-print.html` + `car-management-standalone.html` | Multi-format |

---

## 3. Findings

### 3.1 ✅ Đã khớp 3 nguồn (15 items)

| # | Item | Verdict |
|---|---|---|
| 1 | 3 personas (Admin / Manager-Director / Driver) | ✓ |
| 2 | Web + Mobile platform | ✓ |
| 3 | 3 xe ban đầu, extensible | ✓ |
| 4 | Trip status flow (PRD mở rộng từ "chưa xác nhận / đã / từ chối") | ✓ PRD enrich hợp lý |
| 5 | 5 cost categories core (Fuel/Oil/Accident/Meal/Repair) | ✓ |
| 6 | 2-level approval flow | ✓ |
| 7 | Accident: bắt buộc upload ảnh + Admin duyệt | ✓ |
| 8 | Maintenance oil change alert | ✓ |
| 9 | CRUD Vehicle/Driver/User | ✓ |
| 10 | Maintenance lock | ✓ |
| 11 | Audit log | ✓ |
| 12 | Dashboard (KPI + calendar + cost mix + top users) | ✓ |
| 13 | Export Excel/PDF | ✓ |
| 14 | Google Maps integration | ✓ |
| 15 | SSO / Email login | ✓ (PRD: AMA JWT passthrough — extension chính đáng) |

### 3.2 ⚠️ Divergences đã chốt (7 items)

| # | Item | SRS gốc | Prototype | PRD | **Chốt MVP** | Lý do |
|---|---|---|---|---|---|---|
| D1 | Trip Driver field | bắt buộc §2.1 | `required` (trips.jsx:244) | tùy chọn FR-1.1 | **PRD = tùy chọn** | Cho phép Manager tạo nhanh, Admin gán sau (linh hoạt vận hành) |
| D2 | Trip Vehicle field | bắt buộc §2.1 | `required` (trips.jsx:238) | tùy chọn FR-1.1 | **PRD = tùy chọn** | Cùng lý do D1 |
| D3 | Schedule conflict check | có §2.2 | có UI (banner + calendar pill + reassign conflicts) | "loại bỏ R2" FR-1.2 | **KHÔNG implement MVP** | Đã decision ở R2; có thể bật lại như soft-warning ở phase 2 |
| D4 | Ngôn ngữ UI | EN + KR §1.2 | EN+KR+VI | EN+KR+VI | **3 ngôn ngữ** | Khách công ty VN, end-user là KR + VN drivers; mở rộng EN+KR của SRS là chính đáng |
| D5 | Cost categories | 5 §2.4 | 8 (5 + Parking/Toll/Inspection) | 8 §6.2 | **8 trong MVP** | Parking/Toll thực tế phát sinh thường xuyên trong vận hành VN; Inspection daily checklist là module riêng nhưng gộp vào MVP cho tiện |
| D6 | GPS turn-by-turn navigation | không | **6 screens** (driver-trip-nav.jsx) | Won't-have §1.3 "GPS tracking real-time" | **KHÔNG implement** | PRD đã loại trừ rõ ràng; prototype vẽ overscope; cần native APIs + ongoing GPS cost → phase 3+ |
| D7 | Driver Performance Card · AI Insight panel · Driver Availability toggle | không | có (DriverPerformanceCard, AI Insight trong DashboardB, DriverAvailability mobile) | không nhấn mạnh | **KHÔNG implement MVP** | Nice-to-have, defer; AI Insight cần backend LLM + dữ liệu lịch sử |

### 3.3 ⚠️ PRD ADD-ON beyond SRS (5 items — technical necessity)

| # | Item | Lý do PRD thêm | Verdict MVP |
|---|---|---|---|
| E1 | Multi-tenancy `ent_id` mọi bảng | App sống trên AMA platform, mỗi Entity tenant phải isolation | ✅ MUST |
| E2 | Soft delete (`*_deleted_at`) | Tuân nguyên tắc audit + retention 5 năm | ✅ MUST |
| E3 | Retention 5 năm (NFR-10) | Tuân compliance (kế toán + thuế VN) | ✅ MUST |
| E4 | next-intl runtime i18n + 3 locale files | Implementation detail của yêu cầu i18n | ✅ MUST |
| E5 | Mobile = web PWA thay vì React Native | Pragmatic: 1 codebase, install-able, offline cache | ✅ MUST (P5) |

---

## 4. Resolution

**Bám PRD.md cho MVP.** Cụ thể:

1. **Schema layer** (drizzle):
   - `car_trips.trp_driver_id NULL` + `car_trips.trp_vehicle_id NULL` (D1, D2)
   - 8 values trong enum `car_expense_type` (D5)
   - Mọi bảng có `ent_id`, `*_deleted_at`, timestamps đầy đủ (E1, E2)

2. **Service layer**:
   - `trip-state-machine.service` — state transitions theo PRD §9.1
   - **KHÔNG** implement conflict check service (D3)
   - **KHÔNG** implement GPS tracking (D6)

3. **UI layer**:
   - Port tokens + primitives + DashboardA ✅ (đã làm P0)
   - Port screens TripsList / NewTripForm / TripDetail từ prototype trong P1 (visual reference)
   - **KHÔNG** port screen turn-by-turn nav (D6)
   - **KHÔNG** port Driver Performance / AI Insight (D7)
   - Form fields: theo SRS+prototype visual nhưng required marker theo PRD (D1, D2)

4. **i18n**:
   - Giữ 3 dictionary EN/KR/VI (D4)
   - Default locale = VI

5. **Cost categories** (D5): seed `car_approval_rules` cho 8 loại theo CLAUDE.md §4.8:
   ```
   FUEL, OIL_CHANGE, PARKING, TOLL    → requires_approval=false
   MEAL                                → requires_approval=false (warn > 500k)
   ACCIDENT                            → requires_approval=true (luôn)
   REPAIR_MAINTENANCE                  → requires_approval=true, auto_threshold=1M
   INSPECTION                          → requires_approval=false (daily checklist, không phải chi phí)
   ```
   Lưu ý: `INSPECTION` thực ra là **vehicle inspection log**, không phải expense. Cần tách thành bảng riêng `car_inspections` (CLAUDE.md §4.3 đã có).

---

## 5. Action items

### Đã thực hiện (2026-05-12 session)

- ✅ CLAUDE.md §1.1 — bổ sung Source of truth hierarchy table
- ✅ CLAUDE.md §1.2 — quy tắc khi 3 nguồn mâu thuẫn (bám PRD)
- ✅ CLAUDE.md §1.3 — cập nhật "8 loại chi phí MVP"
- ✅ CLAUDE.md §3 — folder tree thêm `resources/` + `docs/`
- ✅ CLAUDE.md §8 — thêm 2 dòng "Cấm" về divergence
- ✅ CLAUDE.md §9 — bảng divergence table 7 items + 4 quy tắc áp dụng
- ✅ Audit doc này (`REQ-20260512-prd-srs-audit.md`)

### Cần làm khi vào P1 (Trip MVP)

- [ ] Tạo `docs/plan/PLAN-YYYYMMDD-trip-mvp.md` reference quy tắc D1/D2 (nullable FK)
- [ ] Schema `car_trips` — declare driver_id, vehicle_id nullable + state enum 6 values theo §9.1
- [ ] Server Action `create-trip.action.ts` — KHÔNG validate driver/vehicle là required; KHÔNG check conflict
- [ ] Port UI `NewTripForm` — visual theo prototype, required markers theo PRD (Date, Time, Pickup, Destination là bắt buộc, Driver+Vehicle optional)

### Cần làm khi vào P2 (Expense MVP)

- [ ] Schema `car_expenses.exp_type` enum 8 values
- [ ] Schema `car_inspections` (tách khỏi expense, không phải chi phí)
- [ ] Seed `car_approval_rules` per `ent_id` theo bảng §4.8

### Cần hỏi khách hàng (không block MVP, nhưng nên xác nhận)

- [ ] Tiếng Việt extension — chính thức OK với KH chưa? (đang assume OK vì khách VN)
- [ ] Parking/Toll/Inspection — KH có thật sự dùng? (đã giả định YES per PRD §6.2)
- [ ] Retention 5 năm — đúng chuẩn compliance KH cần không?
- [ ] Schedule conflict check — phase 2 muốn bật lại dạng soft warning không?
- [ ] GPS navigation — confirm Won't-have hay phase 3+ feature?

> Khi KH trả lời 5 câu trên, log vào `docs/analysis/REQ-YYYYMMDD-customer-followup.md` và update PRD.md tương ứng (gắn version bump).

---

## 6. Quy tắc cho future sessions

Khi Claude (future session) hoặc team member làm việc trên `app-car-manager-v2`:

1. **Đọc PRD.md trước**, KHÔNG đọc SRS gốc trước khi đụng tới spec MVP.
2. **Reference prototype cho visual**, KHÔNG cho business logic.
3. **Khi nghi ngờ mâu thuẫn**, check CLAUDE.md §9 divergence table.
4. **Khi gặp item không có trong §9 mà 3 nguồn đá nhau**, tạo audit mới `docs/analysis/REQ-YYYYMMDD-{topic}.md`, đề xuất resolution, hỏi stakeholder.
5. **Không tự ý expand scope** dù prototype có UI đẹp — feature phải có trong PRD MVP scope.

---

**Closed by**: dev@amoeba.group · **Date**: 2026-05-12
