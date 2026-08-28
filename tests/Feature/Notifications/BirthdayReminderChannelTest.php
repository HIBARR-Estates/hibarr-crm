<?php

namespace Tests\Feature\Notifications;

use App\Events\BirthdayReminderEvent;
use App\Models\Company;
use App\Models\EmailNotificationSetting;
use App\Models\EmployeeDetails;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class BirthdayReminderChannelTest extends TestCase
{
    use RefreshDatabase;

    public function test_fully_disabled_company_is_skipped_without_dispatching_event(): void
    {
        Event::fake([BirthdayReminderEvent::class]);

        $company = $this->makeCompany();
        $this->makeBirthdayEmployee($company);

        EmailNotificationSetting::create([
            'company_id' => $company->id,
            'slug' => 'birthday-notification',
            'setting_name' => 'Birthday notification',
            'send_email' => 'no',
            'send_slack' => 'no',
            'send_push' => 'no',
            'send_database' => 'no',
        ]);

        $this->artisan('birthday-notification')->assertExitCode(0);

        Event::assertNotDispatched(BirthdayReminderEvent::class);
    }

    public function test_company_with_in_app_channel_enabled_still_dispatches_event(): void
    {
        Event::fake([BirthdayReminderEvent::class]);

        $company = $this->makeCompany();
        $this->makeBirthdayEmployee($company);

        EmailNotificationSetting::create([
            'company_id' => $company->id,
            'slug' => 'birthday-notification',
            'setting_name' => 'Birthday notification',
            'send_email' => 'no',
            'send_slack' => 'no',
            'send_push' => 'no',
            'send_database' => 'yes',
        ]);

        $this->artisan('birthday-notification')->assertExitCode(0);

        Event::assertDispatched(
            BirthdayReminderEvent::class,
            fn ($event) => $event->company->id === $company->id,
        );
    }

    public function test_company_with_no_setting_row_still_dispatches_event(): void
    {
        Event::fake([BirthdayReminderEvent::class]);

        $company = $this->makeCompany();
        $this->makeBirthdayEmployee($company);

        // Deliberately no EmailNotificationSetting row for this company/slug.
        $this->artisan('birthday-notification')->assertExitCode(0);

        Event::assertDispatched(BirthdayReminderEvent::class);
    }

    private function makeCompany(): Company
    {
        return Company::create([
            'company_name' => 'Acme Test Co',
            'company_email' => 'acme@example.com',
            'company_phone' => '1234567890',
            'address' => '123 Test Street',
            'before_days' => 1,
            'after_days' => 1,
            'allow_client_signup' => false,
            'admin_client_signup_approval' => false,
        ]);
    }

    private function makeBirthdayEmployee(Company $company): User
    {
        $user = User::create([
            'company_id' => $company->id,
            'name' => 'Birthday User',
            'email' => 'birthday'.uniqid().'@example.com',
            'password' => bcrypt('secret'),
            'status' => 'active',
            'dark_theme' => false,
            'rtl' => false,
        ]);

        EmployeeDetails::create([
            'company_id' => $company->id,
            'user_id' => $user->id,
            'date_of_birth' => now()->format('Y-m-d'),
        ]);

        return $user;
    }
}
