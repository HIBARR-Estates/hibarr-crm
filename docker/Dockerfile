# syntax=docker/dockerfile:1
#
# HTTP-only Hibarr CRM image (nginx + PHP-FPM). No RoadRunner / gRPC.

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
# polls /build-version.json). The timestamp makes every build unique even when
# the platform passes no build args; Coolify supplies SOURCE_COMMIT.
ARG BUILD_ID=
ARG SOURCE_COMMIT=
RUN id="${BUILD_ID:-${SOURCE_COMMIT:-build}}" \
    && printf '{"id":"%s-%s"}\n' "$(printf '%.12s' "$id")" "$(date -u +%Y%m%d%H%M%S)" > public/build-version.json \
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
