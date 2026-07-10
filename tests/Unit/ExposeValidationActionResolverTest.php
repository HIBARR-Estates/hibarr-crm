<?php

namespace Tests\Unit;

use App\Services\PdfExpose\Validators\ExposeValidationActionResolver;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

class ExposeValidationActionResolverTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Route::get('/account/developer-projects/{id}', fn () => null)
            ->name('developer-projects.show');
        Route::get('/account/project-locations/{id}', fn () => null)
            ->name('project-locations.show');
        Route::get('/account/expose-configuration', fn () => null)
            ->name('expose-configuration.show');
        Route::get('/account/properties/{property}/assets', fn () => null)
            ->name('properties.assets.index');
        Route::get('/account/properties/{property}', fn () => null)
            ->name('properties.show');
    }

    public function test_it_attaches_unit_type_edit_action_for_description_warnings(): void
    {
        $warnings = [[
            'severity' => 'warning',
            'field' => 'unit_type_description',
            'label' => 'Unit type description',
            'message' => 'Not populated.',
        ]];

        $resolved = (new ExposeValidationActionResolver())->attachActions($warnings, [
            'context' => 'unit_type',
            'project_id' => 12,
            'unit_type_id' => 34,
            'location_id' => 5,
        ]);

        $this->assertSame('Edit unit type', $resolved[0]['action']['label']);
        $this->assertStringContainsString('section=unit_types', $resolved[0]['action']['href']);
        $this->assertStringContainsString('edit_unit_type=34', $resolved[0]['action']['href']);
    }

    public function test_it_attaches_location_action_for_infrastructure_warnings(): void
    {
        $warnings = [[
            'severity' => 'warning',
            'field' => 'location_infrastructure',
            'label' => 'Project location infrastructure',
            'message' => 'Not populated.',
        ]];

        $resolved = (new ExposeValidationActionResolver())->attachActions($warnings, [
            'context' => 'unit_type',
            'project_id' => 12,
            'unit_type_id' => 34,
            'location_id' => 5,
        ]);

        $this->assertSame('Edit location', $resolved[0]['action']['label']);
        $this->assertStringContainsString('/account/project-locations/5', $resolved[0]['action']['href']);
    }

    public function test_it_attaches_photo_management_action_for_property_assets(): void
    {
        $warnings = [[
            'severity' => 'error',
            'field' => 'assets.hero',
            'label' => 'Hero image',
            'message' => 'No images uploaded (requires 1)',
        ]];

        $resolved = (new ExposeValidationActionResolver())->attachActions($warnings, [
            'context' => 'property',
            'property_id' => 99,
        ]);

        $this->assertSame('Manage photos', $resolved[0]['action']['label']);
        $this->assertStringContainsString('/account/properties/99/assets', $resolved[0]['action']['href']);
    }

    public function test_it_attaches_unit_type_photo_action_for_unit_type_assets(): void
    {
        $warnings = [[
            'severity' => 'error',
            'field' => 'assets.hero',
            'label' => 'Hero image',
            'message' => 'No images uploaded (requires 1)',
        ]];

        $resolved = (new ExposeValidationActionResolver())->attachActions($warnings, [
            'context' => 'unit_type',
            'project_id' => 12,
            'unit_type_id' => 34,
        ]);

        $this->assertSame('Edit unit type photos', $resolved[0]['action']['label']);
        $this->assertStringContainsString('section=unit_types', $resolved[0]['action']['href']);
        $this->assertStringContainsString('edit_unit_type=34', $resolved[0]['action']['href']);
    }
}
