# DATA-MODEL — Sales Report v2 (FIRGI)

> Neon Postgres. Naming theo root [CLAUDE.md](../../../../CLAUDE.md): table `sal_{plural}`, column `{prefix}_{name}`, PK CHAR(36) UUID.
> Tuân thủ [SRD §3 + §5 + §6](../analysis/SRD-20260506-FIRGI-SalesReport-v2.md).
> **⚠️ Updates từ real data scan** (xem [REAL-DATA-FINDINGS-20260511.md](../analysis/REAL-DATA-FINDINGS-20260511.md)):
> - Shopee: 1 consolidated CSV (6 sections) thay vì 6 file riêng
> - TikTok: 5 sections (thêm ADS + PLATFORM FEE so với SRD 3 sections)
> - Cần thêm 2 bảng `sal_raw_tiktok_ads`, `sal_raw_tiktok_platform_fee` (chưa scaffold trong v1 data model bên dưới)
> - Free Gift detection dùng prefix `[GIFT]` cho cả 2 platform
> - `sal_reports` cần thêm cột: `rep_finalize_count`, `rep_last_unfinalized_by`, `rep_last_unfinalized_at` (theo [oi-resolutions](../../.claude/memory/oi-resolutions.md))

## 1. Bảng — phân nhóm

```
1. User & Auth         → sal_users
2. Upload session      → sal_upload_sessions, sal_uploaded_files
3. Raw reports (9)     → sal_raw_shopee_*, sal_raw_tiktok_*
4. Cost master         → sal_prime_costs, sal_prime_cost_versions, sal_cogs, sal_cogs_updates
5. Manual inputs       → sal_manual_inputs, sal_fx_rates
6. Calculation output  → sal_product_metrics, sal_platform_metrics, sal_reports
7. Formula config      → sal_formula_configs, sal_formula_config_history
8. Activity logs       → sal_log_login, sal_log_action, sal_log_download
```

## 2. User & Auth

### `sal_users`
Cache user info từ AMA passthrough + map role local.
| Column | Type | Note |
|---|---|---|
| `usr_id` | CHAR(36) PK | UUID (KHÁC AMA user id) |
| `ent_id` | CHAR(36) NOT NULL | từ AMA JWT |
| `usr_ama_user_id` | CHAR(36) NOT NULL | AMA `sub` claim |
| `usr_email` | VARCHAR(255) | |
| `usr_name` | VARCHAR(255) | |
| `usr_local_role` | ENUM | `OPERATOR`, `MANAGER`, `ADMIN` |
| `usr_ama_role_snapshot` | VARCHAR(32) | role gần nhất từ AMA |
| `usr_last_login_at` | TIMESTAMPTZ | |
| `usr_created_at` / `usr_updated_at` | | |
| UNIQUE(`ent_id`, `usr_ama_user_id`) | | |

## 3. Upload session (FR-01, FR-02, FR-03)

### `sal_upload_sessions`
Một session = một date range, có thể chứa nhiều file.
| Column | Type | Note |
|---|---|---|
| `ups_id` | CHAR(36) PK | |
| `ent_id` / `usr_id` (creator) | | |
| `ups_period_start` / `ups_period_end` | DATE NOT NULL | start ≤ end |
| `ups_granularity` | ENUM | `WEEKLY`, `MONTHLY` |
| `ups_status` | ENUM | `OPEN`, `PARSING`, `READY`, `FINALIZED` |
| `ups_finalized_at` | TIMESTAMPTZ NULL | set khi first download (NFR-08) |
| `ups_created_at` / `ups_updated_at` | | |
| UNIQUE(`ent_id`, `ups_period_start`, `ups_period_end`, `ups_granularity`) | | OI-001: overwrite same-period |

### `sal_uploaded_files`
Mỗi file trong session.
| Column | Type | Note |
|---|---|---|
| `upf_id` | CHAR(36) PK | |
| `ent_id` / `ups_id` | | |
| `upf_platform` | ENUM | `SHOPEE`, `TIKTOK` |
| `upf_report_type` | ENUM | xem §3.1 |
| `upf_s3_key` | VARCHAR(512) | raw file unmodified (NFR-06) |
| `upf_s3_hash` | CHAR(64) | sha256 |
| `upf_original_filename` | VARCHAR(255) | |
| `upf_size_bytes` | BIGINT | |
| `upf_row_count` | INT NULL | sau parse |
| `upf_status` | ENUM | `UPLOADED`, `PARSING`, `PARSED`, `FAILED` |
| `upf_error_log` | TEXT NULL | first 10 errors |
| `upf_uploaded_at` / `upf_parsed_at` | | |
| UNIQUE(`ups_id`, `upf_platform`, `upf_report_type`) | | replace re-upload |

### 3.1 ENUM `upf_report_type`
| Platform | Type code |
|---|---|
| SHOPEE | `SALES`, `ADS`, `BRAND_ADS`, `OFF_PLATFORM_ADS`, `TRAFFIC`, `AFFILIATE` |
| TIKTOK | `SALES`, `TRAFFIC`, `AFFILIATE` |

## 4. Raw reports (9 bảng, mỗi report type 1 bảng)

> Strategy: **schema-on-read** với JSONB columns + extracted indexed columns. Mỗi raw row giữ `raw_data JSONB` toàn bộ giá trị gốc; các trường core extract ra column riêng để index/query.

### 4.1 `sal_raw_shopee_sales`
Core columns extract:
| Column | Type | Note |
|---|---|---|
| `rss_id` | CHAR(36) PK | |
| `ent_id` / `upf_id` | | |
| `rss_order_id` | VARCHAR(64) | |
| `rss_order_status` | VARCHAR(32) | "Đã hủy" etc. (exclusion §5.6 SRD) |
| `rss_product_id` | VARCHAR(64) | |
| `rss_variation_id` | VARCHAR(64) | |
| `rss_sku` | VARCHAR(64) | "SKU phân loại hàng" |
| `rss_original_price` | DECIMAL(15,2) | "Giá gốc" |
| `rss_quantity` | INT | "Số lượng" |
| `rss_quantity_returned` | INT | "Số lượng sản phẩm được hoàn trả" |
| `rss_nmv` | DECIMAL(15,2) | "Tổng số tiền Người mua thanh toán" |
| `rss_voucher_shop` | DECIMAL(15,2) | "Mã giảm giá của Shop" |
| `rss_combo_shop` | DECIMAL(15,2) | "Giảm giá từ Combo của Shop" |
| `rss_platform_fee_fixed` | DECIMAL(15,2) | "Phí cố định" |
| `rss_platform_fee_service` | DECIMAL(15,2) | "Phí Dịch Vụ" |
| `rss_platform_fee_payment` | DECIMAL(15,2) | "Phí thanh toán" |
| `rss_raw_data` | JSONB | full row backup |
| `rss_order_date` | DATE | |
| `rss_created_at` | | |
| INDEX(`ent_id`, `upf_id`), INDEX(`ent_id`, `rss_sku`, `rss_order_date`) | | |

### 4.2 `sal_raw_shopee_ads`
| Column | Type | Note |
|---|---|---|
| `rsa_id` PK / `ent_id` / `upf_id` | | |
| `rsa_product_id` | VARCHAR(64) | |
| `rsa_sku` | VARCHAR(64) | |
| `rsa_ad_spending` | DECIMAL(15,2) | "Chi phí" |
| `rsa_ad_gmv` | DECIMAL(15,2) | "Doanh số" |
| `rsa_raw_data` | JSONB | |

### 4.3 `sal_raw_shopee_brand_ads`
| Column | Type | Note |
|---|---|---|
| `rsb_id` PK / `ent_id` / `upf_id` | | |
| `rsb_expense` | DECIMAL(15,2) | "Expense" |
| `rsb_raw_data` | JSONB | |

### 4.4 `sal_raw_shopee_off_platform_ads`
| Column | Type | Note |
|---|---|---|
| `rso_id` PK / `ent_id` / `upf_id` | | |
| `rso_cost` | DECIMAL(15,2) | "Chi phí" |
| `rso_raw_data` | JSONB | |

### 4.5 `sal_raw_shopee_traffic`
| Column | Type | Note |
|---|---|---|
| `rst_id` PK / `ent_id` / `upf_id` | | |
| `rst_product_id` | VARCHAR(64) | |
| `rst_page_views` | INT | "Lượt xem trang sản phẩm" |
| `rst_raw_data` | JSONB | |

### 4.6 `sal_raw_shopee_affiliate`
| Column | Type | Note |
|---|---|---|
| `rsf_id` PK / `ent_id` / `upf_id` | | |
| `rsf_cost_vnd` | DECIMAL(15,2) | "Chi phí (đ)" |
| `rsf_raw_data` | JSONB | |

### 4.7 `sal_raw_tiktok_sales`
| Column | Type | Note |
|---|---|---|
| `rts_id` PK / `ent_id` / `upf_id` | | |
| `rts_order_id` / `rts_order_status` / `rts_order_substatus` | | exclusion §5.6 |
| `rts_seller_sku` | VARCHAR(64) | |
| `rts_normal_or_preorder` | VARCHAR(32) | for free gift rule |
| `rts_product_name` | VARCHAR(255) | starts with [GIFT]? |
| `rts_sku_unit_original_price` | DECIMAL(15,2) | |
| `rts_quantity` | INT | |
| `rts_sku_quantity_returned` | INT | |
| `rts_sku_seller_discount` | DECIMAL(15,2) | |
| `rts_net_gmv` | DECIMAL(15,2) | |
| `rts_gmv` | DECIMAL(15,2) | |
| `rts_raw_data` | JSONB | |

### 4.8 `sal_raw_tiktok_traffic`
| Column | Type | Note |
|---|---|---|
| `rtt_id` PK / `ent_id` / `upf_id` | | |
| `rtt_pv_shop_tab` | INT | "Lượt xem trang từ tab Cửa hàng" |
| `rtt_pv_live` | INT | từ Live |
| `rtt_pv_video` | INT | từ video |
| `rtt_pv_product_card` | INT | từ thẻ sản phẩm |
| `rtt_raw_data` | JSONB | |

### 4.9 `sal_raw_tiktok_affiliate`
| Column | Type | Note |
|---|---|---|
| `rtf_id` PK / `ent_id` / `upf_id` | | |
| `rtf_commission_cost_vnd` | DECIMAL(15,2) | "Chi phí (đ)" |
| `rtf_estimated_commission` | DECIMAL(15,2) | "Hoa hồng ước tính" |
| `rtf_raw_data` | JSONB | |

## 5. Cost master (FR-05, FR-06, versioned NFR-08)

### `sal_prime_costs`
Current state — 1 record per SKU.
| Column | Type | Note |
|---|---|---|
| `pcm_id` | CHAR(36) PK | |
| `ent_id` | | |
| `pcm_product_id` | VARCHAR(64) | |
| `pcm_variation_id` | VARCHAR(64) | |
| `pcm_sku` | VARCHAR(64) NOT NULL | |
| `pcm_product_name_vi` | VARCHAR(255) | |
| `pcm_product_name_en` | VARCHAR(255) | |
| `pcm_prime_cost_vnd` | DECIMAL(15,2) | |
| `pcm_selling_price_vnd` | DECIMAL(15,2) | |
| `pcm_listing_price_vnd` | DECIMAL(15,2) | |
| `pcm_is_active` | BOOLEAN | |
| `pcm_created_at` / `pcm_updated_at` / `pcm_deleted_at` | | |
| UNIQUE(`ent_id`, `pcm_sku`) | | |

### `sal_prime_cost_versions`
Append-only history.
| Column | Type | Note |
|---|---|---|
| `pcv_id` | CHAR(36) PK | |
| `ent_id` / `pcm_id` | | |
| `pcv_sku` | VARCHAR(64) | denorm cho query speed |
| `pcv_prime_cost_vnd` | DECIMAL(15,2) | |
| `pcv_selling_price_vnd` | DECIMAL(15,2) | |
| `pcv_listing_price_vnd` | DECIMAL(15,2) | |
| `pcv_changed_by` | CHAR(36) | usr_id |
| `pcv_change_reason` | VARCHAR(255) NULL | |
| `pcv_effective_from` | TIMESTAMPTZ | |

→ Khi calc: `WHERE pcv_effective_from <= report_period_start ORDER BY pcv_effective_from DESC LIMIT 1`.

### `sal_cogs`
Tương tự `sal_prime_costs` nhưng có column "date update" theo SRD FR-06.
| Column | Type | Note |
|---|---|---|
| `cog_id` PK / `ent_id` | | |
| `cog_product_id` / `cog_variation_id` / `cog_sku` | | |
| `cog_product_name_vi` / `cog_product_name_en` | | |
| `cog_prime_cost_vnd` | DECIMAL(15,2) | |
| `cog_last_update_date` | DATE | "Prime Cost [date] Update" |
| `cog_created_at` / `cog_updated_at` | | |
| UNIQUE(`ent_id`, `cog_sku`, `cog_last_update_date`) | | multiple records same SKU OK |

→ Lookup rule: `WHERE cog_sku = ? AND cog_last_update_date <= report_period ORDER BY cog_last_update_date DESC LIMIT 1`.

## 6. Manual inputs (FR-04)

### `sal_manual_inputs`
Mỗi field 1 record per period (đơn giản, dễ audit).
| Column | Type | Note |
|---|---|---|
| `mni_id` | CHAR(36) PK | |
| `ent_id` / `ups_id` | | gắn với upload session period |
| `mni_field_code` | VARCHAR(64) | xem §6.1 ENUM |
| `mni_value_vnd` | DECIMAL(15,2) | |
| `mni_period_start` / `mni_period_end` | DATE | |
| `mni_created_by` / `mni_updated_by` | CHAR(36) | usr_id |
| `mni_created_at` / `mni_updated_at` / `mni_deleted_at` | | |
| UNIQUE(`ent_id`, `mni_field_code`, `mni_period_start`) | | |

### 6.1 ENUM `mni_field_code`
```
AFFILIATE_BOOKING_FEE_TOTAL       (Shopee + TikTok combined)
SHOPEE_LIVESTREAM_FEE
TIKTOK_LIVESTREAM_FEE
TIKTOK_AD_SPENDING
TIKTOK_PF_TRANSACTION             (Phí giao dịch)
TIKTOK_PF_COMMISSION              (Phí hoa hồng TikTok shop)
TIKTOK_PF_SHIPPING                (Phí vận chuyển người bán)
TIKTOK_PF_EXCLUSIVE_BENEFIT       (Phí tiếp cận lợi ích độc quyền)
TIKTOK_PF_VOUCHER_XTRA            (Phí dịch vụ Voucher Xtra)
TIKTOK_PF_ORDER_PROCESSING        (Phí xử lý đơn hàng)
TIKTOK_PF_SFR                     (Phí dịch vụ SFR)
```

### `sal_fx_rates`
| Column | Type | Note |
|---|---|---|
| `fxr_id` | CHAR(36) PK | |
| `ent_id` NULL | | NULL = global default |
| `fxr_vnd_per_krw` | DECIMAL(10,4) NOT NULL | default `17.5430` (VND per 1 KRW) |
| `fxr_effective_from` | TIMESTAMPTZ NOT NULL | |
| `fxr_created_by` | CHAR(36) NULL | |
| INDEX(`ent_id`, `fxr_effective_from` DESC) | | |

## 7. Calculation output (snapshot, NFR-08)

### `sal_product_metrics`
Line-level CM per SKU per period — snapshot tại thời điểm calc.
| Column | Type | Note |
|---|---|---|
| `prm_id` PK / `ent_id` / `ups_id` | | |
| `prm_platform` | ENUM `SHOPEE`/`TIKTOK` | |
| `prm_sku` | VARCHAR(64) | |
| `prm_product_name` | VARCHAR(255) | snapshot |
| `prm_original_price_vnd` / `prm_selling_price_vnd` / `prm_listing_price_vnd` | | |
| `prm_item_sold` | INT | |
| `prm_page_views` | INT | |
| `prm_conversion_rate` | DECIMAL(7,4) | |
| `prm_gmv_vnd` / `prm_net_gmv_vnd` / `prm_nmv_vnd` | | |
| `prm_seller_discount_vnd` / `prm_seller_vouchers_vnd` | | |
| `prm_free_gift_vnd` | | |
| `prm_ad_spending_vnd` / `prm_brand_ads_vnd` / `prm_off_platform_ads_vnd` | | TikTok: brand_ads + off_platform = NULL |
| `prm_affiliate_commission_vnd` / `prm_affiliate_booking_vnd` | | |
| `prm_livestream_fee_vnd` | | |
| `prm_platform_fee_vnd` | | |
| `prm_prime_cost_vnd` | | snapshot |
| `prm_prime_cost_snapshot_pcv_id` | CHAR(36) FK | reference version used |
| `prm_contribution_margin_vnd` | | computed |
| `prm_cm_ratio` | DECIMAL(7,4) | |
| `prm_calculated_at` | TIMESTAMPTZ | |

### `sal_platform_metrics`
Aggregated per platform per period.
| Column | Type | Note |
|---|---|---|
| `plm_id` PK / `ent_id` / `ups_id` / `plm_platform` | | |
| 21 column tổng tương ứng SRD Group 1 (Shopee) hoặc 20 cho TikTok | DECIMAL | |
| `plm_calculated_at` | | |

### `sal_reports`
Manifest: report instance đã được tạo, ready for view + export.
| Column | Type | Note |
|---|---|---|
| `rep_id` PK / `ent_id` | | |
| `rep_type` | ENUM | `WEEKLY`, `MONTHLY`, `TRENDING_SHOPEE_WOW`, `TRENDING_TIKTOK_WOW`, `TRENDING_SHOPEE_MOM`, `TRENDING_TIKTOK_MOM` |
| `rep_period_start` / `rep_period_end` | DATE | |
| `rep_status` | ENUM | `DRAFT`, `READY`, `FINALIZED` |
| `rep_finalized_at` | TIMESTAMPTZ NULL | set on first download |
| `rep_fx_rate_snapshot` | DECIMAL(18,4) | rate dùng cho KRW display |
| `rep_created_at` / `rep_updated_at` | | |

## 8. Formula configuration (FR-23, NFR-07)

### `sal_formula_configs`
48 params. 1 record per param.
| Column | Type | Note |
|---|---|---|
| `fmc_id` PK / `ent_id` NULL | | NULL = global default |
| `fmc_group` | ENUM | `G1_SHOPEE_PLATFORM`, `G2_SHOPEE_PRODUCT`, `G3_TIKTOK_PLATFORM`, `G4_TIKTOK_PRODUCT`, `G5_AGGREGATED`, `G6_CURRENCY_PERIOD`, `G6B_EXCLUSION`, `G7_COST_MASTER` |
| `fmc_param_code` | VARCHAR(64) | UNIQUE within ent+group |
| `fmc_param_name` | VARCHAR(255) | display |
| `fmc_description` | TEXT | |
| `fmc_data_source` | VARCHAR(64) | "Shopee Sales CSV" / "Calculated" / etc. |
| `fmc_type` | ENUM | `FIELD_MAP`, `CALCULATED`, `SELECT`, `NUMBER`, `TEXT` |
| `fmc_unit` | VARCHAR(32) | "VND", "%", "" |
| `fmc_value` | TEXT | stringified, parse by type |
| `fmc_options` | JSONB NULL | cho SELECT/FIELD_MAP — list available |
| `fmc_is_readonly` | BOOLEAN | true cho CALCULATED |
| `fmc_updated_by` / `fmc_updated_at` | | |

### `sal_formula_config_history`
Append-only.
| Column | Type | Note |
|---|---|---|
| `fch_id` PK / `ent_id` / `fmc_id` | | |
| `fch_old_value` / `fch_new_value` | TEXT | |
| `fch_changed_by` | CHAR(36) | |
| `fch_changed_at` | TIMESTAMPTZ | |

## 9. Activity logs (FR-19, FR-20, FR-21, NFR-12, NFR-13)

> **NFR-13**: immutable kể cả Admin. Postgres trigger DENY UPDATE/DELETE trên 3 bảng này. Hoặc DB user app không có quyền DELETE.

### `sal_log_login` (FR-19)
| Column | Type | Note |
|---|---|---|
| `llg_id` PK / `ent_id` | | |
| `llg_username` | VARCHAR(255) | |
| `llg_usr_id` NULL | | NULL nếu fail |
| `llg_success` | BOOLEAN | |
| `llg_ip_address` | INET | |
| `llg_user_agent` | TEXT | |
| `llg_timestamp` | TIMESTAMPTZ DEFAULT NOW() NOT NULL | |
| INDEX(`ent_id`, `llg_timestamp` DESC), INDEX(`ent_id`, `llg_username`) | | |

Retention: ≥12 months (NFR + SRD FR-19 AC-05).

### `sal_log_action` (FR-20)
| Column | Type | Note |
|---|---|---|
| `lac_id` PK / `ent_id` / `lac_usr_id` | | |
| `lac_action_type` | ENUM | `UPLOAD`, `MANUAL_INPUT_CREATE`, `MANUAL_INPUT_EDIT`, `MANUAL_INPUT_DELETE`, `PRIME_COST_EDIT`, `COGS_EDIT`, `FORMULA_CONFIG_EDIT`, `USER_MANAGEMENT`, `FX_RATE_CHANGE` |
| `lac_target_table` | VARCHAR(64) | |
| `lac_target_id` | CHAR(36) | |
| `lac_before_value` | JSONB | |
| `lac_after_value` | JSONB | |
| `lac_metadata` | JSONB NULL | extra context |
| `lac_timestamp` | TIMESTAMPTZ DEFAULT NOW() | |
| INDEX(`ent_id`, `lac_timestamp` DESC), INDEX(`ent_id`, `lac_action_type`) | | |

### `sal_log_download` (FR-21)
| Column | Type | Note |
|---|---|---|
| `ldl_id` PK / `ent_id` / `ldl_usr_id` | | |
| `ldl_report_type` | VARCHAR(32) | same as `sal_reports.rep_type` |
| `ldl_rep_id` | CHAR(36) NULL | reference report instance |
| `ldl_file_name` | VARCHAR(255) | generated filename |
| `ldl_file_format` | ENUM | `XLSX`, `CSV` |
| `ldl_timestamp` | TIMESTAMPTZ DEFAULT NOW() | |

## 10. ERD (overview)

```
sal_users ──────────────┐
                        │
sal_upload_sessions ─┬──┴── creates ──┐
       │             │                │
       ▼             ▼                ▼
sal_uploaded_files (S3 hash)     sal_manual_inputs
       │                                │
   parses into                          │
       ▼                                │
[9 sal_raw_*_reports]                   │
       │                                │
       └──────► calculation engine ◄────┘
                          │
                          ▼
           sal_product_metrics + sal_platform_metrics
                          │
                          ▼
                     sal_reports
                          │
                          ▼ (on download)
                     sal_log_download
                     
sal_prime_costs ─── sal_prime_cost_versions (snapshot used by metrics)
sal_cogs ─── multiple records per SKU with date

sal_formula_configs ──► sal_formula_config_history (append-only)

sal_log_login / sal_log_action / sal_log_download  (immutable)
```

## 11. Snapshot rule (NFR-08, NFR-09)

Khi report finalized (download lần đầu — assumption OI-002):
1. `sal_reports.rep_finalized_at` set
2. Mọi `sal_product_metrics` row trong report đã có `prm_prime_cost_snapshot_pcv_id` → KHÔNG bị ảnh hưởng nếu prime cost master thay đổi sau
3. `rep_fx_rate_snapshot` đã lưu rate tại thời điểm calc
4. Regenerate: chạy lại engine với raw + snapshot version → kết quả y hệt (NFR-09)

## 12. Migration policy

- Dev: `drizzle-kit push` lên Neon dev branch
- Staging/Prod: `drizzle-kit migrate` qua CI lên Neon staging/main branch
- Cấm `synchronize` / `push` lên prod
- Activity log tables: DB-level trigger chặn UPDATE/DELETE (NFR-13)
