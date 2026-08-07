# Projects & Units — Brief for Property Recommendation Engine

Audience: AI / recommendation team extending the property recommendation engine beyond listed properties.

This document describes how **developer projects** and **unit types** are modelled in Hibarr CRM, so they can be read from the DB (or mirrored) for recommendations.

---

## 1. What these entities are

| Concept | Table | Meaning |
|---|---|---|
| **Project** | `developer_projects` | A real-estate development (e.g. “Marina Residences”) |
| **Unit (unit type)** | `developer_project_unit_types` | A sellable configuration / floorplan within that project (e.g. “2+1 Apartment”) — **not** a single apartment inventory row |
| **Property** (existing engine input) | `properties` | An individual listing; may optionally belong to a project and/or unit type |

**Important naming notes**

- Do **not** use the Worksuite `projects` table. That is internal task/project management, unrelated to real estate.
- In product language we say “units”; in the schema they are **unit types** (`developer_project_unit_types`). They are templates with stock counts (`quantity` / `total_sold`), not door-number inventory.
- On `developer_projects`, the column `unit_types` is only a coarse string array (e.g. `["apartment","villa"]`). The real unit records live in `developer_project_unit_types`.

---

## 2. Hierarchy

```
Developer (developers)
  └── DeveloperProject (developer_projects)
        ├── ProjectLocation (project_locations)          // city / area / coords
        ├── assets (developer_project_assets)
        ├── Unit types (developer_project_unit_types)    ← “units”
        │     └── assets (developer_project_unit_type_assets)
        └── Properties (properties.developer_project_id) // optional
              └── properties.developer_project_unit_type_id  // optional
```

All of these are **company-scoped** (`company_id`) and use **soft deletes** (`deleted_at`). Soft-deleted rows should be excluded.

---

## 3. How this relates to the current property engine

Today recommendations are property/customer based (`properties` + lead/customer id).

Projects and unit types sit **beside** that catalog:

- Recommend a **project** when the buyer fits the development (location, budget band, construction stage, facilities, payment plan).
- Recommend a **unit type** when they fit beds/baths/size/price/views/features inside that project.
- A property may inherit project/unit context via FKs, but many off-plan offerings exist only as project + unit type (no property row).

For DB reads, filter on `company_id`, exclude soft-deleted rows, and usually skip `is_hidden = 1` on projects and `is_sold_out = 1` on unit types unless product says otherwise.

---

## 4. Projects — `developer_projects`

### Identity & ownership

| Column | Notes |
|---|---|
| `id` | Primary key |
| `company_id` | Tenant |
| `developer_id` | FK → `developers` |
| `name` | Display name |
| `slug` | Unique per company; preferred public identifier |
| `reference_code` | e.g. `AKACAN-001` |
| `description` | Free text |
| `is_hidden` | Visibility flag (API currently still returns these; CRM UI may hide them) |

### Location

| Column | Notes |
|---|---|
| `project_location_id` | FK → `project_locations` |

Useful fields on `project_locations`: `city`, `area`, `name`, `latitude`, `longitude`, `address` (JSON), `map_url`, plus attractions / infrastructure / airports JSON blobs.

### Commercial & classification

| Column | Notes |
|---|---|
| `starting_price` | Project-level from-price |
| `primary_categories` | JSON array: `residential`, `commercial` |
| `title_deed_type` | e.g. `turkish`, `british`, `exchange`, `tahsis`, `leasehold`, `mucahit` |
| `unit_types` | JSON string array of coarse types only — **not** the unit-type relation |
| `furniture_package` | `unfurnished`, `part_furnished`, `white_goods_only`, `fully_furnished` |
| `rental_guarantee` | boolean |

### Construction & inventory

| Column | Notes |
|---|---|
| `construction_status` | `pre_construction`, `active_construction`, `post_construction`, `complete` |
| `completion_date` | Date |
| `number_of_phases` / `number_of_blocks` | Counts |
| `number_of_units` | Count |
| `total_units` / `total_units_sold` | Optional overrides |
| `project_total_area_sqm` | Area |

### Amenities & plan (JSON)

| Column | Shape / notes |
|---|---|
| `facilities` | Array of facility slugs, e.g. `["pool","gym","parking"]` |
| `distances` | `{ sea_km, hospital_km, market_km, school_km, airport_km, beach_km }` |
| `payment_plan` | `{ enabled, downpayment_type, downpayment_value, period_months, interest_rate }` |

`downpayment_type` is typically `percentage` or `amount`.

### Other links

| Column | Notes |
|---|---|
| `google_drive_link` | Internal docs |
| `availability_link` | Availability sheet |

---

## 5. Units (unit types) — `developer_project_unit_types`

### Identity & link

| Column | Notes |
|---|---|
| `id` | Primary key — use this as the recommendable entity id |
| `company_id` | Tenant |
| `developer_project_id` | FK → parent project |
| `reference_code` | e.g. `AKACAN-001-UT01` |
| `order` | Display / ranking within project |
| `description` | Free text |

### Classification

| Column | Notes |
|---|---|
| `primary_category` | `residential` \| `commercial` |
| `property_type` | Residential: `apartment`, `villa`, `semi_detached_villa`, `bungalow`, `townhouse`. Commercial: `shop`, `office` |
| `unit_style` | JSON multi-select: `studio`, `penthouse`, `loft`, `garden_apartment`, `duplex`, `triplex` |
| `view_types` | JSON multi-select: `sea_front`, `sea_view`, `mountain_view`, `pool_view`, `garden_view`, `city_view` |
| `furniture_status` | `unfurnished`, `part_furnished`, `white_goods_only`, `fully_furnished` |

### Specs & pricing

| Column | Notes |
|---|---|
| `bedrooms` / `bathrooms` | Integers |
| `floor` | String: `basement`, `ground`, `1`…`15+` |
| `floors_in_building` | Integer |
| `total_area_sqm` / `living_area_sqm` / `terrace_balcony_sqm` / `plot_size_sqm` | Areas |
| `starting_price` | From-price for this unit type |
| `currency` | `GBP`, `EUR`, `USD`, `TRY` |
| `completion_date` | May differ from project completion |

### Features & legal

| Column | Notes |
|---|---|
| `outside_features` | JSON slug array (garage, garden, private_pool, terrace, …) |
| `inside_features` | JSON slug array (air_condition, fireplace, steel_door, …) |
| `military_base_distance_km` | Legal / restriction context |
| `has_restrictions` | boolean |
| `restriction_notes` | Free text |

### Availability

| Column | Notes |
|---|---|
| `quantity` | How many of this type exist |
| `total_sold` | How many sold |
| `is_sold_out` | Prefer excluding from recommendations when `true` |

---

## 6. Link to properties (optional)

`properties` may reference the catalog:

| Column | Notes |
|---|---|
| `developer_project_id` | Property belongs to this project |
| `developer_project_unit_type_id` | Property is an instance / listing of this unit type |

Use these when enriching an existing property recommendation with project/unit context. Do **not** assume every project or unit type has property rows.

---

## 7. Suggested DB join pattern

```sql
SELECT
  dp.id   AS project_id,
  dp.slug AS project_slug,
  dp.reference_code AS project_ref,
  dp.name AS project_name,
  dp.company_id,
  dp.starting_price AS project_starting_price,
  dp.construction_status,
  dp.completion_date,
  dp.primary_categories,
  dp.facilities,
  dp.distances,
  dp.payment_plan,
  dp.is_hidden,
  d.id    AS developer_id,
  d.name  AS developer_name,
  pl.city,
  pl.area,
  pl.latitude,
  pl.longitude,
  ut.id   AS unit_type_id,
  ut.reference_code AS unit_type_ref,
  ut.primary_category,
  ut.property_type,
  ut.bedrooms,
  ut.bathrooms,
  ut.total_area_sqm,
  ut.starting_price AS unit_starting_price,
  ut.currency,
  ut.view_types,
  ut.unit_style,
  ut.outside_features,
  ut.inside_features,
  ut.quantity,
  ut.total_sold,
  ut.is_sold_out
FROM developer_projects dp
JOIN developers d
  ON d.id = dp.developer_id
 AND d.deleted_at IS NULL
LEFT JOIN project_locations pl
  ON pl.id = dp.project_location_id
 AND pl.deleted_at IS NULL
LEFT JOIN developer_project_unit_types ut
  ON ut.developer_project_id = dp.id
 AND ut.deleted_at IS NULL
WHERE dp.deleted_at IS NULL
  AND dp.company_id = :company_id
  -- AND dp.is_hidden = 0
  -- AND (ut.id IS NULL OR ut.is_sold_out = 0)
;
```

---

## 8. IDs to return in recommendations

| Entity | Prefer | Also useful |
|---|---|---|
| Project | `developer_projects.id` | `slug`, `reference_code` |
| Unit type | `developer_project_unit_types.id` | `reference_code`, parent `developer_project_id` |
| Always include | `company_id` | so consumers stay tenant-safe |

---

## 9. Recommendation usage sketch

| Signal | Prefer reading from |
|---|---|
| Budget / price band | Unit `starting_price` + `currency`; fall back to project `starting_price` |
| Beds / baths / size | Unit type columns |
| Views / styles / features | Unit `view_types`, `unit_style`, feature JSON |
| Location | Project → `project_locations` |
| Construction timing | Project `construction_status`, `completion_date` (unit may override completion) |
| Amenities / distances / payment plan | Project JSON columns |
| Category / property type | Unit `primary_category` + `property_type`; project `primary_categories` / `unit_types` as coarse filters only |

---

## 10. Related CRM docs (optional)

If you prefer API shapes over raw tables (same fields, already mapped):

- [`ol-developer-projects-api-integration.md`](./ol-developer-projects-api-integration.md) — list/show payloads, enums, `unit_type_details`
- [`developer-projects-public-api-notes.md`](./developer-projects-public-api-notes.md) — ops / token notes

Public read endpoints (company-scoped API token):

- `GET /api/v1/developer-projects`
- `GET /api/v1/developer-projects/{slug_or_id}` — includes `unit_type_details`

---

## 11. Quick FAQ

**Are “units” individual apartments?**  
No. They are **unit types** (SKUs / floorplans) with quantity and sold counts.

**Is every unit type also a property?**  
No. Properties are optional listings that may link to a project and unit type.

**Which `unit_types` field should we use?**  
Use rows in `developer_project_unit_types`. Ignore or only use the project column `unit_types` as a coarse filter.

**Should we recommend hidden or sold-out inventory?**  
Default: exclude `developer_projects.is_hidden = 1` and `developer_project_unit_types.is_sold_out = 1`. Confirm with product if you need them for edge cases.
