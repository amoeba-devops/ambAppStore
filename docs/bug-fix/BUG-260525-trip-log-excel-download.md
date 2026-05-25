# BUG-260525: 운행일지 Excel 다운로드 동작 안 함

**발견일**: 2026-05-25
**심각도**: Major (FR 핵심 기능 미구현 — 버튼만 존재)
**상태**: Open
**리포트**: 사용자 — "Không thể tải file Excel - Danh sách Trip Log"
**대상**: app-car-manager (v1) — `/app-car-manager/trip-logs`

---

## 1. 버그 현상

- 운행일지 목록 페이지의 **Excel 다운로드** 버튼을 눌러도 아무 일도 일어나지 않음
- 네트워크 요청 0건, 콘솔 에러 없음 → 사용자는 "버튼이 죽었다"고 느낌
- Import (업로드)는 정상 작동

---

## 2. 원인 분석

> **요약**: Excel 다운로드 기능이 **양쪽에서 완전 미구현**. UI에 버튼만 placeholder로 들어가 있고, 백엔드 export 엔드포인트도, 프론트엔드 API 메서드도 존재하지 않음.

### 2.1 프론트엔드 — 버튼은 있으나 `onClick` 없음 ❌

[apps/app-car-manager/frontend/src/pages/TripLogListPage.tsx:89-92](apps/app-car-manager/frontend/src/pages/TripLogListPage.tsx#L89-L92):

```tsx
<button className="flex items-center gap-1.5 rounded-lg border border-[#d4d8e0] bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
  <Download className="h-4 w-4" />
  {t('tripLog.excelDownload')}
</button>
```

→ `onClick` 핸들러 없음. 클릭해도 `default action`(submit) 조차 안 일어남 (form 컨텍스트 밖).

### 2.2 프론트엔드 API — 메서드 없음 ❌

[apps/app-car-manager/frontend/src/services/api.ts:67-79](apps/app-car-manager/frontend/src/services/api.ts#L67-L79) `tripLogApi`:
- `getAll`, `getById`, `create`, `update`, `submit` 만 존재
- `exportExcel` / `download` 류 메서드 0건

### 2.3 백엔드 — 엔드포인트 없음 ❌

[apps/app-car-manager/backend/src/domain/trip-log/controller/trip-log.controller.ts](apps/app-car-manager/backend/src/domain/trip-log/controller/trip-log.controller.ts):
- `GET /`, `GET /:id`, `POST /`, `PATCH /:id`, `PATCH /:id/submit`, `POST /import` 만 매핑
- `GET /export`, `GET /:id/excel` 류 0건

`backend/package.json`에 `exceljs ^4.4.0` 이미 설치되어 있음 ([package.json:25](apps/app-car-manager/backend/package.json#L25)) — Import용으로 쓰는 라이브러리를 Export 에도 그대로 활용 가능.

---

## 3. 수정 방안

### 3.1 Backend — Excel Export 서비스 + 컨트롤러

신규 파일: `apps/app-car-manager/backend/src/domain/trip-log/service/excel-export.service.ts`

```typescript
@Injectable()
export class ExcelExportService {
  async buildTripLogWorkbook(tripLogs: TripLogEntity[]): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('TripLogs');
    ws.columns = [
      { header: '날짜', key: 'date', width: 12 },
      { header: '차량번호', key: 'plate', width: 14 },
      { header: '운전자', key: 'driver', width: 16 },
      { header: '출발', key: 'origin', width: 20 },
      { header: '도착', key: 'destination', width: 20 },
      { header: '거리(km)', key: 'distance', width: 10 },
      { header: '주유량(L)', key: 'fuelAmount', width: 10 },
      { header: '주유비', key: 'fuelCost', width: 12 },
      { header: '통행료', key: 'tollCost', width: 12 },
      { header: '사고여부', key: 'hasAccident', width: 8 },
      { header: '상태', key: 'status', width: 12 },
      { header: '비고', key: 'note', width: 30 },
    ];
    for (const tl of tripLogs) {
      ws.addRow({ ... });
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
```

신규 엔드포인트: `GET /api/v1/trip-logs/export` (라우트 순서상 `:id` 보다 위에 배치)

```typescript
@Auth()
@Get('export')
async export(
  @CurrentUser() user: AmaJwtPayload,
  @Query('vehicle_id') vehicleId: string | undefined,
  @Query('status') status: string | undefined,
  @Res({ passthrough: false }) res: Response,
) {
  const tripLogs = await this.tripLogService.findAll(user.ent_id, { vehicleId, status });
  const buf = await this.excelExportService.buildTripLogWorkbook(tripLogs);
  const filename = `trip-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buf);
}
```

> 라우트 등록 순서 중요: `@Get(':id')` 보다 위에 두어야 `:id="export"` 로 잘못 매칭되지 않음.

### 3.2 Frontend — API + 버튼

[services/api.ts](apps/app-car-manager/frontend/src/services/api.ts) `tripLogApi` 확장:

```typescript
exportExcel: (params?: { vehicle_id?: string; status?: string }) =>
  apiClient.get('/v1/trip-logs/export', {
    params,
    responseType: 'blob',
  }),
```

[TripLogListPage.tsx](apps/app-car-manager/frontend/src/pages/TripLogListPage.tsx) handler:

```typescript
const handleExport = async () => {
  try {
    const res = await tripLogApi.exportExcel(
      vehicleFilter ? { vehicle_id: vehicleFilter } : undefined,
    );
    const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trip-logs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch {
    showToast(t('tripLog.excelDownloadError'), 'error');
  }
};
```

버튼에 `onClick={handleExport}` 추가.

### 3.3 i18n

기존 `tripLog.excelDownload` 활용. 새 키 `tripLog.excelDownloadError` 추가 (ko/en/vi).

---

## 4. 영향 범위

| 영역 | 파일 | 변경 |
|------|------|------|
| Backend | `excel-export.service.ts` | 신규 |
| Backend | `trip-log.controller.ts` | 엔드포인트 1개 추가 |
| Backend | `trip-log.module.ts` | provider 등록 |
| Frontend | `services/api.ts` | `tripLogApi.exportExcel` 추가 |
| Frontend | `TripLogListPage.tsx` | handler + onClick 추가, currentMonth 필터 반영 |
| i18n | `car.json` x3 | `excelDownloadError` 키 추가 |

**사이드 임팩트**:
- Import 흐름과 격리 (별도 서비스, 별도 엔드포인트)
- 필터 currentMonth는 FE에서만 처리 중이므로 export는 BE 필터 (vehicle, status) + FE 클라이언트 측 월 필터 → MVP에서는 **현재 화면 표시되는 모든 데이터 export** (월 필터 무시) 또는 **vehicle_id만 BE로 전달**. 일단 단순하게 BE는 vehicle_id/status만 받음 → 추후 month 파라미터 추가 가능.

---

## 5. 테스트 시나리오

| # | 시나리오 | 기대 결과 |
|---|----------|----------|
| 1 | 버튼 클릭 (필터 없음) | xlsx 다운로드, 모든 trip log 행 포함 |
| 2 | 차량 필터 적용 후 클릭 | 해당 차량 trip log만 포함 |
| 3 | trip log 0건 | 헤더만 있는 빈 xlsx |
| 4 | 다른 ent_id (직접 API) | 자기 법인 데이터만 포함 (격리 보존) |
| 5 | Excel을 열면 한글/UTF-8 정상 |  |

---

## 6. 재현

```sh
# 클릭 → 아무 일도 안 일어남
# 콘솔에 에러 없음 (그냥 onClick이 없으므로)
```
