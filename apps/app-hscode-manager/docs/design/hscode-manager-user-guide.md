---
document_id: HSCODE-MGR-GUIDE-1.0.0
version: 1.0.0
status: Draft
created: 2026-06-23
updated: 2026-06-23
author: 김익용
reviewers: []
change_log:
  - version: 1.0.0
    date: 2026-06-23
    author: 김익용
    description: Initial draft — user guide
---

# HS Code Manager — User Guide (HS코드 매니저 사용자 가이드)

## Getting Started (시작하기)
- **Access**: open the HS Code Manager web app and choose one of three tabs — Q&A, Barcode, Attribute/Excel.
- **Permissions**: standard users can search; importing reference files and resolving the review queue require admin rights.

## Basic Usage (기본 사용법)

### 1. Q&A Search (질문응답 검색)
1. Open the **Q&A** tab and describe your product in plain language (Korean, English, or Vietnamese), e.g. "automatic sewing machine for car airbags, used".
2. If the system needs more detail, it asks one question at a time (material, usage, processing state). Answer it.
3. Review the candidate cards — each shows the HS code, matched product description, origin, unit, and a confidence score.
4. Click a candidate to see details and confirm your final HS code.
- **Tip**: more specific descriptions (material, function, processing state) yield better matches.

### 2. Barcode (GTIN) Lookup (바코드 조회)
1. Open the **Barcode** tab, enter the GTIN (8/12/13/14 digits), and select the **destination country** (required).
2. Press **Resolve**. The system validates the barcode, then resolves the HS code through its 4-layer pipeline.
3. The result shows the national HS code (8–10 digit), duty rate, the resolution source, and a confidence score.
- **Note**: if the barcode is unknown, you'll be guided to the Attribute or Q&A search instead.
- **Important**: the result is a **recommendation**; final HS confirmation is the importer/exporter's responsibility.

### 3. Attribute / Excel Search (속성/엑셀 검색)
1. Open the **Attribute/Excel** tab.
2. Either fill in the structured form, or upload an Excel file using the provided template (click **Template** to download the blank form).
3. The system validates your file and reports any row errors. Fix and re-upload if needed.
4. Each row is classified with an HS code and confidence; low-confidence rows are flagged.
5. Click **Download results** to export an Excel with HS code, confidence, and source columns appended.

## FAQ (자주 묻는 질문)

| Question | Answer |
|----------|--------|
| Why does the barcode need a destination country? | HS6 is global, but the full 8–10 digit code and duty rate are country-specific. |
| The barcode wasn't found — what now? | The system falls back to Attribute/Q&A search using any product info it retrieved. |
| Why does it keep asking me questions? | Candidates were too close to call; each answer narrows the result (up to 5 questions). |
| Can I trust the HS code for filing? | It's a recommendation. You remain responsible for the final declared HS code. |
| What Excel format is required? | Use the downloadable template; the system validates columns before processing. |

## Troubleshooting (문제 해결)

| Symptom | Cause | Resolution |
|---------|-------|------------|
| "Invalid GTIN" | Check-digit failed | Re-check the barcode digits |
| Upload rejected | Template mismatch | Download the template and match columns |
| "No confident match" (Q&A) | Description too vague | Add material/usage/processing detail |
| "Pending review" (barcode) | Low classifier confidence | A reviewer will verify; check back later |
| Slow Excel processing | Large batch | Large files run asynchronously; watch the progress bar |
