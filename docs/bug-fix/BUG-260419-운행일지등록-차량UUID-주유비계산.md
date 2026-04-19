# BUG-260419: 운행일지 등록 — 차량 Invalid UUID + 주유비 자동계산

**발견일**: 2026-04-19
**심각도**: Major
**상태**: Fixed

---

## 1. 버그 현상

- 운행일지 등록 시 차량 선택 후 저장하면 "Invalid UUID" 에러
- 주유량(L) + 리터당 비용 입력 시 주유비 자동 계산 기능 없음

## 2. 원인 분석

### 2.1 차량 UUID 불일치

```tsx
// TripLogFormPage.tsx line 105-108
vehicles.map((v: { vehicleId: string; ... }) => (
  <option key={v.vehicleId} value={v.vehicleId}>
```

API 응답 필드는 `cvhId`이지만 코드에서 `vehicleId`를 참조 → `undefined` → Zod UUID 검증 실패.
운전자도 동일: `d.driverId`는 정상이지만 `d.driverName`이 null 가능.

### 2.2 주유비 자동계산

`fuel_amount`(L) × 리터당 단가를 입력하면 `fuel_cost`가 자동 계산되어야 하지만,
현재는 각각 독립 입력 필드.

## 3. 수정 방안

1. 차량 select: `v.vehicleId` → `v.cvhId`
2. 운전자 select: `d.driverName` null fallback
3. 주유: fuel_amount + fuel_unit_price → fuel_cost 자동 계산 (watch + setValue)
