<?php

namespace App\Services\PdfExpose\Builders;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use Illuminate\Support\Facades\View;

class TemplateRenderer
{
    /**
     * Render HTML from Blade template
     */
    public function render(ExposeConfiguration $config): string
    {
        $templatePath = $this->getTemplatePath($config);

        return View::make($templatePath, [
            'config' => $config,
            'data' => $config->data,
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
}