# syntax=docker/dockerfile:1
#
# Hibarr CRM image (nginx + PHP-FPM), built in flavors from one file:
#
#   runtime (default, lean)   web/queue base. No browser, no gRPC.
#   FLAVOR=pdf                + Node, Puppeteer and Chromium. Needed by the
#                               services that render expose PDFs: app (sync
#                               download), expose (queue worker), scheduler
#                               (its fallback queue:work also drains `expose`).
#   --target grpc             + protoc-generated classes and the RoadRunner
#                               binary, for the gRPC service.
#
# docker-compose.yml picks the flavor per service, so only those services carry
# Chromium and the lean services stay small.

# Selects the base for the `app` stage below. Must come before the first FROM.
ARG FLAVOR=lean

# -----------------------------------------------------------------------------
# Frontend assets (Vite). Blade still requests fixed css/js paths.
# -----------------------------------------------------------------------------
FROM node:20-bookworm AS assets

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --fund=false

COPY . .
RUN sed -i 's/\r$//' docker/build-blade-assets.sh \
    && npm run v-build \
    && bash docker/build-blade-assets.sh

# -----------------------------------------------------------------------------
# Puppeteer module only. Chromium comes from apt in the pdf flavor, so skip
# Puppeteer's own browser download.
# -----------------------------------------------------------------------------
FROM node:20-bookworm-slim AS puppeteer

WORKDIR /opt/pptr
RUN PUPPETEER_SKIP_DOWNLOAD=1 npm install --no-audit --fund=false --omit=dev puppeteer@24

# -----------------------------------------------------------------------------
# System layer: nginx + PHP-FPM (supervisord), no application code yet
# -----------------------------------------------------------------------------
FROM php:8.3-fpm-bookworm AS system-lean

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
        libxslt1-dev \
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
        sockets \
        xsl \
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

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

COPY docker/php/php.ini /usr/local/etc/php/conf.d/99-hibarr.ini
COPY docker/php/zz-www.conf /usr/local/etc/php-fpm.d/zz-www.conf
COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/hibarr.conf
COPY docker/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN sed -i 's/\r$//' /usr/local/bin/entrypoint.sh /usr/local/bin/healthcheck.sh \
    && chmod +x /usr/local/bin/entrypoint.sh /usr/local/bin/healthcheck.sh \
    && sed -i 's/^listen = .*/listen = 127.0.0.1:9000/' /usr/local/etc/php-fpm.d/www.conf \
    && sed -i 's/^listen = .*/listen = 127.0.0.1:9000/' /usr/local/etc/php-fpm.d/zz-docker.conf 2>/dev/null || true

# -----------------------------------------------------------------------------
# pdf flavor: Node + Puppeteer + Chromium for Browsershot
# -----------------------------------------------------------------------------
FROM system-lean AS system-pdf

RUN apt-get update && apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
        fonts-noto-core \
        fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

COPY --from=puppeteer /usr/local/bin/node /usr/local/bin/node
COPY --from=puppeteer /opt/pptr /opt/pptr

# Read by PdfGenerator through config/pdf_browser.php. entrypoint.sh copies
# them into .env, because Infisical's export replaces the file.
ENV BROWSERSHOT_NODE_BINARY=/usr/local/bin/node \
    BROWSERSHOT_NODE_MODULES_PATH=/opt/pptr/node_modules \
    BROWSERSHOT_CHROME_PATH=/usr/bin/chromium

# -----------------------------------------------------------------------------
# Application: composer deps, code, built assets
# -----------------------------------------------------------------------------
FROM system-${FLAVOR} AS app

WORKDIR /var/www/html

# Installed here, not in a composer:2 stage, so composer checks the real PHP
# version and extensions of this image. A missing extension fails the build.
COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-interaction \
        --prefer-dist \
        --optimize-autoloader \
        --no-scripts

COPY . .
COPY --from=assets /app/public/build ./public/build
COPY --from=assets /app/public/css ./public/css
COPY --from=assets /app/public/js ./public/js
# The Blade bundle is assembled via mktemp (mode 600). nginx runs as
# www-data and would 403 js/main.js, which leaves the page preloader up.
RUN chmod -R a+rX public/build public/css public/js

# Release id for the stale-build banner (AppBuild reads this file, the browser
# polls /build-version.json). Format: <prefix>-<commit>-<UTC timestamp>.
# The timestamp keeps every image unique, including rebuilds of one commit.
# Coolify supplies SOURCE_COMMIT; elsewhere pass BUILD_ID (e.g. a git sha).
ARG BUILD_PREFIX=hibarr-crm
ARG BUILD_ID=
ARG SOURCE_COMMIT=
RUN commit="${SOURCE_COMMIT:-${BUILD_ID:-nocommit}}" \
    && printf '{"id":"%s-%.12s-%s"}\n' "${BUILD_PREFIX}" "$commit" "$(date -u +%Y%m%d%H%M%S)" > public/build-version.json \
    && chmod 644 public/build-version.json

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

EXPOSE 80

# Platforms that deploy this image (and ignore a compose healthcheck) run the
# image check. 302 from / is success. Workers exit 0 without opening port 80.
HEALTHCHECK --interval=30s --timeout=10s --start-period=300s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/hibarr.conf"]

# -----------------------------------------------------------------------------
# gRPC (RoadRunner). `docker build --target grpc`; CONTAINER_ROLE=grpc runs it.
# Generated classes are not in git, so they are built here from proto/ with a
# protoc that matches the google/protobuf runtime in composer.lock.
# -----------------------------------------------------------------------------
FROM app AS grpc

ARG TARGETARCH
ARG PROTOC_VERSION=33.5

RUN case "${TARGETARCH:-amd64}" in \
        arm64) PROTOC_ARCH=aarch_64 ;; \
        *) PROTOC_ARCH=x86_64 ;; \
    esac \
    && curl -fsSL -o /tmp/protoc.zip \
        "https://github.com/protocolbuffers/protobuf/releases/download/v${PROTOC_VERSION}/protoc-${PROTOC_VERSION}-linux-${PROTOC_ARCH}.zip" \
    && unzip -q /tmp/protoc.zip -d /usr/local bin/protoc 'include/*' \
    && rm -f /tmp/protoc.zip \
    && protoc --version

# Same file list as `make proto` and .rr.staging.yaml.
RUN mkdir -p app/Grpc/Generated \
    && protoc --proto_path=proto --php_out=app/Grpc/Generated \
        $(grep -o 'proto/[a-z_]*\.proto' .rr.staging.yaml | sort -u) \
    && if [ -d app/Grpc/Generated/App/Grpc/Generated ]; then \
        cp -r app/Grpc/Generated/App/Grpc/Generated/* app/Grpc/Generated/ \
        && rm -rf app/Grpc/Generated/App; \
    fi \
    && composer dump-autoload --optimize --no-interaction --no-scripts \
    && php vendor/bin/rr get-binary --no-interaction \
    && chmod +x rr \
    && chown -R www-data:www-data app/Grpc/Generated

ENV GRPC_ENABLED=true
EXPOSE 9010 2114

# -----------------------------------------------------------------------------
# Default target: the web/queue image (flavor chosen by --build-arg FLAVOR)
# -----------------------------------------------------------------------------
FROM app AS runtime
