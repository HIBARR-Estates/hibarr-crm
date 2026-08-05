# Developer Projects Public API — ops & payload notes

For **OL engineers integrating these endpoints** (auth, filters, full request/response shapes, TypeScript sketches), see:

**[ol-developer-projects-api-integration.md](./ol-developer-projects-api-integration.md)**

---

### Ops: mint exposé consumer token

After deploy + migration (`2026_07_25_000001_add_slug_to_developer_projects_table`):

1. In CRM **API Token Settings**, create a **company-bound** token.
2. Grant **only** these scopes (no unrestricted, no other groups):
   - `api.properties.index`
   - `api.properties.show`
   - `api.properties.filters.property_types`
   - `api.properties.filters.features`
   - `api.properties.filters.location`
   - `api.developer-projects.index`
   - `api.developer-projects.show`
3. Copy the plaintext token **once** into Infisical for the OL exposé consumer. Token values are never returned again from list/update APIs.

### Endpoints

Actual paths match Property API (ApiRoute + default version `v1`):

- `GET /api/v1/developer-projects` — paginated list (`api.developer-projects.index`)
- `GET /api/v1/developer-projects/{identifier}` — slug first, then numeric ID (`api.developer-projects.show`)

Scope config keys are unversioned; `ApiTokenScopeService` matches them to route names that end in `.v1`.

Auth: `X-API-TOKEN` (or Bearer) + `X-COMPANY-ID` (must match token company when both set).

### Hidden projects

API **includes** `is_hidden=true` projects. Every list/show item includes `is_hidden` so OL can filter client-side. Session UI visibility rules are not applied.

### Test verification note (sqlite)

`php vendor/bin/phpunit --filter DeveloperProjectApiTest` (phpunit `:memory:` sqlite) hits a **pre-existing** sqlite incompatibility:

- `App\Http\Controllers\Controller` constructor calls `checkMigrateStatus()` → `Artisan::call('migrate')`
- Migration `2022_11_23_070556_show_new_webhook_alert.php` runs MySQL `ALTER TABLE ... CHANGE COLUMN` which sqlite rejects
- Auth middleware tests (401/403) pass; happy-path controller tests return 500 before business logic

Do **not** run migrations against a real DB to “fix” this from the agent. Re-verify happy paths after migrate on MySQL/staging, or skip migrate-status in `APP_ENV=testing` in a separate ticket.

### Payload present vs follow-up gaps

**Present on list/show (as applicable):** `slug`, `is_hidden`, `facilities` (raw slug list), `distances`, `payment_plan`, `location` (ProjectLocation), `assets` (gallery-style map), `unit_type_details` (unit type records; avoids collision with `unit_types` column).

**Follow-up (non-blocking):** enriched facilities (labels/icons + property feature merge), tagged gallery shapes (`imagesByTag` / `facilityImagesBySlug`), web statistics summaries.
