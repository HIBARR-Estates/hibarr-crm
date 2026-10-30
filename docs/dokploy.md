# Deploying the CRM on Dokploy

Replaces the Jenkins "build on the server, switch a symlink" deploy with: CI builds one image, Dokploy pulls and runs it.

```
push to develop/main
  -> GitHub Actions builds + smoke-tests the image, pushes ghcr.io/hibarr-estates/hibarr-crm:<branch> and :sha-<short>
  -> deploy job calls Dokploy's compose.deploy
  -> Dokploy: docker compose up  (pull image -> migrate -> app, queue, scheduler)
  -> deploy job polls /build-version.json until the new release answers
```

Nothing is built on the Dokploy host. The Compose file is `docker-compose.dokploy.yml`.

## Blockers before retiring Jenkins

One thing is left that would break in a container, so keep the Jenkins deploy for production until it is handled.

| Gap | Why it matters | What is needed |
| --- | --- | --- |
| **Faker at runtime** | The image installs `--no-dev`, but `TeamDashboardDemoDataService` uses Faker (a dev dependency). | Move `fakerphp/faker` to `require` (needs a lock-file update), or stop using it at runtime. |

Expose PDFs and the gRPC server are covered below. Also see "Not verified" before the first production cutover.

## Expose PDFs

Expose PDFs (`PdfGenerator` -> Spatie Laravel PDF -> Browsershot -> Node -> Puppeteer -> Chrome) work in the image, so web downloads and queued jobs both run in containers.

- **What is in the image:** Node 20, `puppeteer` at the exact version `package-lock.json` pins (installed globally, because Browsershot resolves it through `npm root -g`), Chrome's system libraries, and the fonts the templates name (DejaVu Sans, Open Sans, Liberation for Helvetica/Arial, emoji). `PUPPETEER_CACHE_DIR=/opt/puppeteer` lets Puppeteer find its browser, since the app never passes a Chrome path.
- **Only `chrome-headless-shell` is installed.** Browsershot launches `headless: 'shell'` unless the app calls `newHeadless()`, which it does not, and that mode needs Puppeteer's separate headless-shell build. Full Chrome would add about 360 MB. If the app ever switches, build with `--build-arg PUPPETEER_BROWSERS="chrome chrome-headless-shell"`.
- **Image size:** the PDF layers add roughly 420 MB (Node 95 MB, modules 74 MB, headless shell 251 MB) plus Chrome's libraries and fonts.
- **Own worker:** the `expose` service runs only the `expose` queue (jobs can run 7 minutes), so a long render never delays other jobs. The default `queue` worker deliberately does not listen to `expose`.
- **Build time:** the bundler stage now skips Puppeteer's browser download (`PUPPETEER_SKIP_DOWNLOAD`), which used to fetch about 600 MB during `npm ci`. The Chrome download happens once, in its own stage keyed on the Puppeteer version, so it is cached until Puppeteer changes.
- **CI check:** `scripts/ci/smoke-pdf.sh` runs inside the built image and renders a PDF through Browsershot's real node script as `root` and `www-data`, after checking Chrome's libraries and the font directories.

## gRPC server

The image can run the RoadRunner gRPC server that Jenkins hosts run today (`worker.php`, `.rr.staging.yaml`, same services and API-token auth). It is the `grpc` service in `docker-compose.dokploy.yml`, behind the Compose profile `grpc`, so an environment only runs it when `COMPOSE_PROFILES=grpc` is set in Dokploy's Environment tab.

- **What is in the image:** the RoadRunner binary at the release `composer.lock` pins for `spiral/roadrunner` (the Dockerfile reads the version from the lock, so server and PHP library cannot drift; CI also compares `rr --version` with the lock), and the protobuf classes, which a build stage generates with `protoc` from `proto/` (the container equivalent of `make proto`; `app/Grpc/Generated` is not committed).
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

### 1. GitHub

Create two Environments, `staging` and `production` (add required reviewers to `production` for a manual approval gate). In each:

| Kind | Name | Value |
| --- | --- | --- |
| Variable | `DOKPLOY_URL` | e.g. `https://dokploy.example.com` |
| Variable | `DOKPLOY_COMPOSE_ID` | the Compose app's id (from `project.all`, or the app's URL) |
| Variable | `APP_URL` | the public URL, used to confirm the release is live |
| Secret | `DOKPLOY_API_KEY` | an API key from your Dokploy profile |

Then set the repository variable `DOKPLOY_ENABLED=true`. Until it is set, the deploy job is skipped. `develop` deploys to `staging`, `main` to `production`. Pushes to `staging` build and publish an image but do not auto-deploy.

Also allow package publishing: Settings → Actions → Workflow permissions → read and write.

### 2. Dokploy host

- Log the host in to GHCR so it can pull the private image: `docker login ghcr.io -u <user>` with a token that has `read:packages`. (Dokploy's Registry settings apply to Applications; for Compose, log in on the host.)
- Create a **Compose** application. Source: Git, this repository, branch `develop` (or `main`), compose path `./docker-compose.dokploy.yml`. Leave Auto Deploy off: CI triggers the deploy after the image exists.
- Environment tab:

```
IMAGE_TAG=develop            # main for production; sha-<short> pins a release
APP_URL=https://crm.example.com
INFISICAL_API_URL=https://infisical.hibarr.org
INFISICAL_PROJECT_ID=<id from .infisical.json>
INFISICAL_ENV=staging        # prod for production
INFISICAL_CLIENT_ID=<machine identity>
INFISICAL_CLIENT_SECRET=<machine identity secret>
```

- Domains tab: add the domain for service `app`, container port `80`, HTTPS on. The app trusts Docker's private ranges for forwarded headers, so Traefik in front works without extra settings. Dokploy adds the Traefik labels and network; no ports are published.
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

- **Bad release, same infrastructure:** set `IMAGE_TAG=sha-<previous short sha>` in Dokploy and redeploy. Images are immutable per sha.
- **Bad migration:** migrations are forward-only. Restore the database from backup; rolling the image back does not undo schema changes.
- **Whole move:** point DNS back at the old server and restart its workers and cron.

## Not verified

This was written without access to a Dokploy instance or a Docker registry, so these are unproven until the first staging deploy:

- The `compose.deploy` request shape (`POST /api/compose.deploy`, `x-api-key` header, `{"composeId": ...}`) follows community deploy actions and Dokploy's auto-deploy docs; confirm against the API reference of your Dokploy version.
- That Dokploy attaches the Traefik network and labels to `app` from the Domains tab for a Git-source Compose app.
- The full image build, the workflows and `docker compose up` ordering have not been run end to end. The entrypoint's `migrate` role, the health endpoint (nginx + php-fpm) and the Compose file's resolution were tested locally with stubs.
- **gRPC layers:** `protoc` 3.21 (the Debian version) generated 266 classes that load under `google/protobuf` 4.33.5, the version `composer.lock` pins, and a message round-trips through its real descriptor parser; the entrypoint's `grpc` role was tested with a stub `rr` (runs as `www-data`, correct arguments, keeps its PID, receives SIGTERM); the version-drift and class checks were tested against the real lock file. Not verified, because the RoadRunner binary could not be downloaded or run in the sandbox: the release tarball's internal layout and `rr --version` output format (the build runs it, so CI will show), that the workers boot Laravel with no database (the informational "gRPC boot test" step covers it), and that Dokploy's Traefik honours the `h2c` service labels for gRPC (its docs were not reachable). Test with a real gRPC client against staging before moving production.
- **PDF layers:** the `pdf-tools` stage was built for real (it installed the pinned Puppeteer and downloaded the matching headless shell), and Browsershot 5.1.1's `browser.cjs` rendered a valid PDF from that Node, module layout and browser as both `root` and `www-data`. Not verified: the Debian package names in the runtime layer (the sandbox could not reach Debian's mirrors) and that the fonts render as intended. The first CI run's image build and `smoke-pdf.sh` are the check for both.
