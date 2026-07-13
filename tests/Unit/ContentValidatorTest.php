<?php

namespace Tests\Unit;

use App\Services\PdfExpose\Configuration\ExposeConfiguration;
use App\Services\PdfExpose\Validators\ContentValidator;
use PHPUnit\Framework\TestCase;

class ContentValidatorTest extends TestCase
{
    public function test_it_reports_missing_unit_type_defaults_and_location_details(): void
    {
        $config = new ExposeConfiguration(
            entityType: 'property',
            entityId: 1,
            layout: 'expose-template',
            sections: [],
            data: [
                'title' => 'Sample Unit',
                'price' => '100000',
                'city' => 'Dubai',
                'description' => null,
                'assets' => [],
                'location_infrastructure' => [],
                'location_airports' => [],
                'unit_type_description_provided' => false,
                'unit_type_description_source' => 'project',
                'expose_global_config' => [
                    'outro' => [
                        'enabled' => true,
                        'title' => null,
                        'description' => null,
                        'primary_image_url' => null,
                        'secondary_image_url' => null,
                    ],
                ],
            ]
        );

        $warnings = (new ContentValidator())->validate($config);

        $messages = array_column($warnings, 'message');
        $labels = array_column($warnings, 'label');

        $this->assertContains(
            'Not populated. The expose will fall back to project-level content if available.',
            $messages
        );
        $this->assertContains(
            'Not populated. Add nearby infrastructure details to enrich the expose.',
            $messages
        );
        $this->assertContains(
            'Not populated. Add airport travel details to enrich the expose.',
            $messages
        );
        $this->assertContains(
            'Not populated. Add a footer image to avoid an incomplete closing page.',
            $messages
        );

        $this->assertContains('Unit type description', $labels);
        $this->assertContains('Project location infrastructure', $labels);
        $this->assertContains('Project location airports', $labels);
        $this->assertContains('Footer image', $labels);
    }

    public function test_it_returns_human_readable_labels_for_field_rules(): void
    {
        $config = new ExposeConfiguration(
            entityType: 'property',
            entityId: 1,
            layout: 'expose-template',
            sections: [],
            data: [
                'title' => null,
                'price' => null,
                'city' => null,
                'living_area_sqm' => null,
                'assets' => [],
            ]
        );

        $warnings = (new ContentValidator())->validate($config);
        $labels = array_column($warnings, 'label');

        $this->assertContains('Property title', $labels);
        $this->assertContains('Living area (sqm)', $labels);
        $this->assertContains('Hero image', $labels);
        $this->assertNotContains('living_area_sqm', $labels);
        $this->assertNotContains('assets.hero', $labels);
    }
}
