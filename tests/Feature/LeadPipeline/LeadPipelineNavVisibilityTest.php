<?php

namespace Tests\Feature\LeadPipeline;

use App\Models\LeadPipeline;
use Illuminate\Support\Facades\Route;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class LeadPipelineNavVisibilityTest extends TestCase
{
    use SetsFeatureFlags;

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
        $visible = new LeadPipeline(['hidden_from_nav' => false]);
        $hidden = new LeadPipeline(['hidden_from_nav' => true]);

        $this->assertFalse($visible->hidden_from_nav);
        $this->assertTrue($hidden->hidden_from_nav);
    }

    public function test_hidden_from_nav_is_cast_to_boolean(): void
    {
        $pipeline = new LeadPipeline(['hidden_from_nav' => 1]);

        $this->assertTrue($pipeline->hidden_from_nav);
        $this->assertIsBool($pipeline->hidden_from_nav);
    }
}
