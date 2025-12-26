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
        $orientation = $config->layout === 'horizontal_premium' ? 'landscape' : 'portrait';

        // Generate PDF using Spatie and return download response
        $pdf = Pdf::view('pdf.wrapper', ['content' => $html])
            ->format('a4')
            ->orientation($orientation)
            ->withBrowsershot(function ($browsershot) { // Configure Puppeteer options
                $browsershot->noSandbox();
                $browsershot->disableSetuidSandbox();
                $browsershot->setOption('args', ['--disable-dev-shm-usage']);
            })
            ->margins(10, 10, 10, 10);

        return $pdf->download($filename);
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
                $browsershot->setOption('args', ['--disable-dev-shm-usage']);
            })
            ->margins(10, 10, 10, 10)
            ->name($filename)
            ->download();
    }
}