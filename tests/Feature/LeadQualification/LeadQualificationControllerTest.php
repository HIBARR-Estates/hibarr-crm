<?php

namespace Tests\Feature\LeadQualification;

use Illuminate\Support\Facades\Route;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class LeadQualificationControllerTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_qualification_flag_is_known(): void
    {
        $this->assertContains('crm.lead-qualification-tab', config('features.known_flags'));
    }

    public function test_qualification_routes_are_registered(): void
    {
        $this->assertTrue(Route::has('lead-qualifications.index'));
        $this->assertTrue(Route::has('lead-qualifications.store'));
        $this->assertTrue(Route::has('lead-qualifications.complete'));
        $this->assertTrue(Route::has('lead-qualifications.clear-branch-answers'));
    }
}
