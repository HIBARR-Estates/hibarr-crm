<?php

namespace App\Services\PdfExpose\Builders;

use Endroid\QrCode\Builder\Builder;
use Endroid\QrCode\Writer\PngWriter;
use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;

class TemplateRenderer
{
    /**
     * Return branding asset URLs used across expose templates.
     *
     * Minio-hosted images are fetched over HTTPS and cached as base64.
     * Local app images (served from public/) are resolved to disk files by
     * tryReadLocal() and converted without any HTTP request.
     *
     * Using a static method (rather than a const) allows calling url() at
     * runtime so local asset paths resolve correctly in all environments.
     */
    private static function getBrandingUrls(): array
    {
        return [
            // — Minio-hosted branding images —
            // 'logo_expose'             => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719874403-1303eff6-hibarr-expose.png',
            // 'logo_rounded'            => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719912107-6b8eafb3-hibarr-rounded.png',
            // 'logo_white'              => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719985906-ae8b2c90-logo-white.png',
            // 'block_title'             => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719787183-e155489e-block-title.svg',
            // 'logo_full'               => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719947639-23a7e25b-logo.png',
            'name_space'              => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778193858830-ad66988e-name-space.png',
            'hibarr_expose_text'      => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778194049167-64036beb-hibarr-expose-text.png',
            'project_overview'        => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778220690459-2ef518d6-project-overview-space-for-img.png',
            'cover_image_project'     => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778197940203-011a688d-cover-image-project.png',
            'project_overview_example'=> 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778204830425-e578b585-project-overview.png',

            // — Local app assets (public/property/assets/) —
            // tryReadLocal() detects the APP_URL prefix and reads from disk,
            // so these are base64-encoded without any outbound HTTP request.
            'panther_watermark'       => url('/property/assets/panther_watermark.svg'),
            'logo_blue'               => url('/property/assets/logo_blue.svg'),
            'expose_name_client'      => url('/property/assets/expose_name_client.svg'),
            'sharp_page_header'       => url('/property/assets/sharp_page_header.svg'),
            'map'                     => url('/property/assets/map.svg'),
            'pin'                     => url('/property/assets/pin.svg'),
            'hibarr_expose_logo'         => url('/property/icons/hibarr-expose.png'),
            'logo_white'              => url('/property/icons/logo-white.png'),
            'logo_rounded'              => url('/property/icons/hibarr-rounded.png'),
            'block_title'              => url('/property/icons/block-title.svg'),
            'arrow'                    => url('/property/assets/arrow.svg'),
            'logo_full'                    => url('/property/icons/logo.png'),
            
        ];
    }

    /**
     * Render HTML from Blade template.
     *
     * Branding assets and local app images (company logo, agent photo) are
     * converted to base64 data URIs. Property/unit-type asset URLs are left
     * as remote URLs for Puppeteer to fetch directly — this avoids loading
     * all images into PHP memory and eliminates OOM errors.
     */
    public function render(ExposeConfiguration $config): string
    {
        $templatePath = $this->getTemplatePath($config);

        // Embed only local/branding images as base64; leave asset URLs for Puppeteer
        $data = $this->prepareImages($config->data);

        return View::make($templatePath, [
            'config' => $config,
            'data' => $data,
            'layout' => $config->layout,
        ])->render();
    }

    /**
     * Get template path based on entity type and layout
     */
    private function getTemplatePath(ExposeConfiguration $config): string
    {
        // Template naming convention:
        // resources/views/pdf/expose/{entity_type}/{layout}.blade.php
        return "pdf.expose.{$config->entityType}.{$config->layout}";
    }

    /**
     * Render individual section
     */
    public function renderSection(string $section, ExposeConfiguration $config): string
    {
        $sectionPath = "pdf.expose.sections.{$section}";

        if (!View::exists($sectionPath)) {
            return "<!-- Section {$section} not found -->";
        }

        return View::make($sectionPath, [
            'config' => $config,
            'data' => $config->data,
        ])->render();
    }

    /**
     * Prepare images for the template.
     *
     * Strategy:
     * - Property/unit-type asset URLs (Minio): LEFT AS-IS for Puppeteer to fetch.
     *   These are large photos and base64-encoding them causes PHP OOM errors.
     * - Company logo & agent photo: base64 ONLY if local app URL (avoids .test/.local loopback).
     *   If external (e.g. Minio), left as-is for Puppeteer.
     * - Branding images: always base64, cached 24h (small static files, ~50KB each).
     */
    private function prepareImages(array $data): array
    {
        // 1. Property/unit-type asset URLs — DO NOT base64 encode.
        //    Leave them as remote URLs. Puppeteer/Chrome fetches them directly.
        //    This is the key change that eliminates OOM errors.

        // 1.1 Resolve global outro images (local app URLs -> base64), and build QR data URI.
        if (!empty($data['expose_global_config']['outro']['primary_image_url'])) {
            $data['expose_global_config']['outro']['primary_image_url'] = self::localUrlToBase64(
                $data['expose_global_config']['outro']['primary_image_url']
            );
        }

        if (!empty($data['expose_global_config']['outro']['secondary_image_url'])) {
            $data['expose_global_config']['outro']['secondary_image_url'] = self::localUrlToBase64(
                $data['expose_global_config']['outro']['secondary_image_url']
            );
        }

        $qrEnabled = (bool) data_get($data, 'expose_global_config.qr.enabled', false);
        $qrLink = trim((string) data_get($data, 'expose_global_config.qr.link', ''));

        if ($qrEnabled && $qrLink !== '') {
            $data['expose_global_config']['qr']['qr_code_data_uri'] = $this->generateQrDataUri($qrLink);
        }

        // 2. Convert company logo only if it's a local app URL
        if (!empty($data['company']['logo'])) {
            $data['company']['logo'] = url('/property/icons/logo.png');
        }

        // 3. Convert agent image only if it's a local app URL
        if (!empty($data['agent']['image'])) {
            $data['agent']['image'] = self::localUrlToBase64($data['agent']['image']);
        }

        // 3.1 Convert location image only if it's a local app URL
        if (!empty($data['location_payload']['image_url'])) {
            $data['location_payload']['image_url'] = self::localUrlToBase64($data['location_payload']['image_url']);
        }

        // 3.2 Convert location infrastructure/airport images only if local app URLs
        if (!empty($data['location_infrastructure']) && is_array($data['location_infrastructure'])) {
            foreach ($data['location_infrastructure'] as &$item) {
                if (!empty($item['image'])) {
                    $item['image'] = self::localUrlToBase64($item['image']);
                }
            }
            unset($item);
        }

        if (!empty($data['location_airports']) && is_array($data['location_airports'])) {
            foreach ($data['location_airports'] as &$item) {
                if (!empty($item['image'])) {
                    $item['image'] = self::localUrlToBase64($item['image']);
                }
            }
            unset($item);
        }

        if (!empty($data['location_attractions']) && is_array($data['location_attractions'])) {
            foreach ($data['location_attractions'] as &$attraction) {
                if (!empty($attraction['primary_image_url'])) {
                    $attraction['primary_image_url'] = self::localUrlToBase64($attraction['primary_image_url']);
                }
                if (!empty($attraction['secondary_image_url'])) {
                    $attraction['secondary_image_url'] = self::localUrlToBase64($attraction['secondary_image_url']);
                }
            }
            unset($attraction);
        }

        // 4. Add branding images as base64 (cached for 24 hours)
        $data['branding'] = $this->getBrandingAssets();

        return $data;
    }

    /**
     * Generate a base64 data URI PNG for a QR code.
     */
    private function generateQrDataUri(string $link): ?string
    {
        try {
            $result = Builder::create()
                ->writer(new PngWriter())
                ->data($link)
                ->size(220)
                ->margin(10)
                ->build();

            return $result->getDataUri();
        } catch (\Throwable $e) {
            Log::warning('Expose PDF: failed to generate QR code', [
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }

    /**
     * Get branding assets as base64 data URIs.
     * Cached for 24 hours since these are static images.
     */
    private function getBrandingAssets(): array
    {
        return Cache::remember('expose_branding_base64', 86400, function () {
            $branding = [];

            foreach (static::getBrandingUrls() as $key => $url) {
                $branding[$key] = self::urlToBase64($url);
            }

            return $branding;
        });
    }

    /**
     * Convert a URL to base64 ONLY if it points to the local app (APP_URL).
     * External URLs are returned unchanged — Puppeteer will fetch them directly.
     *
     * This handles the case where company logos / agent photos are served
     * from the app itself (e.g. /user-uploads/...) and the app uses a
     * .test domain or localhost that Puppeteer can't resolve.
     */
    public static function localUrlToBase64(string $url): string
    {
        if (str_starts_with($url, 'data:') || !str_starts_with($url, 'http')) {
            return $url;
        }

        // Only convert if it's a local app URL
        $contents = self::tryReadLocal($url);

        if ($contents !== null) {
            return self::contentsToDataUri($contents, $url);
        }

        // External URL (Minio, CDN, etc.) — return as-is for Puppeteer
        return $url;
    }

    /**
     * Fetch a remote URL and return it as a base64 data URI.
     * Used ONLY for branding assets (small, cached, ~50KB each).
     *
     * Falls back to the original URL on failure so the template
     * still renders (Puppeteer may or may not load it).
     */
    public static function urlToBase64(string $url): string
    {
        if (str_starts_with($url, 'data:') || !str_starts_with($url, 'http')) {
            return $url;
        }

        try {
            // Try local file first
            $contents = self::tryReadLocal($url);

            if ($contents === null) {
                $context = stream_context_create([
                    'ssl' => [
                        'verify_peer' => false,
                        'verify_peer_name' => false,
                    ],
                    'http' => [
                        'timeout' => 15,
                        'user_agent' => 'Mozilla/5.0 HibarrCRM/1.0',
                    ],
                ]);

                $contents = @file_get_contents($url, false, $context);
            }

            if ($contents === false || $contents === null) {
                Log::warning("Expose PDF: failed to fetch branding image: {$url}");
                return $url;
            }

            return self::contentsToDataUri($contents, $url);
        } catch (\Exception $e) {
            Log::warning("Expose PDF: exception converting branding image to base64: {$url} — " . $e->getMessage());
            return $url;
        }
    }

    /**
     * Convert raw file contents to a data URI string.
     */
    private static function contentsToDataUri(string $contents, string $originalUrl): string
    {
        $finfo = new \finfo(FILEINFO_MIME_TYPE);
        $mime = $finfo->buffer($contents);

        // Handle SVG files (finfo may misidentify them as text/xml or text/html)
        if (str_ends_with($originalUrl, '.svg') || str_contains($contents, '<svg')) {
            $mime = 'image/svg+xml';
        }

        // Fix incorrect MIME detection (Minio returns binary/octet-stream for images)
        if (in_array($mime, ['application/octet-stream', 'binary/octet-stream', 'text/plain'])) {
            $ext = strtolower(pathinfo(parse_url($originalUrl, PHP_URL_PATH), PATHINFO_EXTENSION));
            $mime = match ($ext) {
                'png' => 'image/png',
                'jpg', 'jpeg' => 'image/jpeg',
                'gif' => 'image/gif',
                'svg' => 'image/svg+xml',
                'webp' => 'image/webp',
                default => 'image/png',
            };
        }

        return 'data:' . $mime . ';base64,' . base64_encode($contents);
    }

    /**
     * If the URL points to this application (matches APP_URL), resolve
     * it to a local file path under public/ and read directly from disk.
     *
     * Returns the file contents on success, or null if the URL is external
     * or the file doesn't exist locally.
     */
    private static function tryReadLocal(string $url): ?string
    {
        $appUrl = rtrim(config('app.url'), '/');

        if (!str_starts_with($url, $appUrl)) {
            return null;
        }

        $relativePath = ltrim(substr($url, strlen($appUrl)), '/');
        $localPath = public_path($relativePath);

        if (file_exists($localPath) && is_file($localPath)) {
            $contents = @file_get_contents($localPath);
            return $contents !== false ? $contents : null;
        }

        return null;
    }
}