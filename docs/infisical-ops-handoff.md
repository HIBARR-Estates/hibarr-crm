# Infisical Ops Handoff — Migration, Jenkins & Validation

Operational checklist for rolling out Infisical-backed secrets for hibarr-crm. Code changes live in the repo; these steps require Infisical UI, server SSH, and Jenkins admin access.

---

## 1. Infisical project setup

- [ ] Dedicated **hibarr-crm** project exists (separate from OL)
- [ ] Environments created: **`dev`**, **`staging`**, **`production`**
- [ ] Environment slugs match Jenkins exactly: `staging`, `production` (not `prod`)
- [ ] Project ID recorded in [`.infisical.json`](../.infisical.json) (`workspaceId`)

---

## 2. Secret migration

**Source of truth:** live `~/shared/.env` on each server — not `.env.example` alone.

### Staging

```bash
ssh <staging-user>@<staging-host> -p 2244
cat ~/shared/.env   # copy securely; do not paste into tickets
```

Upload all keys to Infisical **staging** environment.

### Production

```bash
ssh <production-user>@<production-host>
cat ~/shared/.env
```

Upload all keys to Infisical **production** environment.

### Dev environment

1. Copy staging secrets as baseline into **dev**
2. Override local-safe values, for example:
   - `APP_URL=http://localhost`
   - `APP_DEBUG=true`
   - Local `DB_*` credentials
   - `OTEL_LOGS_ENABLED=false` (if desired locally)

### Verify parity (optional — use a personal login or temporary read token)

```bash
export INFISICAL_DOMAIN="https://infisical.hibarr.org"
infisical login --domain="$INFISICAL_DOMAIN"

infisical export --env=staging --domain="$INFISICAL_DOMAIN" --format=dotenv > /tmp/staging-export.env
# diff against original server .env (order may differ; check key values)

infisical export --env=production --domain="$INFISICAL_DOMAIN" --format=dotenv > /tmp/production-export.env
```

---

## 3. Machine identity & Jenkins credentials

### Create machine identity (Infisical UI — org/project admin)

1. Create a machine identity, e.g. **`jenkins-hibarr-crm-deploy`**
2. Add it to the **hibarr-crm** project with **read** access to **`staging`** and **`production`** (not `dev`)
3. Enable **Universal Auth** and copy the **Client ID** and **Client Secret**

### Jenkins admin handoff

Ask Jenkins admin to create **two** credentials:

| Field | Credential 1 | Credential 2 |
|-------|----------------|----------------|
| Kind | Secret text | Secret text |
| ID | `infisical-crm-client-id` | `infisical-crm-client-secret` |
| Secret | `<client-id>` | `<client-secret>` |

Remove the legacy `infisical-service-token` credential once machine identity deploys are verified.

**No Jenkins server SSH required** — the Jenkinsfile bootstraps the Infisical CLI from GitHub releases on each executor workspace.

`INFISICAL_PROJECT_ID` in the Jenkinsfile must match `workspaceId` in [`.infisical.json`](../.infisical.json). Machine identities authenticate at the org level, so the export command must specify which project to read from.

### Confirm Jenkins executor architecture

The Jenkinsfile auto-detects `x86_64` → `amd64` and `aarch64`/`arm64` → `arm64`. If the first deploy fails on CLI download, confirm executor arch with Jenkins admin.

---

## 4. Deploy validation

### Staging (first Infisical-backed deploy)

- [ ] Pipeline Step 0: CLI downloads and `infisical --version` succeeds
- [ ] Step 0b: machine identity login + `infisical export --env=staging` succeeds
- [ ] `make build-artifact` completes (composer, ziggy, npm production)
- [ ] App boots; DB, file uploads, auth work
- [ ] gRPC health check passes (or expected warning if service not installed)
- [ ] Queue workers restart
- [ ] `~/shared/.env.bak` exists on server after deploy

### Production (after staging validated)

- [ ] Same checks with `--env=production`
- [ ] Verify `APP_URL`, `APP_ENV`, DB, and API keys are production-specific

### Local dev (second developer)

- [ ] Fresh clone
- [ ] `infisical login --domain=https://infisical.hibarr.org`
- [ ] `npm run env:pull` creates working `.env`
- [ ] `php artisan serve` + frontend dev workflow works

---

## 5. Rollback

If deploy fails after `.env` was promoted to shared:

```bash
# On staging or production server
cp ~/shared/.env.bak ~/shared/.env
```

Or revert the Jenkinsfile PR to restore the legacy `cp ~/shared/.env` fallback.

---

## 6. Cleanup (after staging + one production deploy stable)

- [ ] Stop manually editing `~/shared/.env` on servers
- [ ] Deprecate sharing `.env` files between developers (point to [local-development.md](./local-development.md))
- [ ] Document machine identity client secret rotation in Infisical

---

## Reference

| Component | Location |
|-----------|----------|
| Jenkins pipeline | [`Jenkinsfile`](../Jenkinsfile) |
| Local project link | [`.infisical.json`](../.infisical.json) |
| Developer setup | [`docs/local-development.md`](./local-development.md) |
| Infisical instance | `https://infisical.hibarr.org` |
