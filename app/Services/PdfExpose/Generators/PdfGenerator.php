<?php

namespace App\Services\PdfExpose\Generators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Spatie\Browsershot\Enums\Polling;
use Spatie\LaravelPdf\Facades\Pdf;

class PdfGenerator
{
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

        // pdf.wrapper sets window.__exposePdfImagesReady once remote assets finish loading.
        $browsershot->waitForFunction(
            'window.__exposePdfImagesReady === true',
            Polling::RequestAnimationFrame,
            $timeoutSeconds * 1000
        );

        // Brief paint buffer after images are ready.
        $browsershot->setDelay(300);

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
                $this->configureBrowsershot($browsershot, 180);
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
                $this->configureBrowsershot($browsershot, 480);
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
                $this->configureBrowsershot($browsershot, 180);
            })
            ->margins(0, 0, 0, 0)
            ->name($filename)
            ->download();
    }
}
