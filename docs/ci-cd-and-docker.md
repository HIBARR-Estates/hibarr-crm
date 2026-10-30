# CI, build speed and Docker

What runs where, how to deploy with Docker, and what was measured.

## What runs on a pull request

`.github/workflows/ci.yml`. Jobs run in parallel and are skipped when the PR does not touch their inputs (path filters), so a docs-only PR runs nothing.

| Job | Runs when | Notes |
| --- | --- | --- |
| PHPUnit (4 shards) | PHP, composer, views, lang or test changes | `scripts/ci/phpunit-shard.py` splits `tests/Unit` + `tests/Feature` by file size; no extra Composer dependency |
| Pint + PHPStan | PHP changes, PRs only | Changed files only. **Non-blocking** until the repo baseline is known (`continue-on-error` in the workflow) |
| Frontend build (Mix) | frontend, views or package changes | The build production ships. Webpack cache restored from `develop` |
| Docker image | docker, composer, package or Mix changes; always on pushes | Builds, smoke-tests, and on `develop`/`staging`/`main` pushes to `ghcr.io/<org>/hibarr-crm` |
| CI passed | always | One check to require in branch protection. Skipped jobs count as passing |

Run a shard locally:

```bash
python3 scripts/ci/phpunit-shard.py 1 4
vendor/bin/phpunit -c phpunit.shard.xml
```

## Deploying with Docker

The image (`docker/Dockerfile`) is nginx + PHP-FPM for the web app (the same image also runs the queue, scheduler, migrate and gRPC roles), with secrets pulled from Infisical at start-up. Compose runs three roles from one image: `app`, `queue`, `scheduler`.

Build and run locally:

```bash
docker compose up -d --build
```

Run an image CI already built (no build on the server):

```bash
export HIBARR_IMAGE=ghcr.io/hibarr-estates/hibarr-crm:sha-<short-sha>
docker compose pull
docker compose up -d --no-build
```

To run it on Dokploy (health check, one-shot migrate step, CI-triggered deploy), see [dokploy.md](dokploy.md), including the gRPC server and Expose PDFs.

Tags published: `develop`, `staging`, `main` (branch heads) and `sha-<short>`. Pin `sha-...` in production so a rollback is a one-line change.

## What was measured

Measured on a 4-core, 15 GB sandbox. **These are not Jenkins numbers**: your server's CPU and the rest of the pipeline (clone, migrations, restarts) are not included.

| Step | Time |
| --- | --- |
| `npm ci`, cold | 30 s |
| Mix production build, no cache (today's behaviour) | 294 s |
| Mix build, writing the webpack cache (first run) | 330 s |
| Mix build, warm cache, same directory | 62 s |
| Mix build, warm cache, **different directory** (what a new Jenkins release dir looks like) | 158 s |
| Vite build (React/Inertia entry only) | 24 s |

Takeaways:

- The Mix build dominates the frontend. A warm cache cuts it by 79% in the same directory (CI, Docker) and by about 46% when the checkout path changes (Jenkins).
- The cache is about 2.8 GB on disk, about 630 MB compressed. CI saves it only on `develop` pushes so it does not evict other caches.
- Vite is not a like-for-like comparison: it builds only the React entry, while Mix also bundles the jQuery scripts, SCSS and Tailwind CSS for Blade pages. Moving more screens to Vite is the largest remaining lever.

## Jenkins changes

- `make build-artifact` runs the Composer chain (install, proto, autoload, ziggy) and `npm ci` at the same time.
- npm, Composer, webpack and the RoadRunner binary are cached under `/home/<user>/shared/cache`, so they survive the "keep 5 releases" cleanup.
- `npm install` became `npm ci`. It fails if `package.json` and `package-lock.json` disagree; fix by running `npm install` locally and committing the lock.

## Rollout checklist

1. Merge, then watch the first `develop` run. The first run is cold (no caches); judge speed from the second.
2. In repository settings, require the **CI passed** check on `develop`/`main`.
3. Confirm the org allows `GITHUB_TOKEN` to publish packages (Settings → Actions → Workflow permissions), otherwise the Docker push step fails.
4. Once Pint/PHPStan are clean on `develop`, remove `continue-on-error` from the `lint` job.

## Known gaps

- **Dev dependencies in the image.** The image installs with `composer install --no-dev`. `fakerphp/faker` is in `require` (not `require-dev`) because `App\Services\Dashboard\TeamDashboardDemoDataService`, reached from `DashboardV2Controller`, uses it at runtime. A scan of `app`, `config`, `routes`, `bootstrap`, `database`, `resources/views` and `Modules` for namespaces provided only by dev packages found one other reference: `AppServiceProvider` registers `Barryvdh\LaravelIdeHelper` when `APP_ENV=development`. That is fine for staging and production, but do not run this image with `APP_ENV=development`. If a runtime path later depends on another dev package, move it to `require` the same way.
- **Not run end to end.** The workflows, the image build and the Jenkinsfile edits could not be executed in the environment they were written in.
