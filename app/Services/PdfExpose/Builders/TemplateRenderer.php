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
        'logo_expose'  => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719874403-1303eff6-hibarr-expose.png',
        'logo_rounded' => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719912107-6b8eafb3-hibarr-rounded.png',
        'logo_white'   => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719985906-ae8b2c90-logo-white.png',
        'block_title'  => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719787183-e155489e-block-title.svg',
        'logo_full'    => 'https://minio.hibarr.org/backend-uploads/backend-uploads/1770719947639-23a7e25b-logo.png',
    ];

    /**
     * Render HTML from Blade template.
     *
     * All remote image URLs (property assets, branding, company logo) are converted
     * to base64 data URIs before rendering. This makes the HTML self-contained so
     * Puppeteer can generate the PDF without any network/DNS/SSL dependencies.
     */
    public function render(ExposeConfiguration $config): string
    {
        $templatePath = $this->getTemplatePath($config);

        // Embed all remote images as base64 data URIs
        $data = $this->embedImages($config->data);

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
     * Embed all remote images in the data array as base64 data URIs.
     *
     * Converts:
     * 1. Property asset URLs (hero, exterior, interior, floor-plan, etc.)
     * 2. Company logo
     * 3. Agent image
     * 4. Branding images (hardcoded minio URLs → cached base64)
     */
    private function embedImages(array $data): array
    {
        // 1. Convert property asset URLs to base64
        if (isset($data['assets']) && is_array($data['assets'])) {
            foreach ($data['assets'] as $tag => $urls) {
                if (is_array($urls)) {
                    $data['assets'][$tag] = array_map(fn ($url) => self::urlToBase64($url), $urls);
                }
            }
        }

        // 2. Convert company logo
        if (!empty($data['company']['logo'])) {
            $data['company']['logo'] = self::urlToBase64($data['company']['logo']);
        }

        // 3. Convert agent image
        if (!empty($data['agent']['image'])) {
            $data['agent']['image'] = self::urlToBase64($data['agent']['image']);
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
     * Fetch a remote URL and return it as a base64 data URI.
     *
     * Falls back to the original URL on failure so the template
     * still renders (Puppeteer may or may not load it).
     */
    public static function urlToBase64(string $url): string
    {
        // Skip if already a data URI or a local/relative path
        if (str_starts_with($url, 'data:') || !str_starts_with($url, 'http')) {
            return $url;
        }

        try {
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

            if ($contents === false) {
                Log::warning("Expose PDF: failed to fetch image for base64 embedding: {$url}");
                return $url;
            }

            // Detect MIME type from file content
            $finfo = new \finfo(FILEINFO_MIME_TYPE);
            $mime = $finfo->buffer($contents);

            // Handle SVG files (finfo may misidentify them as text/xml or text/html)
            if (str_ends_with($url, '.svg') || str_contains($contents, '<svg')) {
                $mime = 'image/svg+xml';
            }

            // Fix Minio's incorrect Content-Type (returns binary/octet-stream for images)
            if (in_array($mime, ['application/octet-stream', 'binary/octet-stream', 'text/plain'])) {
                $ext = strtolower(pathinfo(parse_url($url, PHP_URL_PATH), PATHINFO_EXTENSION));
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
        } catch (\Exception $e) {
            Log::warning("Expose PDF: exception converting image to base64: {$url} — " . $e->getMessage());
            return $url;
        }
    }
}