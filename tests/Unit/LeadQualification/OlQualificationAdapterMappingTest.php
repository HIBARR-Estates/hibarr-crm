<?php

namespace Tests\Unit\LeadQualification;

use App\Enums\QualificationOutcome;
use Tests\TestCase;

class OlQualificationAdapterMappingTest extends TestCase
{
    public function test_outcome_enum_maps_to_expected_lifecycle_keys(): void
    {
        $this->assertSame('qualified', QualificationOutcome::BookMeeting->lifecycleStatusKey());
        $this->assertSame('nurturing', QualificationOutcome::InviteWebinar->lifecycleStatusKey());
        $this->assertSame('callback', QualificationOutcome::Callback->lifecycleStatusKey());
        $this->assertSame('not_fit', QualificationOutcome::NoFit->lifecycleStatusKey());
    }
}
