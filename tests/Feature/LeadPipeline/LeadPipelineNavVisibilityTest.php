<?php

namespace Tests\Feature\LeadPipeline;

use App\Models\LeadPipeline;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class LeadPipelineNavVisibilityTest extends TestCase
{
    use RefreshDatabase, SetsFeatureFlags;

    public function test_pipeline_nav_visibility_flag_is_known(): void
    {
        $this->assertContains('crm.pipeline-nav-visibility', config('features.known_flags'));
    }

    public function test_nav_visibility_route_is_registered(): void
    {
        $this->assertTrue(Route::has('lead-pipeline-setting.nav-visibility'));
    }

    public function test_visible_in_nav_scope_excludes_hidden_pipelines(): void
    {
        // 1. Create and persist records to exercise the database scope
        $visiblePipeline = LeadPipeline::factory()->create([
            'name' => 'Visible Pipeline',
            'hidden_from_nav' => false,
        ]);

        $hiddenPipeline = LeadPipeline::factory()->create([
            'name' => 'Hidden Pipeline',
            'hidden_from_nav' => true,
        ]);

        // 2. Fetch pipelines using the query scope (adjust scope name if different, e.g., visibleInNav)
        $scopedPipelines = LeadPipeline::visibleInNav()->get();

        // 3. Assert that the scope correctly filters out the hidden pipeline
        $this->assertTrue($scopedPipelines->contains($visiblePipeline));
        $this->assertFalse($scopedPipelines->contains($hiddenPipeline));
    }

    public function test_hidden_from_nav_is_cast_to_boolean(): void
    {
        $pipeline = new LeadPipeline(['hidden_from_nav' => 1]);

        $this->assertTrue($pipeline->hidden_from_nav);
        $this->assertIsBool($pipeline->hidden_from_nav);
    }
}