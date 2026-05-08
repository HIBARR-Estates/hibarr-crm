<?php

namespace App\Services\PdfExpose\Builders;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\View;

class TemplateRenderer
{
    /**
     * Hardcoded branding URLs used across expose templates.
     * These are converted to base64 data URIs so the PDF HTML is fully self-contained
     * and doesn't depend on Puppeteer being able to reach minio over the network.
     */
    private const BRANDING_URLS = [
        'logo_expose'          => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719874403-1303eff6-hibarr-expose.png',
        'logo_rounded'         => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719912107-6b8eafb3-hibarr-rounded.png',
        'logo_white'           => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719985906-ae8b2c90-logo-white.png',
        'block_title'          => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719787183-e155489e-block-title.svg',
        'logo_full'            => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719947639-23a7e25b-logo.png',
        'name_space'           => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778193858830-ad66988e-name-space.png',
        'hibarr_expose_text'   => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778194049167-64036beb-hibarr-expose-text.png',
        'project_overview'   => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778220690459-2ef518d6-project-overview-space-for-img.png',
        // examples to match
        'cover_image_project'   => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778197940203-011a688d-cover-image-project.png',
        'project_overview_example'   => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1778204830425-e578b585-project-overview.png',
    ];

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

        // 2. Convert company logo only if it's a local app URL
        if (!empty($data['company']['logo'])) {
            $data['company']['logo'] = self::localUrlToBase64($data['company']['logo']);
        }

        // 3. Convert agent image only if it's a local app URL
        if (!empty($data['agent']['image'])) {
            $data['agent']['image'] = self::localUrlToBase64($data['agent']['image']);
        }

        // 4. Add branding images as base64 (cached for 24 hours)
        $data['branding'] = $this->getBrandingAssets();

        return $data;
    }

    /**
     * Get branding assets as base64 data URIs.
     * Cached for 24 hours since these are static images.
     */
    private function getBrandingAssets(): array
    {
        return Cache::remember('expose_branding_base64', 86400, function () {
            $branding = [];

            foreach (self::BRANDING_URLS as $key => $url) {
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