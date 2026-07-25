<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\User;
use App\Support\UserTimezone;
use Tests\TestCase;

class UserTimezoneTest extends TestCase
{
    public function test_returns_user_timezone_when_set(): void
    {
        $user = new User();
        $user->timezone = 'Europe/Berlin';

        $company = new Company();
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Europe/Berlin', UserTimezone::resolve($user, $company));
    }

    public function test_falls_back_to_company_timezone_when_user_timezone_is_null(): void
    {
        $user = new User();
        $user->timezone = null;

        $company = new Company();
        $company->timezone = 'Asia/Dubai';

        $this->assertSame('Asia/Dubai', UserTimezone::resolve($user, $company));
    }

    public function test_falls_back_to_company_relation_when_company_arg_omitted(): void
    {
        $company = new Company();
        $company->timezone = 'America/New_York';

        $user = new User();
        $user->timezone = '';
        $user->setRelation('company', $company);

        $this->assertSame('America/New_York', UserTimezone::resolve($user));
    }

    public function test_falls_back_to_utc_when_both_null(): void
    {
        $user = new User();
        $user->timezone = null;

        $company = new Company();
        $company->timezone = null;

        $this->assertSame('UTC', UserTimezone::resolve($user, $company));
        $this->assertSame('UTC', UserTimezone::resolve(null, null));
    }
}
