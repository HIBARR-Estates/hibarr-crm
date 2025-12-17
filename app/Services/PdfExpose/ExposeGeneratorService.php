<?php

namespace App\Services\PdfExpose;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Services\PdfExpose\Validators\ContentValidator;
use App\Services\PdfExpose\Builders\TemplateRenderer;
use App\Services\PdfExpose\Generators\PdfGenerator;
use Illuminate\Support\Collection;

class ExposeGeneratorService
{
    public function __construct(
        private ContentValidator $validator,
        private TemplateRenderer $renderer,
        private PdfGenerator $generator
    ) {}

    /**
     * Generate PDF expose with validation warnings
     *
     * @param ExposeConfiguration $config
     * @return mixed
     */
    public function generate(ExposeConfiguration $config)
    {
        // Render HTML from template
        $html = $this->renderer->render($config);

        // Generate PDF and return download response
        return $this->generator->generate($html, $config);
    }

    /**
     * Check for warnings without generating PDF
     */
    public function checkWarnings(ExposeConfiguration $config): array
    {
        return $this->validator->validate($config);
    }

    /**
     * Get available layouts for a given entity type
     */
    public function getAvailableLayouts(string $entityType = 'property'): Collection
    {
        return collect([
            [
                'id' => 'vertical_standard',
                'name' => 'Vertical - Standard',
                'orientation' => 'portrait',
                'preview' => asset('img/layouts/vertical_standard.png'),
            ],
            [
                'id' => 'horizontal_premium',
                'name' => 'Horizontal - Premium',
                'orientation' => 'landscape',
                'preview' => asset('img/layouts/horizontal_premium.png'),
            ],
        ]);
    }
}
