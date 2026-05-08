<?php

namespace App\Services\PdfExpose\Generators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Spatie\LaravelPdf\Facades\Pdf;
use Illuminate\Support\Facades\Storage;

class PdfGenerator
{
    /**
     * Generate PDF from HTML and return download response
     *
     * @return mixed
     */
    public function generate(string $html, ExposeConfiguration $config)
    {
        $filename = $this->generateFilename($config);
        // $orientation = $config->layout === 'horizontal_premium' ? 'landscape' : 'portrait';
        $orientation = 'landscape';

        // Generate PDF using Spatie and return download response
        $pdf = Pdf::view('pdf.wrapper', ['content' => $html])
            ->format('a4')
            ->orientation($orientation)
            ->withBrowsershot(function ($browsershot) {
                $browsershot->noSandbox();
                $browsershot->disableSetuidSandbox();
                $browsershot->setOption('args', [
                    '--disable-dev-shm-usage',
                    '--ignore-certificate-errors',
                    '--allow-running-insecure-content',
                ]);
                // Wait for all remote images (including CSS background-image) to load
                $browsershot->waitUntilNetworkIdle();
                $browsershot->setDelay(1500);
                $browsershot->timeout(60);
            })
            ->margins(10, 10, 10, 10);

        return $pdf->download($filename);
    }

    /**
     * Generate PDF and save to a local file path (for async queue jobs).
     * The caller is responsible for cleaning up the file.
     */
    public function saveToFile(string $html, ExposeConfiguration $config, string $destinationPath): void
    {
        // $orientation = $config->layout === 'horizontal_premium' ? 'landscape' : 'portrait';
        $orientation = 'landscape';

        Pdf::view('pdf.wrapper', ['content' => $html])
            ->format('a4')
            ->orientation($orientation)
            ->withBrowsershot(function ($browsershot) {
                $browsershot->noSandbox();
                $browsershot->disableSetuidSandbox();
                $browsershot->setOption('args', [
                    '--disable-dev-shm-usage',
                    '--ignore-certificate-errors',
                    '--allow-running-insecure-content',
                ]);
                $browsershot->waitUntilNetworkIdle();
                $browsershot->setDelay(1500);
                $browsershot->timeout(120);
            })
            ->margins(10, 10, 10, 10)
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
        
        $orientation = 'portrait';
        switch ($config->layout) {
            case 'vertical_standard':
                $orientation = 'portrait';
                break;
            case 'vertical':
                $orientation = 'portrait';
                break;
            case 'horizontal_premium':
                $orientation = 'landscape';
                break;
            case 'horizontal':
                $orientation = 'landscape';
                break;
            
            default:
                $orientation = 'landscape';
                break;
        }

        return Pdf::view('pdf.wrapper', ['content' => $html])
            ->format('a4')
            ->orientation($orientation)
            ->withBrowsershot(function ($browsershot) {
                $browsershot->noSandbox();
                $browsershot->disableSetuidSandbox();
                $browsershot->setOption('args', [
                    '--disable-dev-shm-usage',
                    '--ignore-certificate-errors',
                    '--allow-running-insecure-content',
                ]);
                // Wait for all remote images (including CSS background-image) to load
                $browsershot->waitUntilNetworkIdle();
                $browsershot->setDelay(1500);
                $browsershot->timeout(60);
            })
            ->margins(10, 10, 10, 10)
            ->name($filename)
            ->download();
    }
}