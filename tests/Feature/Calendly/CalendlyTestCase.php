<?php

namespace Tests\Feature\Calendly;

use App\Models\CalendlyMeetingLink;
use App\Models\Lead;
use Tests\LeadCoreFieldsTestCase;

/**
 * Builds the Calendly table from the real migration, so the tests also prove
 * it runs.
 */
abstract class CalendlyTestCase extends LeadCoreFieldsTestCase
{
    protected int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        (require base_path('database/migrations/2026_11_19_000001_create_calendly_meeting_tables.php'))->up();
    }

    protected function link(array $attributes = []): CalendlyMeetingLink
    {
        $link = new CalendlyMeetingLink;
        $link->fill(array_merge([
            'name' => 'Intro call',
            'url' => 'https://calendly.com/team/intro',
            'is_active' => true,
        ], $attributes));
        $link->company_id = $this->companyId;
        $link->save();

        return $link;
    }

    protected function lead(string $name, string $email): Lead
    {
        $lead = new Lead;
        $lead->client_name = $name;
        $lead->client_email = $email;

        return $lead;
    }
}
