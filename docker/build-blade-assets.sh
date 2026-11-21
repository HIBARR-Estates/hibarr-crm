#!/usr/bin/env bash
# Blade screens load fixed paths (asset('css/main.css'), asset('js/main.js'),
# asset('css/tailwind.css')). Vite builds the Inertia app; this emits the
# legacy files those templates already request.
set -euo pipefail

mkdir -p public/css public/js

npx sass resources/scss/main.scss public/css/main.css --style=compressed --no-source-map

node docker/build-tailwind.js

npx esbuild resources/js/bootstrap.js \
    --bundle \
    --format=iife \
    --platform=browser \
    --outfile=public/js/bootstrap.js \
    --define:process.env.MIX_PUSHER_APP_KEY=\"\" \
    --define:process.env.MIX_PUSHER_APP_CLUSTER=\"\"

tmp="$(mktemp)"
cat \
    public/js/bootstrap.js \
    public/vendor/bootstrap/js/bootstrap.bundle.min.js \
    public/vendor/moment/moment-with-locales.min.js \
    public/vendor/moment/moment-timezone-with-data-10-year-range.js \
    public/vendor/jquery/all.min.js \
    public/vendor/jquery/datepicker.min.js \
    public/vendor/jquery/select2.min.js \
    public/vendor/jquery/plugins.bundle.min.js \
    public/vendor/jquery/scripts.bundle.min.js \
    public/vendor/froiden-helper/helper.js \
    node_modules/dropify/src/js/dropify.js \
    node_modules/sweetalert2/dist/sweetalert2.all.min.js \
    node_modules/cropperjs/dist/cropper.js \
    node_modules/bootstrap-select/js/bootstrap-select.js \
    node_modules/quill/dist/quill.min.js \
    node_modules/quill-emoji/dist/quill-emoji.js \
    node_modules/quill-mention/dist/quill.mention.min.js \
    node_modules/quill-magic-url/dist/index.js \
    resources/js/main.js \
    resources/js/custom.js \
    > "$tmp"
mv "$tmp" public/js/main.js
