# syntax=docker/dockerfile:1
#
# HTTP-only Hibarr CRM image (nginx + PHP-FPM). No RoadRunner / gRPC.

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
# Runtime: nginx + PHP-FPM (supervisord)
# -----------------------------------------------------------------------------
FROM php:8.3-fpm-bookworm

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

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/hibarr.conf"]
