# Deploying the CRM on Dokploy

Replaces the Jenkins "build on the server, switch a symlink" deploy with: CI builds one image, Dokploy pulls and runs it.

```
push to develop
  -> Woodpecker: tests + smoke build, then pushes ghcr.io/hibarr-estates/hibarr-crm:develop-<short sha> and :latest
  -> you run the manual `deploy-staging` / `deploy-prod` pipeline in Woodpecker
  -> it calls the Compose app's Dokploy webhook
  -> Dokploy: docker compose up  (pull image -> migrate -> app, queue, scheduler)
  -> the pipeline polls /build-version.json until the new release answers
```

Deploys are manual on purpose, like the other HIBARR repos: CI publishes the image, a person promotes it. Nothing is built on the Dokploy host. The Compose file is `docker-compose.dokploy.yml`.

## Before retiring Jenkins

Nothing known to break in a container is left: Expose PDFs and the gRPC server are covered below, and `fakerphp/faker` (used at runtime by `TeamDashboardDemoDataService`) is now a regular dependency, so the image's `--no-dev` install includes it. What remains is proving it on real infrastructure: see "Not verified" at the end, deploy staging first, and keep the Jenkins deploy for production until staging has run a full release cycle.

## Expose PDFs

Expose PDFs (`PdfGenerator` -> Spatie Laravel PDF -> Browsershot -> Node -> Puppeteer -> Chrome) work in the image, so web downloads and queued jobs both run in containers.

- **What is in the image:** Node 20, `puppeteer` at the exact version `package-lock.json` pins (installed globally, because Browsershot resolves it through `npm root -g`), Chrome's system libraries, and the fonts the templates name (DejaVu Sans, Open Sans, Liberation for Helvetica/Arial, emoji). `PUPPETEER_CACHE_DIR=/opt/puppeteer` lets Puppeteer find its browser, since the app never passes a Chrome path.
- **Only `chrome-headless-shell` is installed.** Browsershot launches `headless: 'shell'` unless the app calls `newHeadless()`, which it does not, and that mode needs Puppeteer's separate headless-shell build. Full Chrome would add about 360 MB. If the app ever switches, build with `--build-arg PUPPETEER_BROWSERS="chrome chrome-headless-shell"`.
- **CPU architecture.** An image only runs on the CPU it was built for. The Dokploy host is x86-64 and the Woodpecker agent is an ARM Mac mini, so the pipeline builds `linux/amd64` (`platforms: linux/amd64` in the template). The Dockerfile pins every stage whose output does not depend on the CPU (composer packages, the route list, the frontend bundle, protobuf classes, the Puppeteer JavaScript and its browser download) to the builder (`$BUILDPLATFORM`), so those run natively; only `runtime` (apt, PHP extension compilation) and the `smoke` checks run for x86-64, under emulation on the Mac. The agent's Docker needs amd64 emulation; check with `docker run --rm --platform linux/amd64 alpine uname -m` (it must print `x86_64`), and if it does not, install it once with `docker run --privileged --rm tonistiigi/binfmt --install amd64`.
- **No browser for ARM images.** Google publishes no Chrome for Testing for Linux ARM, and Puppeteer's installer would silently download the x86-64 build there. For an `arm64` target the PDF stage now prints a warning and installs nothing (so a local build on an Apple Silicon laptop still succeeds, without PDF support), and the PDF smoke test fails with a message naming the CPU if a browser cannot run. For a working PDF image, build `linux/amd64`.
- **Image size:** the PDF layers add roughly 420 MB (Node 95 MB, modules 74 MB, headless shell 251 MB) plus Chrome's libraries and fonts.
- **Own worker:** the `expose` service runs only the `expose` queue (jobs can run 7 minutes), so a long render never delays other jobs. The default `queue` worker deliberately does not listen to `expose`.
- **Build time:** the bundler stage now skips Puppeteer's browser download (`PUPPETEER_SKIP_DOWNLOAD`), which used to fetch about 600 MB during `npm ci`. The Chrome download happens once, in its own stage keyed on the Puppeteer version, so it is cached until Puppeteer changes.
- **CI check:** the Dockerfile's `smoke` target runs `scripts/ci/smoke-pdf.sh` as a build step, inside the image, and renders a PDF through Browsershot's real node script as `root` and `www-data`, after checking Chrome's libraries and the font directories.

## gRPC server

The image can run the RoadRunner gRPC server that Jenkins hosts run today (`worker.php`, `.rr.staging.yaml`, same services and API-token auth). It is the `grpc` service in `docker-compose.dokploy.yml`, behind the Compose profile `grpc`, so an environment only runs it when `COMPOSE_PROFILES=grpc` is set in Dokploy's Environment tab.

- **What is in the image:** the RoadRunner binary at the release `composer.lock` pins for `spiral/roadrunner` (the Dockerfile reads the version from the lock, so server and PHP library cannot drift; the smoke build also compares `rr --version` with the lock), and the protobuf classes, which a build stage generates with `protoc` from `proto/` (the container equivalent of `make proto`; `app/Grpc/Generated` is not committed).
- **How it starts:** `CONTAINER_ROLE=grpc` runs `rr serve -c .rr.staging.yaml` as `www-data`, with the gRPC listener (`:9001`) and status endpoint (`:2114`) forced to `0.0.0.0` so the container does not depend on the "Phase 2: bind to 127.0.0.1" edit that file anticipates. RoadRunner stays PID 1, so `docker stop` drains it.
- **Reaching it:** Traefik terminates TLS at `GRPC_DOMAIN` and talks cleartext HTTP/2 (`h2c`) to RoadRunner, which is what gRPC needs; the labels are in the Compose file, not the Domains tab. Set `GRPC_ROUTER_NAME` to something unique if staging and production share a Dokploy. Clients keep sending `x-api-token` and `x-company-id`, so they only need the new host name. To skip Traefik and keep the staging "Phase 1" style (`host:9001`, plaintext), drop the labels and publish `9001:9001`.
- **Health:** the container health check is a TCP connect to `:9001`. Monitoring can use the status plugin on `:2114` (RoadRunner expects a `plugin` query parameter on `/health`; check the exact form against your RoadRunner version).
- **Not carried over:** the nginx gRPC proxy (`scripts/nginx-grpc-staging.conf`), the systemd unit and `scripts/grpc-setup/` are replaced by Traefik and the container.
- **Performance:** the protobuf runtime is the pure-PHP `google/protobuf` package. If the Jenkins hosts have the `protobuf` PHP extension installed, they will be faster per request; compare before moving a busy production workload.
- **New `.proto` files:** the image generates from every file in `proto/`, while `.rr.staging.yaml` serves only the files it lists, as before. `crm_event.proto` is currently in `proto/` but not in the RoadRunner config, so it is generated but not served.

## Differences from the Jenkins deploy

- **No atomic switch.** Jenkins flipped a symlink, so the old release served until the new one was ready. `docker compose up` recreates containers, so expect a short gap (until the new `app` passes its health check). A failed migration still leaves the old containers running, because `app`/`queue`/`scheduler` wait on the `migrate` service. For true rolling updates, run the web service as a separate Dokploy Application (Swarm) with a health check.
- **Secrets** still come from Infisical, fetched when each container starts. Use a machine identity (`INFISICAL_CLIENT_ID` + `INFISICAL_CLIENT_SECRET`): the container logs in at every start. A static `INFISICAL_TOKEN` also works but fails on restart once it expires.
- **Queue workers** run in the `queue` container (the production queue list minus `expose`; override with `QUEUE_NAMES`) and Expose renders in the `expose` container. The scheduler runs in the `scheduler` container, replacing the crontab entry from `scripts/ensure_laravel_scheduler_cron.sh`.
- **Queue and scheduler containers run as root** (as in the existing image), so files they create in the shared `storage` volume can be root-owned and unwritable by PHP-FPM. The `migrate` step runs as `www-data` to avoid adding to this. Running all roles as `www-data` is a sensible follow-up.

## One-time setup

### 1. Woodpecker

The pipelines are the `laravel-app` templates from hibarr-ci-infrastructure, synced into `.woodpecker/` (see [ci-cd-and-docker.md](ci-cd-and-docker.md)). Activate `hibarr-crm` in Woodpecker, mark it **Trusted** (the image build steps run `privileged: true`), and add these repo secrets:

| Secret | Value | Used by |
| --- | --- | --- |
| `GHCR_USERNAME`, `GHCR_TOKEN` | a token that can push packages | `ci` on push to `develop` |
| `COMPOSER_AUTH` | `{"github-oauth":{"github.com":"<read-only token>"}}`; enable for pull-request events too | `ci` |
| `DOKPLOY_STAGING_WEBHOOK`, `STAGING_HEALTH_URL` | the staging Compose app's webhook URL; `https://<staging host>/healthz` | `deploy-staging` |
| `DOKPLOY_PROD_WEBHOOK`, `PROD_HEALTH_URL` | the production app's webhook URL; `https://<prod host>/healthz` | `deploy-prod` |

A health URL ending in `/healthz` also turns on the release check: the pipeline waits until `/build-version.json` on that host shows the commit it was run on, so an old container that is still up cannot pass. Any other URL is checked for HTTP 200 only.

The `GHCR_TOKEN` owner needs write access to the `hibarr-crm` package (the first push creates it).

### 2. Dokploy host

- Log the host in to GHCR so it can pull the private image: `docker login ghcr.io -u <user>` with a token that has `read:packages`. (Dokploy's Registry settings apply to Applications; for Compose, log in on the host.)
- Create a **Compose** application. Source: Git, this repository, branch `develop`, compose path `./docker-compose.dokploy.yml` (Dokploy reads only the compose file from Git; the image comes from GHCR). Copy the app's deploy webhook URL (the Auto Deploy section) into the Woodpecker secret above, and do not add that URL to the GitHub repository's webhooks, so only the manual pipeline deploys.
- Environment tab:

```
IMAGE_TAG=latest             # newest develop build; develop-<short sha> pins a release
APP_URL=https://crm.example.com
INFISICAL_API_URL=https://infisical.hibarr.org
INFISICAL_PROJECT_ID=<id from .infisical.json>
INFISICAL_ENV=staging        # prod for production
INFISICAL_CLIENT_ID=<machine identity>
INFISICAL_CLIENT_SECRET=<machine identity secret>
```

- Domains tab: add the domain for service `app`, container port `80`, HTTPS on. The app trusts Docker's private ranges for forwarded headers, so Traefik in front works without extra settings. Dokploy adds the Traefik labels and network; no ports are published. The webhook only triggers a redeploy: the Compose file pulls whatever `IMAGE_TAG` says, so with `latest` run the deploy pipeline on the newest `develop` commit (the release check fails by design if another release is serving).
- The database must be reachable from the Dokploy host (`DB_HOST` in Infisical). If MySQL runs on the old server, open it to the new host and keep `host.docker.internal` in mind for anything bound to localhost.

### 3. Move the data

The app keeps state outside the image. Copy it into the two named volumes before the first real deploy (find exact names with `docker volume ls | grep hibarr`):

```bash
# from the old server's shared directory
rsync -a /home/<user>/shared/user-uploads/ <dokploy-host>:/tmp/uploads/
rsync -a /home/<user>/shared/storage/      <dokploy-host>:/tmp/storage/
```

```bash
# on the Dokploy host, after one deploy has created the volumes
docker run --rm -v <project>_hibarr_uploads:/dest -v /tmp/uploads:/src alpine cp -a /src/. /dest/
docker run --rm -v <project>_hibarr_storage:/dest -v /tmp/storage:/src alpine cp -a /src/. /dest/
```

Do a bulk copy first, then a final catch-up copy during the cutover window. Check that the `APP_KEY` in Infisical is the one the old server uses (encrypted data depends on it).

## Cutover

1. Deploy staging first and test it end to end (login, uploads, a queued job, a reminder, the stale-version banner).
2. **Stop the old workers and cron before the new ones run.** Both sides read the same queue tables and both would run `schedule:run`, so reminders and imports would be processed twice. On the old host: `sudo supervisorctl stop 'hibarr_crm:*'` and remove the `schedule:run` crontab line.
3. Switch DNS (or the proxy) to Dokploy. Keep the old release directory for a few days.
4. Disable the Jenkins deploy for that environment once stable.

## Rollback

- **Bad release, same infrastructure:** set `IMAGE_TAG=develop-<previous short sha>` in Dokploy and redeploy from the Dokploy UI (the deploy pipeline's release check would reject an older release). Images are immutable per sha.
- **Bad migration:** migrations are forward-only. Restore the database from backup; rolling the image back does not undo schema changes.
- **Whole move:** point DNS back at the old server and restart its workers and cron.

## Not verified

This was written without access to a Dokploy instance or a Docker registry, so these are unproven until the first staging deploy:

- That a Compose app's deploy webhook accepts the same POST the other repos send (`{"image": ...}`) and simply redeploys, ignoring the body. The body is meaningful for image-source Applications; a Compose app takes its image from `IMAGE_TAG`.
- That Dokploy attaches the Traefik network and labels to `app` from the Domains tab for a Git-source Compose app.
- The full image build, the Woodpecker pipelines (their steps, the buildx plugin settings and the registry cache) and `docker compose up` ordering have not been run end to end; no Woodpecker server was available to lint or run them. The shared scripts were tested locally with stubs. The entrypoint's `migrate` role, the health endpoint (nginx + php-fpm) and the Compose file's resolution were tested locally with stubs.
- **gRPC layers:** `protoc` 3.21 (the Debian version) generated 266 classes that load under `google/protobuf` 4.33.5, the version `composer.lock` pins, and a message round-trips through its real descriptor parser; the entrypoint's `grpc` role was tested with a stub `rr` (runs as `www-data`, correct arguments, keeps its PID, receives SIGTERM); the version-drift and class checks were tested against the real lock file. Not verified, because the RoadRunner binary could not be downloaded or run in the sandbox: the release tarball's internal layout and `rr --version` output format (the build runs it, so CI will show), that the workers boot Laravel with no database (the Dockerfile's informational gRPC boot test covers it), and that Dokploy's Traefik honours the `h2c` service labels for gRPC (its docs were not reachable). Test with a real gRPC client against staging before moving production.
- **PDF layers:** the `pdf-tools` stage was built for real (it installed the pinned Puppeteer and downloaded the matching headless shell), and Browsershot 5.1.1's `browser.cjs` rendered a valid PDF from that Node, module layout and browser as both `root` and `www-data`. Not verified: the Debian package names in the runtime layer (the sandbox could not reach Debian's mirrors) and that the fonts render as intended. The first CI run's image build and `smoke-pdf.sh` are the check for both.
