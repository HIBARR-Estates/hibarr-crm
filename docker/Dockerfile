# syntax=docker/dockerfile:1
#
# HTTP-only Hibarr CRM image (nginx + PHP-FPM). No RoadRunner / gRPC.

# -----------------------------------------------------------------------------
# Composer dependencies
# -----------------------------------------------------------------------------
FROM composer:2 AS vendor

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install \
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
COPY . .
RUN printf '%s\n' \
      'APP_NAME=Hibarr' \
      'APP_ENV=production' \
      'APP_KEY=base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=' \
      'APP_DEBUG=false' \
      'APP_URL=http://localhost' \
      'GRPC_ENABLED=false' \
      > .env \
    && php artisan ziggy:generate --ansi

# -----------------------------------------------------------------------------
# Frontend assets (Laravel Mix production build)
# -----------------------------------------------------------------------------
FROM node:20-bookworm AS assets

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --fund=false

COPY . .
COPY --from=ziggy /app/resources/js/ziggy.js ./resources/js/ziggy.js
RUN npm run production

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
