<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\DealFollowUp;
use App\Support\MeetingEmailPresenter;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class MeetingEmailPresenterTimezoneTest extends TestCase
{
    public function test_it_uses_company_timezone_when_meeting_has_none(): void
    {
        $company = new Company();
        $company->timezone = 'Europe/Berlin';
        $company->time_format = 'H:i';
        $company->date_format = 'Y-m-d';

        $followUp = new DealFollowUp();
        $followUp->next_follow_up_date = Carbon::parse('2026-01-15 09:15:00', 'UTC');

        $presenter = new MeetingEmailPresenter($followUp, $company);

        $this->assertSame('Europe/Berlin', $presenter->displayTimezone());
        $this->assertSame('CET', $presenter->meetingTimezoneAbbreviation());
        $this->assertSame('10:15 CET', $presenter->meetingTime());
        $this->assertStringContainsString('CET', $presenter->scheduleLinePlain());
        $this->assertStringEndsWith('CET', $presenter->scheduleLinePlain());
    }

    public function test_it_prefers_meeting_timezone_over_company(): void
    {
        $company = new Company();
        $company->timezone = 'Europe/Berlin';
        $company->time_format = 'H:i';
        $company->date_format = 'Y-m-d';

        $followUp = new DealFollowUp();
        $followUp->timezone = 'Africa/Nairobi';
        $followUp->next_follow_up_date = Carbon::parse('2026-01-15 09:15:00', 'UTC');

        $presenter = new MeetingEmailPresenter($followUp, $company);

        $this->assertSame('Africa/Nairobi', $presenter->displayTimezone());
        $this->assertSame('EAT', $presenter->meetingTimezoneAbbreviation());
        $this->assertSame('12:15 EAT', $presenter->meetingTime());
        $this->assertStringEndsWith('EAT', $presenter->scheduleLinePlain());
    }

    public function test_it_normalizes_numeric_offsets_to_gmt_label(): void
    {
        $company = new Company();
        $company->timezone = 'Europe/Berlin';
        $company->time_format = 'H:i';
        $company->date_format = 'Y-m-d';

        $followUp = new DealFollowUp();
        $followUp->timezone = 'Asia/Dubai';
        $followUp->next_follow_up_date = Carbon::parse('2026-01-15 09:15:00', 'UTC');

        $presenter = new MeetingEmailPresenter($followUp, $company);

        $this->assertSame('GMT+4', $presenter->meetingTimezoneAbbreviation());
        $this->assertSame('13:15 GMT+4', $presenter->meetingTime());
        $this->assertStringEndsWith('GMT+4', $presenter->scheduleLinePlain());
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
