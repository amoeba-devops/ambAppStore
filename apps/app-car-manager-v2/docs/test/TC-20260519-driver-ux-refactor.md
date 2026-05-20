# TC-20260519 — Driver UI/UX Refactor

> **REQ ref**: REQ-20260519 · **PLAN ref**: PLAN-20260519
> **Date**: 2026-05-19
> **Test type**: Manual visual + interaction tests. Automated test suite (Playwright) sẽ làm ở P6 Hardening.

## Pre-conditions
- Local dev: `cd apps/app-car-manager-v2/apps/web && npm run dev`
- Login as Driver: AMA `MEMBER` role mapped → app `DRIVER`
- Have at least 1 trip assigned to driver với mỗi state: `PENDING_DRIVER_CONFIRMATION`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`

## Test cases

### TC-A1 — Button size `2xl` renders correctly
| Step | Expected |
|---|---|
| 1. `<Button size="2xl">Accept</Button>` in any page | Renders 56px tall, padding 24px, icon 20px |
| 2. Compare with size `xl` | `2xl` strictly larger than `xl` (h-14 vs h-11) |

### TC-A2 — `<DriverActionBar>` stickiness
| Step | Expected |
|---|---|
| 1. Scroll trang dùng DriverActionBar đến cuối | Bar luôn dán đáy viewport |
| 2. Trên iPhone với home indicator | Padding bottom safe-area: bar không đè home indicator |
| 3. Trên desktop ≥md | Bar vẫn hoạt động, không bị broken layout |

### TC-A3 — `<BottomSheet>` open / close
| Step | Expected |
|---|---|
| 1. Open BottomSheet trên mobile width 375px | Slide từ đáy lên, rounded-top, overlay với blur |
| 2. Tap overlay | Sheet đóng |
| 3. Swipe down trên handle | Sheet đóng (nếu impl) — không bắt buộc cho V1 |
| 4. Open trên desktop ≥md | Sheet vẫn slide từ bottom (acceptable behavior) |
| 5. Keyboard open khi focus textarea | Sheet không bị che bởi keyboard (max-h-[80vh]) |

### TC-B1 — `/today` Driver mode — PENDING_DRIVER_CONFIRMATION trip
| Step | Expected |
|---|---|
| 1. Login as Driver có trip status `PENDING_DRIVER_CONFIRMATION` hôm nay | Page render với hero "Chờ xác nhận của bạn" |
| 2. Visible elements | Passenger name, route, scheduled time, vehicle plate |
| 3. Sticky bottom area | 2 buttons: "Từ chối" (danger) + "Chấp nhận" (accent), size `2xl` |
| 4. Tap "Chấp nhận" | `acceptTripAction` fires → toast success → trip status đổi sang `CONFIRMED` → bar swap sang "Bắt đầu chuyến" |

### TC-B2 — `/today` Driver mode — CONFIRMED trip near start time
| Step | Expected |
|---|---|
| 1. Trip status = `CONFIRMED`, scheduled <60 phút | Hero hiển thị "Bắt đầu trong N phút" |
| 2. Sticky bottom | 1 button "Bắt đầu chuyến" size `2xl` accent |
| 3. Tap | `startTripAction` → toast → status `IN_PROGRESS` → bar swap "Kết thúc chuyến" |

### TC-B3 — `/today` Driver mode — IN_PROGRESS trip
| Step | Expected |
|---|---|
| 1. Trip status = `IN_PROGRESS` | Hero "Đang chạy" với gradient accent→info |
| 2. Sticky bottom | 1 button "Kết thúc chuyến" size `2xl` primary |
| 3. Tap | `endTripAction` → toast → status `COMPLETED` → next trip hero hoặc empty state |

### TC-B4 — `/today` Driver mode — empty
| Step | Expected |
|---|---|
| 1. Driver không có trip nào hôm nay | EmptyState với icon Calendar + message "Không có chuyến nào hôm nay" |
| 2. Có CTA "Xem tất cả chuyến" → `/trips?driver=me` | Link works |

### TC-B5 — `/today` Manager/Admin mode unchanged
| Step | Expected |
|---|---|
| 1. Login as Manager/Admin | Page render giống AS-IS: NextTripHero + Later today list |
| 2. KHÔNG có DriverActionBar | Bar không xuất hiện |
| 3. KHÔNG có FAB expense | FAB không hiện |

### TC-B6 — FAB expense entry
| Step | Expected |
|---|---|
| 1. Driver mở `/today` | FAB "Record expense" hiện ở góc dưới phải, above DriverActionBar |
| 2. Tap FAB | Navigate to `/expenses/new` |
| 3. Trên empty state | FAB vẫn hiện |

### TC-C1 — Trip detail driver view — sticky bar
| Step | Expected |
|---|---|
| 1. Driver mở `/trips/<id>` cho trip mình được assign | Status row top, map ~35vh, route timeline, passenger fold |
| 2. Scroll xuống | Sticky `<DriverActionBar>` luôn ở đáy với primary CTA |
| 3. Tap action | Action thực hiện như TC-B1/B2/B3 |
| 4. Content KHÔNG bị bar che | `pb-32` trên container giúp last item không bị khuất |

### TC-C2 — Trip detail — passenger fold
| Step | Expected |
|---|---|
| 1. Mở trip detail | "More details" `<details>` collapsed |
| 2. Tap summary | Mở passenger card + email/phone + notes + driver phone |
| 3. Tap email | `mailto:` mở mail app |
| 4. Tap phone (nếu có passengerPhone) | `tel:` mở dialer |

### TC-C3 — Reject / Cancel BottomSheet
| Step | Expected |
|---|---|
| 1. Driver tap "Reject" trên trip PENDING_DRIVER_CONFIRMATION | BottomSheet slide up từ đáy (không phải Dialog) |
| 2. Type reason ngắn (<3 char) | Submit button disabled |
| 3. Type reason ≥3 char + tap Confirm | `rejectTripAction({reason})` fires → toast → sheet close → page refresh |
| 4. Admin tap "Cancel trip" | Cùng pattern BottomSheet |

### TC-C4 — Admin Assign flow vẫn hoạt động
| Step | Expected |
|---|---|
| 1. Admin tap "Assign" trên trip PENDING_ASSIGNMENT | BottomSheet với driver + vehicle picker |
| 2. Pick driver + vehicle có conflict | TripConflictBanner hiện trong sheet |
| 3. Submit | `assignTripAction` fires, trip → PENDING_DRIVER_CONFIRMATION |

### TC-D1 — `/expenses/new` route accessible
| Step | Expected |
|---|---|
| 1. Driver navigate `/expenses/new` direct URL | Page render với form |
| 2. PageHeader title "Ghi nhận chi phí" |
| 3. Form visible: type chip grid, amount, date, note, receipt |

### TC-D2 — ExpenseTypeChipGrid
| Step | Expected |
|---|---|
| 1. Render | 8 chips: Fuel/Oil/Meal/Repair/Parking/Toll/Accident/Inspection |
| 2. Tap chip "Fuel" | Selected state: ring-2 ring-accent + bg-accent-soft |
| 3. Tap chip khác | Selection swap, chỉ 1 chip selected |
| 4. Keyboard nav | Arrow keys di chuyển focus (radiogroup) |

### TC-D3 — AmountInput
| Step | Expected |
|---|---|
| 1. Focus input trên mobile | Numpad bung ra (inputMode="decimal") |
| 2. Type 1250000 | Display "1.250.000₫" |
| 3. Backspace | Hoạt động đúng |
| 4. Type non-digit | Reject hoặc strip |

### TC-D4 — ReceiptCameraInput
| Step | Expected |
|---|---|
| 1. Tap "📷 Chụp ảnh" trên iPhone PWA | Camera permission prompt → mở camera → chụp |
| 2. Sau khi chụp | Thumbnail hiện trong preview grid |
| 3. Tap X trên thumbnail | Remove khỏi state |
| 4. Upload 6 files | Reject file thứ 6 + show error "Tối đa 5 ảnh" |
| 5. Upload file 10MB | Reject + show error "Tối đa 5MB" |

### TC-D5 — Submit expense (stub)
| Step | Expected |
|---|---|
| 1. Fill all required, tap "Gửi" | `submitExpenseAction` called |
| 2. Console log | "[STUB submitExpenseAction]" với payload |
| 3. Toast success | "Đã gửi chi phí. Đang chờ duyệt." |
| 4. Note "Chế độ thử nghiệm" hiển thị | trong form footer hoặc toast description |
| 5. Navigate | Quay về `/today` |

### TC-D6 — Submit expense — validation
| Step | Expected |
|---|---|
| 1. Missing type | Submit button disabled hoặc error message |
| 2. Amount = 0 | Error "Số tiền phải > 0" |
| 3. Missing date | Default to today (no error) |
| 4. Note empty | OK (optional) |
| 5. Receipt empty | OK (optional cho stub) |

### TC-D7 — Expense with tripId pre-fill
| Step | Expected |
|---|---|
| 1. Navigate `/expenses/new?tripId=abc123` | Hidden tripId field set |
| 2. Submit | Payload bao gồm `tripId: 'abc123'` trong stub log |

### TC-E1 — i18n switch
| Step | Expected |
|---|---|
| 1. Switch locale vi → en → ko | Tất cả text driver-mode đổi theo |
| 2. Missing key | next-intl fallback to key (no crash) |

### TC-E2 — A11y
| Step | Expected |
|---|---|
| 1. Tab through DriverActionBar buttons | Focus visible với ring |
| 2. Screen reader đọc Accept button | "Chấp nhận chuyến đi" (aria-label) |
| 3. Status badge contrast trên gradient | ≥4.5:1 (manual check) |
| 4. Form labels associate với inputs | Tab/screen reader announce label |

### TC-E3 — Reduced motion
| Step | Expected |
|---|---|
| 1. OS setting prefers-reduced-motion | BottomSheet slide animation tắt |
| 2. DriverActionBar không animate vào | Static position |

## Cross-cutting

### TC-X1 — Typecheck pass
- `cd apps/app-car-manager-v2 && npx tsc --noEmit -p apps/web/tsconfig.json` → exit 0

### TC-X2 — Lint pass
- `npm run lint` từ root → no new errors

### TC-X3 — Build pass
- `npm run build` từ web → no error

### TC-X4 — PWA standalone không escape Safari
- Install PWA on iPhone, mở `/today`, tap accept/reject/start → ở trong standalone window, không bị bounce sang Safari
- Test camera capture trên expense form trong PWA standalone

### TC-X5 — Manager / Admin regression
- Login Manager → `/today` view giữ nguyên
- Login Admin → assign trip vẫn dùng được (BottomSheet thay Dialog)
- Login Admin → `/costs` admin approval view không bị ảnh hưởng

## Acceptance criteria summary

- [ ] All TC-A pass (design tokens)
- [ ] All TC-B pass (Driver Today)
- [ ] All TC-C pass (Trip detail driver)
- [ ] All TC-D pass (Expense submit shell)
- [ ] All TC-E pass (i18n + a11y)
- [ ] All TC-X pass (cross-cutting + regression)
- [ ] No new console errors
- [ ] No new TypeScript errors
- [ ] Documented stub mode trong submit success toast
