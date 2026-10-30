# syntax=docker/dockerfile:1
#
# Hibarr CRM image: nginx + PHP-FPM for the web app, plus the same code run as a
# queue worker, scheduler, one-shot migrator or RoadRunner gRPC server,
# depending on CONTAINER_ROLE (see entrypoint.sh).

# -----------------------------------------------------------------------------
# Composer dependencies
# -----------------------------------------------------------------------------
FROM composer:2 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./
# The cache mount keeps downloaded packages between builds on the same builder,
# so a lock-file change only fetches the packages that actually changed.
RUN --mount=type=cache,target=/tmp/cache \
    composer install \
        --no-dev \
        --no-interaction \
        --prefer-dist \
        --optimize-autoloader \
        --no-scripts \
        --ignore-platform-reqs

# -----------------------------------------------------------------------------
# Ziggy route file (needed by Mix / frontend)
# -----------------------------------------------------------------------------
FROM php:8.3-cli-bookworm AS ziggy

RUN apt-get update && apt-get install -y --no-install-recommends \
        libzip-dev \
        libicu-dev \
        libonig-dev \
        libpng-dev \
        git \
        unzip \
    && docker-php-ext-install -j$(nproc) bcmath intl mbstring zip \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=vendor /app/vendor ./vendor
# Only what booting the app to list routes needs. Copying the whole repo here
# made every frontend, test or docs change re-run this stage. The generated
# ziggy.js is content-addressed when the assets stage copies it, so a change
# that leaves the routes identical does not rebuild the frontend.
COPY artisan composer.json ./
COPY bootstrap ./bootstrap
COPY config ./config
COPY database ./database
COPY routes ./routes
COPY app ./app
COPY resources/lang ./resources/lang
COPY resources/views ./resources/views
# bootstrap/cache is gitignored and empty, so COPY . . does not create it.
# Artisan package discovery needs that directory to be present and writable.
RUN mkdir -p \
      bootstrap/cache \
      storage/framework/cache/data \
      storage/framework/sessions \
      storage/framework/views \
      storage/logs \
    && printf '%s\n' \
      'APP_NAME=Hibarr' \
      'APP_ENV=production' \
      'APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' \
      'APP_DEBUG=false' \
      'APP_URL=http://localhost' \
      'GRPC_ENABLED=false' \
      'LOG_CHANNEL=stderr' \
      'OTEL_LOGS_ENABLED=false' \
      > .env \
    && php artisan ziggy:generate --ansi

# -----------------------------------------------------------------------------
# Frontend assets (Laravel Mix production build)
# -----------------------------------------------------------------------------
FROM node:20-bookworm AS assets

WORKDIR /app
COPY package.json package-lock.json ./
# `puppeteer` is a dependency (Expose PDFs), and its install step downloads
# ~600 MB of Chrome. The bundler never launches a browser; the runtime image
# gets Chrome from the pdf-tools stage below.
ENV PUPPETEER_SKIP_DOWNLOAD=true
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --fund=false --prefer-offline

# Only what webpack reads. tailwind.config.js scans resources/** and app/**/*.php
# for class names, so `app` stays in; everything else (tests, docs, database,
# config, routes, lang) no longer invalidates the slow build below.
COPY webpack.mix.js tailwind.config.js postcss.config.js tsconfig.json .babelrc ./
COPY public/vendor ./public/vendor
COPY app ./app
COPY resources/css ./resources/css
COPY resources/scss ./resources/scss
COPY resources/views ./resources/views
COPY resources/js ./resources/js
COPY --from=ziggy /app/resources/js/ziggy.js ./resources/js/ziggy.js
# (.dockerignore already excludes public/js and public/css: Mix regenerates them.)
#
# WEBPACK_FS_CACHE + the cache mount keep webpack's module cache between builds
# on the same builder, so a rebuild after a small change skips most compilation.
RUN --mount=type=cache,target=/app/node_modules/.cache \
    WEBPACK_FS_CACHE=1 npm run production

# -----------------------------------------------------------------------------
# PDF tooling for Expose (Spatie Laravel PDF -> Browsershot -> Node -> Puppeteer
# -> Chrome). Browsershot runs `node vendor/spatie/browsershot/bin/browser.cjs`
# with NODE_PATH=`npm root -g`, so puppeteer must be installed globally, and the
# app never passes an executable path, so Puppeteer must find Chrome in its own
# cache. Same arrangement as the Jenkins hosts (puppeteer + its managed Chrome).
# -----------------------------------------------------------------------------
# Only the pinned version leaves this stage, so the Chrome download below is
# re-run when puppeteer changes, not whenever any dependency does.
FROM node:20-bookworm-slim AS pdf-version
WORKDIR /tmp/lock
COPY package-lock.json ./
RUN node -p "require('./package-lock.json').packages['node_modules/puppeteer'].version" > /puppeteer-version

FROM node:20-bookworm-slim AS pdf-tools
# Browsershot launches Chrome with `headless: 'shell'` unless the app calls
# newHeadless() (it does not), and that mode needs puppeteer's separate
# chrome-headless-shell build; full Chrome is not used. If the app ever switches,
# build with --build-arg PUPPETEER_BROWSERS="chrome chrome-headless-shell".
ARG PUPPETEER_BROWSERS=chrome-headless-shell
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer \
    PUPPETEER_SKIP_DOWNLOAD=true
COPY --from=pdf-version /puppeteer-version /tmp/puppeteer-version
RUN --mount=type=cache,target=/root/.npm \
    npm install -g --no-audit --fund=false "puppeteer@$(cat /tmp/puppeteer-version)" \
    && for browser in ${PUPPETEER_BROWSERS}; do PUPPETEER_SKIP_DOWNLOAD= puppeteer browsers install "$browser"; done \
    && chmod -R a+rX /opt/puppeteer

# -----------------------------------------------------------------------------
# gRPC server: RoadRunner binary + protobuf-generated PHP classes.
# -----------------------------------------------------------------------------
# Same release as the spiral/roadrunner package pinned in composer.lock, so the
# server and the PHP worker library stay in step. The asset layout is not
# assumed beyond "a file named rr", and `rr --version` runs at build time, so a
# wrong URL or architecture fails the build instead of the container.
FROM php:8.3-cli-bookworm AS rr-bin
ARG TARGETARCH
WORKDIR /tmp/rr
COPY composer.lock ./
RUN set -eux; \
    version="$(php -r '$l = json_decode(file_get_contents("composer.lock"), true); foreach ($l["packages"] as $p) { if ($p["name"] === "spiral/roadrunner") { echo ltrim($p["version"], "v"); } }')"; \
    test -n "$version"; \
    curl -fsSL -o rr.tgz "https://github.com/roadrunner-server/roadrunner/releases/download/v${version}/roadrunner-${version}-linux-${TARGETARCH:-amd64}.tar.gz"; \
    mkdir out; \
    tar -xzf rr.tgz -C out; \
    install -m 0755 "$(find out -type f -name rr | head -n 1)" /usr/local/bin/rr; \
    rr --version

# `make proto` equivalent. protoc nests its output under the PHP namespace path
# (App/Grpc/Generated/...); the app autoloads App\Grpc\Generated\ from
# app/Grpc/Generated, so the nested directory is lifted out. Debian's protoc
# (3.21) matches what the Ubuntu hosts generated with. Only `proto/` is copied,
# so this layer rebuilds when a .proto changes and not otherwise.
FROM debian:bookworm-slim AS proto-gen
RUN apt-get update && apt-get install -y --no-install-recommends protobuf-compiler \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
COPY proto ./proto
RUN mkdir -p /out /gen \
    && protoc --proto_path=proto --php_out=/out proto/*.proto \
    && cp -r /out/App/Grpc/Generated/. /gen/

# -----------------------------------------------------------------------------
# Runtime: nginx + PHP-FPM (supervisord)
# -----------------------------------------------------------------------------
FROM php:8.3-fpm-bookworm AS runtime

ARG TARGETARCH
ARG INFISICAL_CLI_VERSION=0.43.78

ENV COMPOSER_ALLOW_SUPERUSER=1 \
    GRPC_ENABLED=false \
    INFISICAL_DISABLE_UPDATE_CHECK=true

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        unzip \
        zip \
        nginx \
        supervisor \
        libicu-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev \
        libzip-dev \
        libonig-dev \
        libxml2-dev \
        default-mysql-client \
    && docker-php-ext-configure gd --with-freetype --with-jpeg \
    && docker-php-ext-install -j$(nproc) \
        bcmath \
        exif \
        gd \
        intl \
        mbstring \
        opcache \
        pcntl \
        pdo_mysql \
        zip \
    && pecl install redis \
    && docker-php-ext-enable redis \
    && ARCH="${TARGETARCH:-amd64}" \
    && curl -fsSL -o /tmp/infisical-cli.tar.gz \
        "https://github.com/Infisical/cli/releases/download/v${INFISICAL_CLI_VERSION}/cli_${INFISICAL_CLI_VERSION}_linux_${ARCH}.tar.gz" \
    && tar -xzf /tmp/infisical-cli.tar.gz -C /usr/local/bin infisical \
    && chmod +x /usr/local/bin/infisical \
    && rm -f /tmp/infisical-cli.tar.gz \
    && infisical --version \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default

# PDF rendering for Expose. Kept after the PHP extension layer above so changing
# it does not recompile PHP extensions. Libraries are Chrome's runtime needs;
# fonts are the ones the Expose templates name (DejaVu Sans, Open Sans,
# Helvetica/Arial via Liberation) plus emoji.
RUN apt-get update && apt-get install -y --no-install-recommends \
        fonts-dejavu-core \
        fonts-liberation \
        fonts-noto-color-emoji \
        fonts-open-sans \
        libasound2 \
        libatk-bridge2.0-0 \
        libatk1.0-0 \
        libcairo2 \
        libcups2 \
        libdbus-1-3 \
        libdrm2 \
        libexpat1 \
        libfontconfig1 \
        libgbm1 \
        libglib2.0-0 \
        libnspr4 \
        libnss3 \
        libpango-1.0-0 \
        libx11-6 \
        libx11-xcb1 \
        libxcb1 \
        libxcomposite1 \
        libxdamage1 \
        libxext6 \
        libxfixes3 \
        libxkbcommon0 \
        libxrandr2 \
        xdg-utils \
    && rm -rf /var/lib/apt/lists/*
COPY --from=pdf-tools /usr/local/bin/node /usr/local/bin/node
COPY --from=pdf-tools /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
    && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx
COPY --from=pdf-tools /opt/puppeteer /opt/puppeteer
# php-fpm (clear_env = no) and the queue worker inherit this, so Puppeteer finds
# the matching Chrome without the app configuring a path.
ENV PUPPETEER_CACHE_DIR=/opt/puppeteer

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-hibarr.ini
COPY docker/php/zz-www.conf /usr/local/etc/php-fpm.d/zz-www.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/hibarr.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh \
    && chmod +x /usr/local/bin/entrypoint.sh \
    && sed -i 's/^listen = .*/listen = 127.0.0.1:9000/' /usr/local/etc/php-fpm.d/www.conf \
    && sed -i 's/^listen = .*/listen = 127.0.0.1:9000/' /usr/local/etc/php-fpm.d/zz-docker.conf 2>/dev/null || true

WORKDIR /var/www/html

COPY . .
COPY --from=vendor /app/vendor ./vendor
COPY --from=assets /app/public/js ./public/js
COPY --from=assets /app/public/css ./public/css
COPY --from=assets /app/public/mix-manifest.json ./public/mix-manifest.json
COPY --from=ziggy /app/resources/js/ziggy.js ./resources/js/ziggy.js
# gRPC: generated classes must be in place before the autoload dump below so
# they land in the optimized classmap.
COPY --from=proto-gen /gen/ ./app/Grpc/Generated/
COPY --from=rr-bin /usr/local/bin/rr /usr/local/bin/rr

RUN composer dump-autoload --optimize --no-interaction --no-scripts \
    && mkdir -p \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        storage/app/public \
        bootstrap/cache \
        public/user-uploads \
        /var/log/supervisor \
        /run/nginx \
    && chown -R www-data:www-data storage bootstrap/cache public/user-uploads \
    && chmod -R ug+rwx storage bootstrap/cache public/user-uploads

# Release identity for the "new version available" banner (app/Support/AppBuild.php,
# resources/js/lib/staleBuildCheck.ts). Same shape the Jenkins build wrote with
# `make write-build-version`. Last on purpose: it changes every build, and
# nothing above should be invalidated by it. CI also polls this file after a
# deploy to confirm the new release is the one answering.
ARG BUILD_ID=docker
ARG GIT_SHA=unknown
RUN printf '{"id":"%s-%s"}\n' "$BUILD_ID" "$(printf '%s' "$GIT_SHA" | cut -c1-7)" > public/build-version.json

EXPOSE 80

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/hibarr.conf"]

# -----------------------------------------------------------------------------
# CI smoke test. `docker build --target smoke .` runs the checks below as build
# steps, so building the target IS the test: no running Docker daemon is needed in
# a later pipeline step, and the checks run inside the exact image that gets
# published (which also proves the frontend bundle compiles). Nothing outside
# CI builds this target, and BuildKit skips it when building `final`.
# -----------------------------------------------------------------------------
FROM runtime AS smoke
COPY scripts/ci /ci
RUN sh /ci/smoke-image.sh \
    && sh /ci/smoke-pdf.sh \
    && sh /ci/smoke-grpc.sh
# Starts RoadRunner with the real worker.php. Informational until it has passed
# once in CI (the workers boot Laravel without a database), so it never fails the build.
RUN GRPC_BOOT=1 sh /ci/smoke-grpc.sh || echo "gRPC boot test failed (informational, see the log above)"

# -----------------------------------------------------------------------------
# The default (last) stage is what `docker build .` and the pipeline's publish
# step produce: the runtime image, without the smoke test's /ci scripts.
# -----------------------------------------------------------------------------
FROM runtime AS final
