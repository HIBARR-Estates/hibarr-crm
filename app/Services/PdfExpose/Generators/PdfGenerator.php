<?php

namespace App\Services\PdfExpose\Generators;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Spatie\LaravelPdf\Facades\Pdf;
use Illuminate\Support\Facades\Storage;

class PdfGenerator
{
    /**
     * Generate PDF from HTML
     *
     * @return string Path to generated PDF
     */
    public function generate(string $html, ExposeConfiguration $config): string
    {
        $filename = $this->generateFilename($config);
        $orientation = $config->layout === 'horizontal' ? 'landscape' : 'portrait';

        // Generate PDF using Spatie
        $pdf = Pdf::view('pdf.wrapper', ['content' => $html])
            ->format('a4')
            ->orientation($orientation)
            ->margins(10, 10, 10, 10)
            ->name($filename);

        // Add options
        if ($config->options['watermark'] ?? false) {
            // Add watermark logic
        }

        // Save to storage
        $path = "exposes/{$config->entityType}/{$config->entityId}";
        $fullPath = "{$path}/{$filename}";
        
        Storage::put($fullPath, $pdf->base64());

        return $fullPath;
    }

    /**
     * Generate unique filename
     */
    private function generateFilename(ExposeConfiguration $config): string
    {
        $timestamp = now()->format('Y-m-d_His');
        return "{$config->entityType}_{$config->entityId}_{$timestamp}.pdf";
    }

    /**
     * Alternative: Generate and return as download response
     */
    public function download(string $html, ExposeConfiguration $config, string $filename = null): \Symfony\Component\HttpFoundation\Response
    {
        $filename = $filename ?? $this->generateFilename($config);
        $orientation = $config->layout === 'horizontal' ? 'landscape' : 'portrait';

        return Pdf::view('pdf.wrapper', ['content' => $html])
            ->format('a4')
            ->orientation($orientation)
            ->margins(10, 10, 10, 10)
            ->name($filename)
            ->download();
    }
}