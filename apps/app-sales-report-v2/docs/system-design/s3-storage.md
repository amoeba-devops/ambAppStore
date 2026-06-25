---
title: S3 Storage
description: Presigned URL upload, versioning, archive on overwrite, key naming convention.
load-when: Implementing file upload/download, archive policy, S3 cleanup, debugging S3 access.
status: skeleton
---

# S3 Storage

> Skeleton — fill examples khi implement upload pipeline.

## 1. Stack

- **AWS S3** ap-southeast-1 (Singapore — sát VN)
- **@aws-sdk/client-s3** + **@aws-sdk/s3-request-presigner**
- Bucket: `amb-sales-report-v2` per env (dev/staging/prod via key prefix)

## 2. Key naming convention

```
TODO: pattern
{env}/{ent_id}/{upload_session_id}/{report_type}/{timestamp}-{filename}

Example:
  prod/01234567-uuid-ent/01abcd-session/SHOPEE_SALES/2026-04-12T10:30:00Z-shopee-export.csv
```

## 3. Upload flow (presigned URL — direct browser upload)

```
TODO: diagram
1. Client → Server Action `requestUploadUrl(filename, mime)`
2. Server: generate presigned PUT URL (expires 5min)
3. Client → PUT directly to S3 (không qua server)
4. Client → Server Action `confirmUpload(s3Key)` → save record to sal_uploaded_files + INSERT into sal_upload_sessions status='PENDING'
5. Background Worker polls DB → parse
```

Why presigned: file >10MB không nên qua server function (memory + bandwidth lãng phí).

## 4. Download flow

```
TODO: pattern
- Internal: read directly via @aws-sdk in Server Component
- User download: presigned GET URL (expires 1h)
```

## 5. Archive on overwrite (OI-001 requirement)

Khi user re-upload cùng section + period:
```
TODO: pattern
1. Move existing S3 object to archive/ prefix
   - Source: prod/<ent>/<session>/SHOPEE_SALES/file.csv
   - Dest:   archive/prod/<ent>/<session>/SHOPEE_SALES/2026-05-11-file.csv
2. Upload new file to original path
3. Update sal_uploaded_files row pointing to new key
4. Old key reference kept in audit log
```

## 6. Versioning

Bật S3 bucket versioning → automatic. Nếu cần rollback file: list versions, restore.

→ Khác với "archive" — versioning là transparent, archive là explicit copy với timestamp.

## 7. Lifecycle policy

```
TODO: bucket lifecycle config
- archive/ prefix: transition to S3 IA after 30 days, Glacier after 90 days
- Don't auto-delete (audit retention)
```

## 8. Cost optimization

| Tier | Use for |
|---|---|
| S3 Standard | Recent raw files (< 30 days) |
| S3 IA | Archive (30-90 days) |
| Glacier | Long-term audit (> 90 days) |

Estimate cost: ~100GB/year × $0.023/GB = ~$28/year. Negligible.

## 9. Permissions

IAM policy per env:
- Dev: full access cho dev bucket
- Prod: server role only (no public bucket)
- Bucket policy: deny public access by default

```
TODO: IAM template
```

## 10. Anti-patterns ❌

- ❌ Stream upload qua server cho file lớn — use presigned URL
- ❌ Public bucket access — luôn private + presigned
- ❌ Hard-code bucket name — use env var
- ❌ Key chứa user input không sanitize — risk injection
- ❌ Skip versioning trên prod bucket — mất rollback option
- ❌ Synchronously delete trong overwrite — phải archive trước (NFR-06 unmodified)

## See also

- [_INDEX.md](_INDEX.md)
- [background-jobs.md](background-jobs.md) — Worker pickup after upload
- [../analysis/UPLOAD-FLOW-20260511.md](../analysis/UPLOAD-FLOW-20260511.md) — UX driving S3 design
- [../architecture/DEPLOYMENT.md](../architecture/DEPLOYMENT.md) §3.2 — env vars
- AWS S3 docs: https://docs.aws.amazon.com/s3/
