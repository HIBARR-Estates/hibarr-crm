<?php

namespace App\Services\PdfExpose\Generators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Spatie\LaravelPdf\Facades\Pdf;

class PdfGenerator
{
    /** Max time Browsershot waits for window.__exposePdfImagesReady (wrapper caps at 90s). */
    private const IMAGE_READY_TIMEOUT_SECONDS = 120;

    /** Total Browsershot process timeout for async queue jobs. */
    private const ASYNC_PROCESS_TIMEOUT_SECONDS = 360;

    /** Total Browsershot process timeout for synchronous downloads. */
    private const SYNC_PROCESS_TIMEOUT_SECONDS = 180;

    /**
     * Shared Browsershot tuning for large expose templates with many assets.
     */
    private function configureBrowsershot($browsershot, int $timeoutSeconds): void
    {
        $browsershot->noSandbox();
        $browsershot->disableSetuidSandbox();
        $browsershot->setOption('args', [
            '--disable-dev-shm-usage',
            '--ignore-certificate-errors',
            '--allow-running-insecure-content',
        ]);

        // "load" is faster and more predictable than networkIdle, which can hang
        // when Minio or background requests keep connections open.
        $browsershot->setOption('waitUntil', 'load');

        // pdf.wrapper sets window.__exposePdfImagesReady (with per-image + 90s global cap).
        $browsershot->setOption('function', 'window.__exposePdfImagesReady === true');
        $browsershot->setOption('functionPolling', 'raf');
        $browsershot->setOption('functionTimeout', self::IMAGE_READY_TIMEOUT_SECONDS * 1000);

        // Brief paint buffer after images are ready.
        $browsershot->setDelay(500);

        $browsershot->timeout($timeoutSeconds);
        $browsershot->protocolTimeout($timeoutSeconds + 60);
    }

    /**
     * Generate PDF from HTML and return download response
     *
     * @return mixed
     */
    public function generate(string $html, ExposeConfiguration $config)
    {
        $filename = $this->generateFilename($config);

        $pdf = Pdf::view('pdf.wrapper', ['content' => $html])
            ->withBrowsershot(function ($browsershot) {
                $browsershot->setOption('preferCSSPageSize', true);
                $this->configureBrowsershot($browsershot, self::SYNC_PROCESS_TIMEOUT_SECONDS);
            })
            ->margins(0, 0, 0, 0);

        return $pdf->download($filename);
    }

    /**
     * Generate PDF and save to a local file path (for async queue jobs).
     * The caller is responsible for cleaning up the file.
     */
    public function saveToFile(string $html, ExposeConfiguration $config, string $destinationPath): void
    {
        Pdf::view('pdf.wrapper', ['content' => $html])
            ->withBrowsershot(function ($browsershot) {
                $browsershot->setOption('preferCSSPageSize', true);
                $this->configureBrowsershot($browsershot, self::ASYNC_PROCESS_TIMEOUT_SECONDS);
            })
            ->margins(0, 0, 0, 0)
            ->save($destinationPath);
    }

    /**
     * Generate unique filename
     */
    private function generateFilename(ExposeConfiguration $config): string
    {
        $title = $config->get('title') ?? "{$config->entityType}_{$config->entityId}";
        $slug = \Illuminate\Support\Str::slug($title);
        
        return "{$slug}-Expose.pdf";
    }

    /**
     * Alternative: Generate and return as download response
     */
    public function download(string $html, ExposeConfiguration $config, string $filename = null): \Symfony\Component\HttpFoundation\Response
    {
        $filename = $filename ?? $this->generateFilename($config);

        return Pdf::view('pdf.wrapper', ['content' => $html])
            ->withBrowsershot(function ($browsershot) {
                $browsershot->setOption('preferCSSPageSize', true);
                $this->configureBrowsershot($browsershot, self::SYNC_PROCESS_TIMEOUT_SECONDS);
            })
            ->margins(0, 0, 0, 0)
            ->name($filename)
            ->download();
    }
}
