#!/usr/bin/env bash
# HIBARR CI Infrastructure — shared PHP extension setup (laravel-app)
#
# The official php:*-cli-bookworm image already has ctype, curl, dom, fileinfo,
# iconv, mbstring, openssl, phar, session, simplexml, sodium, tokenizer, xml*,
# zlib, sqlite3 and pdo_sqlite. Laravel apps with PDF/image/intl/Excel features
# also need the handful below, which are not in the base image.
#
# Woodpecker runs every step in a fresh container, so each step that executes PHP
# code (tests, static analysis) calls this once. It compiles from source, which
# takes a couple of minutes; if that becomes the bottleneck, bake these into a CI
# image and point the template's &phpImage at it instead.
#
# Override the list with PHP_EXTENSIONS (space separated). The default matches
# what hibarr-crm's composer.lock requires beyond the base image.
#
# Requires: root in a Debian-based php image (the official image's default).

set -euo pipefail

extensions="${PHP_EXTENSIONS:-bcmath gd intl sockets xsl zip}"

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq --no-install-recommends \
  git unzip \
  libicu-dev libzip-dev libxslt1-dev \
  libpng-dev libjpeg62-turbo-dev libfreetype6-dev

case " $extensions " in
  *" gd "*) docker-php-ext-configure gd --with-freetype --with-jpeg ;;
esac

# shellcheck disable=SC2086 # word splitting of the extension list is intended
docker-php-ext-install -j"$(nproc)" $extensions

# Fail here with a clear message, not later as "Class not found" mid-test-run.
loadedModules="$(php -m | tr 'A-Z' 'a-z')"
for extensionName in $extensions; do
  echo "$loadedModules" | grep -qx -- "$extensionName" || {
    echo "PHP extension '$extensionName' did not load after install" >&2
    exit 1
  }
done

php -v | head -n 1
