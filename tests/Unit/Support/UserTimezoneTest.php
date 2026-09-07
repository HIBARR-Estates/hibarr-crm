<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\User;
use App\Support\UserTimezone;
use Carbon\Carbon;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class UserTimezoneTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_returns_user_timezone_when_set(): void
    {
        $user = new User;
        $user->timezone = 'Europe/Berlin';

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Europe/Berlin', UserTimezone::resolve($user, $company));
    }

    public function test_falls_back_to_company_timezone_when_user_timezone_is_null(): void
    {
        $user = new User;
        $user->timezone = null;

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Asia/Dubai', UserTimezone::resolve($user, $company));
    }

    public function test_falls_back_to_company_relation_when_company_arg_omitted(): void
    {
        $company = new Company;
        $company->timezone = 'America/New_York';

        $user = new User;
        $user->timezone = '';
        $user->setRelation('company', $company);

        $this->assertSame('America/New_York', UserTimezone::resolve($user));
    }

    public function test_falls_back_to_utc_when_both_null(): void
    {
        $user = new User;
        $user->timezone = null;

        $company = new Company;
        $company->timezone = null;

        $this->assertSame('UTC', UserTimezone::resolve($user, $company));
        $this->assertSame('UTC', UserTimezone::resolve(null, null));
    }

    public function test_user_timezone_flag_is_a_known_flag(): void
    {
        $this->assertContains(UserTimezone::FLAG, config('features.known_flags'));
        $this->assertNotContains('viewerTimezone', config('features.known_flags'));
    }

    public function test_for_viewer_uses_company_timezone_when_flag_is_off(): void
    {
        $this->setFeatureFlag(UserTimezone::FLAG, false);

        $user = new User;
        $user->timezone = 'Europe/Berlin';

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Asia/Dubai', UserTimezone::forViewer($user, $company));
    }

    public function test_for_viewer_uses_user_timezone_when_flag_is_on(): void
    {
        $this->setFeatureFlag(UserTimezone::FLAG, true);

        $user = new User;
        $user->timezone = 'Europe/Berlin';

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Europe/Berlin', UserTimezone::forViewer($user, $company));
    }

    public function test_for_viewer_falls_back_to_company_when_flag_on_and_user_timezone_empty(): void
    {
        $this->setFeatureFlag(UserTimezone::FLAG, true);

        $user = new User;
        $user->timezone = null;

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Asia/Dubai', UserTimezone::forViewer($user, $company));

        $user->timezone = '';
        $this->assertSame('Asia/Dubai', UserTimezone::forViewer($user, $company));
    }

    public function test_for_viewer_falls_back_to_utc_when_both_null(): void
    {
        $this->setFeatureFlag(UserTimezone::FLAG, false);
        $this->assertSame('UTC', UserTimezone::forViewer(null, null));

        $this->setFeatureFlag(UserTimezone::FLAG, true);
        $this->assertSame('UTC', UserTimezone::forViewer(null, null));
    }

    public function test_for_viewer_display_shifts_utc_timestamp_when_flag_on(): void
    {
        $utc = Carbon::parse('2026-08-27 12:00:00', 'UTC');
        $berlin = $utc->copy()->timezone('Europe/Berlin')->format('Y-m-d H:i');
        $dubai = $utc->copy()->timezone('Asia/Dubai')->format('Y-m-d H:i');
        $this->assertNotSame($berlin, $dubai);

        $user = new User;
        $user->timezone = 'Europe/Berlin';

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->setFeatureFlag(UserTimezone::FLAG, false);
        $this->assertSame(
            $dubai,
            $utc->copy()->timezone(UserTimezone::forViewer($user, $company))->format('Y-m-d H:i')
        );

        $this->setFeatureFlag(UserTimezone::FLAG, true);
        $this->assertSame(
            $berlin,
            $utc->copy()->timezone(UserTimezone::forViewer($user, $company))->format('Y-m-d H:i')
        );
    }

    public function test_invoice_date_only_midnight_rolls_calendar_day_in_viewer_timezone(): void
    {
        // Date-only invoice issue dates stored as midnight in company TZ must not
        // use forViewer() — a western viewer TZ would show the previous calendar day.
        $issueDate = Carbon::parse('2026-08-27 00:00:00', 'Asia/Dubai');

        $user = new User;
        $user->timezone = 'America/New_York';

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->setFeatureFlag(UserTimezone::FLAG, true);

        $this->assertSame('2026-08-27', $issueDate->copy()->timezone('Asia/Dubai')->format('Y-m-d'));
        $this->assertSame(
            '2026-08-26',
            $issueDate->copy()->timezone(UserTimezone::forViewer($user, $company))->format('Y-m-d')
        );
    }

    public function test_for_viewer_formats_dst_spring_forward_instant(): void
    {
        $this->setFeatureFlag(UserTimezone::FLAG, true);

        $user = new User;
        $user->timezone = 'America/New_York';

        $company = new Company;
        $company->timezone = 'UTC';

        // 2026-03-08 07:00 UTC is the US spring-forward instant (02:00 EST → 03:00 EDT).
        $displayed = Carbon::parse('2026-03-08 07:00:00', 'UTC')
            ->timezone(UserTimezone::forViewer($user, $company));

        $this->assertSame('2026-03-08 03:00', $displayed->format('Y-m-d H:i'));
        $this->assertSame(-4 * 3600, $displayed->offset);
    }

    public function test_for_viewer_uses_viewer_not_row_owner_timezone(): void
    {
        $this->setFeatureFlag(UserTimezone::FLAG, true);

        $viewer = new User;
        $viewer->timezone = 'Europe/Berlin';

        $rowUser = new User;
        $rowUser->timezone = 'America/Los_Angeles';

        $company = new Company;
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Europe/Berlin', UserTimezone::forViewer($viewer, $company));
        $this->assertNotSame($rowUser->timezone, UserTimezone::forViewer($viewer, $company));
    }

    public function test_interpret_wall_clock_uses_user_timezone_not_company(): void
    {
        $user = new User;
        $user->timezone = 'Africa/Lagos';

        $company = new Company;
        $company->timezone = 'Europe/Berlin';

        $wallClock = '03-09-2026 10:00:00';
        $fromUser = UserTimezone::interpretWallClock($user, $company, $wallClock, 'd-m-Y H:i:s');
        $fromCompany = UserTimezone::interpretWallClock(null, $company, $wallClock, 'd-m-Y H:i:s');

        // Lagos is UTC+1; Berlin is CEST (UTC+2) on 2026-09-03.
        $this->assertSame('2026-09-03 09:00:00', $fromUser->format('Y-m-d H:i:s'));
        $this->assertSame('UTC', $fromUser->timezoneName);
        $this->assertSame('2026-09-03 08:00:00', $fromCompany->format('Y-m-d H:i:s'));
        $this->assertNotSame($fromUser->format('Y-m-d H:i:s'), $fromCompany->format('Y-m-d H:i:s'));
    }

    public function test_interpret_wall_clock_uses_company_when_user_timezone_empty(): void
    {
        $user = new User;
        $user->timezone = '';

        $company = new Company;
        $company->timezone = 'Europe/Berlin';

        $fromUser = UserTimezone::interpretWallClock($user, $company, '03-09-2026 10:00:00', 'd-m-Y H:i:s');

        $this->assertSame('2026-09-03 08:00:00', $fromUser->format('Y-m-d H:i:s'));
    }

    public function test_interpret_wall_clock_uses_utc_when_user_is_null(): void
    {
        $stored = UserTimezone::interpretWallClock(null, null, '03-09-2026 10:00:00', 'd-m-Y H:i:s');

        $this->assertSame('2026-09-03 10:00:00', $stored->format('Y-m-d H:i:s'));
        $this->assertSame('UTC', $stored->timezoneName);
    }

    public function test_interpret_wall_clock_ignores_a_client_request_timezone(): void
    {
        $user = new User;
        $user->timezone = 'Africa/Lagos';

        $company = new Company;
        $company->timezone = 'Europe/Berlin';

        $wallClock = '03-09-2026 10:00:00';
        $stored = UserTimezone::interpretWallClock($user, $company, $wallClock, 'd-m-Y H:i:s');
        $ifRequestTzUsed = Carbon::createFromFormat('d-m-Y H:i:s', $wallClock, 'America/New_York')->utc();
        $ifCompanyTzUsed = Carbon::createFromFormat('d-m-Y H:i:s', $wallClock, 'Europe/Berlin')->utc();

        $this->assertNotSame($ifRequestTzUsed->format('Y-m-d H:i:s'), $stored->format('Y-m-d H:i:s'));
        $this->assertNotSame($ifCompanyTzUsed->format('Y-m-d H:i:s'), $stored->format('Y-m-d H:i:s'));
        $this->assertSame('2026-09-03 09:00:00', $stored->format('Y-m-d H:i:s'));
    }

    public function test_for_write_omitted_timezone_uses_created_by_user(): void
    {
        $createdBy = new User;
        $createdBy->timezone = 'Africa/Lagos';

        $company = new Company;
        $company->timezone = 'Europe/Berlin';

        $this->assertSame('Africa/Lagos', UserTimezone::forWrite($createdBy, $company));
        $this->assertSame('Africa/Lagos', UserTimezone::forWrite($createdBy, $company, null));
        $this->assertSame('Africa/Lagos', UserTimezone::forWrite($createdBy, $company, ''));
    }

    public function test_for_write_provided_timezone_wins_over_created_by_user(): void
    {
        $createdBy = new User;
        $createdBy->timezone = 'Africa/Lagos';

        $company = new Company;
        $company->timezone = 'Europe/Berlin';

        $this->assertSame(
            'America/New_York',
            UserTimezone::forWrite($createdBy, $company, 'America/New_York')
        );
    }

    public function test_for_write_falls_back_to_company_when_created_by_user_missing(): void
    {
        $company = new Company;
        $company->timezone = 'Europe/Berlin';

        $this->assertSame('Europe/Berlin', UserTimezone::forWrite(null, $company));
        $this->assertSame('UTC', UserTimezone::forWrite(null, null));
    }
}
