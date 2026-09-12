<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\DealFollowUp;
use App\Support\MeetingEmailPresenter;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MeetingEmailPresenterTimezoneTest extends TestCase
{
    public function test_it_appends_company_timezone_abbreviation_to_meeting_time(): void
    {
        $company = new Company();
        $company->timezone = 'Europe/Berlin';
        $company->time_format = 'H:i';
        $company->date_format = 'Y-m-d';

        $followUp = new DealFollowUp();
        // Fixed UTC instant so the Berlin wall clock (and T abbrev) are stable.
        $followUp->next_follow_up_date = Carbon::parse('2026-01-15 09:15:00', 'UTC');

        $presenter = new MeetingEmailPresenter($followUp, $company);

        $this->assertSame('CET', $presenter->meetingTimezoneAbbreviation());
        $this->assertSame('10:15 CET', $presenter->meetingTime());
        $this->assertStringContainsString('CET', $presenter->scheduleLinePlain());
        $this->assertStringEndsWith('CET', $presenter->scheduleLinePlain());
    }

    public function test_it_returns_empty_time_when_meeting_has_no_start(): void
    {
        $company = new Company();
        $company->timezone = 'Europe/Berlin';

        $presenter = new MeetingEmailPresenter(new DealFollowUp(), $company);

        $this->assertSame('', $presenter->meetingTimezoneAbbreviation());
        $this->assertSame('', $presenter->meetingTime());
    }
}
