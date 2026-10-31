# CI, build speed and Docker

What runs where, how to deploy with Docker, and what was measured.

## CI: Woodpecker

CI runs on Woodpecker, like the other HIBARR repos. The pipelines are **not edited in this repository**: they are the `laravel-app` templates in [hibarr-ci-infrastructure](https://github.com/HIBARR-Estates/hibarr-ci-infrastructure), copied here as `.woodpecker/*.yml` and `.woodpecker-scripts/*.sh` by that repo's sync job (it opens a PR whenever a template changes; `sync/repos.yaml` lists this repo with `projectType: laravel-app`, `branch: develop`). To change CI, change the template there. Edits made directly to these files are overwritten by the next sync.

### What runs on a pull request into `develop` (and on every push to it)

`.woodpecker/ci.yml`. Steps with no dependency between them run in parallel.

| Step | Runs on | What it does |
| --- | --- | --- |
| `php-install` | PR, push | `composer install` (with dev packages). Needs the `COMPOSER_AUTH` secret to avoid GitHub rate limits |
| `php-tests` | PR, push | Installs the extra PHP extensions, then runs `tests/Unit` + `tests/Feature` as 4 PHPUnit shards in parallel (`.woodpecker-scripts/php-tests.sh`; split by file size, no extra Composer dependency) |
| `php-lint` | PR, push | Pint and PHPStan on the files the run changed. **Non-blocking** (`failure: ignore`) until the repo baseline is known |
| `image-smoke-pr` / `image-smoke` | PR / push | Builds the Dockerfile's `smoke` target without pushing. Its `RUN` steps are the checks: image basics, Expose PDF rendering as `root` and `www-data`, and the gRPC server (binary matches `composer.lock`, every class autoloads, protobuf round trip). The same build proves the frontend bundle compiles |
| `prepare-tags`, `publish` | push to `develop` | After tests and the smoke build pass: pushes `ghcr.io/hibarr-estates/hibarr-crm:develop-<short sha>` and `:latest` |

Manual pipelines (run from the Woodpecker UI, never automatic): `deploy-prod` and `deploy-staging`. See [dokploy.md](dokploy.md).

Secrets (Woodpecker repo secrets): `GHCR_USERNAME`, `GHCR_TOKEN`, `COMPOSER_AUTH` (enable it for pull-request events too), `DOKPLOY_PROD_WEBHOOK`, `PROD_HEALTH_URL`, `DOKPLOY_STAGING_WEBHOOK`, `STAGING_HEALTH_URL`.

Reproduce the checks locally:

```bash
# the smoke target (needs Docker; builds the whole image, so it takes a while)
docker build --target smoke -f docker/Dockerfile .

# the sharded tests, after `composer install`
bash .woodpecker-scripts/php-tests.sh
```

## Deploying with Docker

The image (`docker/Dockerfile`) is nginx + PHP-FPM for the web app (the same image also runs the queue, scheduler, migrate and gRPC roles), with secrets pulled from Infisical at start-up. Compose runs three roles from one image: `app`, `queue`, `scheduler`.

Build and run locally:

```bash
docker compose up -d --build
```

Run an image CI already built (no build on the server):

```bash
export HIBARR_IMAGE=ghcr.io/hibarr-estates/hibarr-crm:develop-<short-sha>
docker compose pull
docker compose up -d --no-build
```

To run it on Dokploy (health check, one-shot migrate step, manual deploy pipelines), see [dokploy.md](dokploy.md), including the gRPC server and Expose PDFs.

Tags published: `develop-<short sha>` for every successful push to `develop`, and `latest`, which always points at the newest one. Pin a `develop-<short sha>` tag in production so a rollback is a one-line change.

## What was measured

Measured on a 4-core, 15 GB sandbox. **These are not Jenkins or Woodpecker numbers**: your servers' CPU and the rest of the pipeline (clone, migrations, restarts) are not included.

| Step | Time |
| --- | --- |
| `npm ci`, cold | 30 s |
| Mix production build, no cache (today's behaviour) | 294 s |
| Mix build, writing the webpack cache (first run) | 330 s |
| Mix build, warm cache, same directory | 62 s |
| Mix build, warm cache, **different directory** (what a new Jenkins release dir looks like) | 158 s |
| Vite build (React/Inertia entry only) | 24 s |

Takeaways:

- The Mix build dominates the frontend. A warm webpack cache cuts it by 79% in the same directory and by about 46% when the checkout path changes (Jenkins).
- **Woodpecker does not get the warm-cache benefit today.** Its steps share only the workspace, there is no per-step dependency cache, and the image build runs in the buildx plugin's throwaway builder, so BuildKit cache mounts (including the webpack cache) are lost between runs. A pipeline that changes `app/` or `resources/` therefore runs the full Mix build (about 5 minutes on 4 cores). The registry layer cache (`:buildcache`, push events) still skips it when neither changed. To get the 62 s case, run the buildx step against a persistent builder on the agent host, or add an S3-backed cache plugin for `node_modules/.cache`.
- Pull requests build without registry credentials (as in the other repos' templates), so a PR image build starts cold. A read-only GHCR token enabled for pull-request events, plus `cache_from` on `image-smoke-pr`, would warm it.
- Vite is not a like-for-like comparison: it builds only the React entry, while Mix also bundles the jQuery scripts, SCSS and Tailwind CSS for Blade pages. Moving more screens to Vite is the largest remaining lever.

## Jenkins changes

- `make build-artifact` runs the Composer chain (install, proto, autoload, ziggy) and `npm ci` at the same time.
- npm, Composer, webpack and the RoadRunner binary are cached under `/home/<user>/shared/cache`, so they survive the "keep 5 releases" cleanup.
- `npm install` became `npm ci`. It fails if `package.json` and `package-lock.json` disagree; fix by running `npm install` locally and committing the lock.

## Rollout checklist

1. Merge the infra change (adds the `laravel-app` template and this repo to `sync/repos.yaml`). This PR already contains the files that sync would generate, so the first sync PR should come out empty.
2. In Woodpecker: activate `hibarr-crm`, mark it **Trusted** (repo settings; the image build steps run `privileged: true`, as in the other repos, and a repo that is not trusted cannot run them), and add the secrets above.
3. Require the Woodpecker status checks on `develop` in branch protection.
4. Watch the first run. The first push is cold (no `:buildcache` image yet); judge speed from the second.
5. Once Pint/PHPStan are clean, delete `failure: ignore` from `php-lint` in the template (in the infra repo).

## Known gaps

- **Dev dependencies in the image.** The image installs with `composer install --no-dev`. `fakerphp/faker` is in `require` (not `require-dev`) because `App\Services\Dashboard\TeamDashboardDemoDataService`, reached from `DashboardV2Controller`, uses it at runtime. A scan of `app`, `config`, `routes`, `bootstrap`, `database`, `resources/views` and `Modules` for namespaces provided only by dev packages found one other reference: `AppServiceProvider` registers `Barryvdh\LaravelIdeHelper` when `APP_ENV=development`. That is fine for staging and production, but do not run this image with `APP_ENV=development`. If a runtime path later depends on another dev package, move it to `require` the same way.
- **The image is cross-built on an ARM agent for an x86-64 host.** The pipeline builds `linux/amd64` on the ARM Mac mini, which needs amd64 emulation in the agent's Docker (see "CPU architecture" in [dokploy.md](dokploy.md)). Only the runtime layers (apt, compiling PHP extensions) and the smoke checks run under emulation; the frontend bundle, composer packages and other CPU-independent stages stay native. Expect the first run, before the registry layer cache exists, to be slow, and the smoke step (headless Chrome and RoadRunner under emulation) to be the most likely to be slow or flaky. An x86-64 agent would remove the emulation entirely.
- **PHP extensions are compiled on every test run** (about two minutes), because each Woodpecker step starts from a bare `php` image. A CI image with them baked in would remove that.
- **No path filtering.** A Woodpecker `when.path` filter skips a whole workflow, and all steps here share one workflow so `publish` can depend on the tests, so every push and PR runs everything.
- **Not run end to end.** The pipelines, the image build and the Jenkinsfile edits could not be executed in the environment they were written in. See "Not verified" in [dokploy.md](dokploy.md).
