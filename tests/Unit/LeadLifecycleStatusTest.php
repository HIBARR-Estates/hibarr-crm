<?php

namespace Tests\Unit;

use App\Models\LeadLifecycleStatus;
use Tests\TestCase;

class LeadLifecycleStatusTest extends TestCase
{
    public function test_default_status_definitions_has_nine_statuses(): void
    {
        $definitions = LeadLifecycleStatus::defaultStatusDefinitions();

        $this->assertCount(9, $definitions);
    }

    public function test_default_status_definitions_keys(): void
    {
        $keys = array_column(LeadLifecycleStatus::defaultStatusDefinitions(), 'key');

        $this->assertSame(
            ['new', 'contacted', 'qualifying', 'qualified', 'nurturing', 'callback', 'not_fit', 'converted', 'lost'],
            $keys
        );
    }
}
