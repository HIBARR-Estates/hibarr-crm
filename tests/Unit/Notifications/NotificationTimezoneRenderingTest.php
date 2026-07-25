<?php

namespace Tests\Unit\Notifications;

use App\Enums\DealActivityType;
use App\Models\Company;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\MeetingSummary;
use App\Models\User;
use App\Notifications\DealActivityNotification;
use App\Notifications\MeetingLinkGenerationFailed;
use App\Notifications\MeetingSummaryNotification;
use Carbon\Carbon;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class NotificationTimezoneRenderingTest extends TestCase
{
    private Carbon $meetingUtc;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createMinimalSchema();

        // 2026-01-19 15:00:00 UTC
        $this->meetingUtc = Carbon::parse('2026-01-19 15:00:00', 'UTC');
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('email_notification_settings');
        Schema::dropIfExists('smtp_settings');
        Schema::dropIfExists('global_settings');
        parent::tearDown();
    }

    private function createMinimalSchema(): void
    {
        Schema::dropIfExists('email_notification_settings');
        Schema::dropIfExists('smtp_settings');
        Schema::dropIfExists('global_settings');

        Schema::create('email_notification_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('slug')->nullable();
            $table->string('send_email')->default('no');
            $table->timestamps();
        });

        Schema::create('global_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('locale')->default('en');
            $table->string('timezone')->nullable();
            $table->timestamps();
        });

        Schema::create('smtp_settings', function (Blueprint $table) {
            $table->increments('id');
            $table->string('mail_driver')->nullable();
            $table->string('mail_host')->nullable();
            $table->string('mail_port')->nullable();
            $table->string('mail_username')->nullable();
            $table->string('mail_password')->nullable();
            $table->string('mail_from_name')->nullable();
            $table->string('mail_from_email')->nullable();
            $table->string('mail_encryption')->nullable();
            $table->timestamps();
        });

        DB::table('global_settings')->insert([
            'id' => 1,
            'locale' => 'en',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('smtp_settings')->insert([
            'id' => 1,
            'mail_from_name' => 'Test',
            'mail_from_email' => 'test@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function makeCompany(?string $timezone): Company
    {
        $company = new Company();
        $company->id = 1;
        $company->timezone = $timezone;
        $company->locale = 'en';
        $company->header_color = '#000000';

        return $company;
    }

    private function makeUser(?string $timezone, string $name = 'Agent'): User
    {
        $user = new User();
        $user->id = $timezone === 'Europe/Berlin' ? 1 : 2;
        $user->name = $name;
        $user->email = strtolower($name) . '@example.com';
        $user->locale = 'en';
        $user->timezone = $timezone;
        $user->email_notifications = true;

        return $user;
    }

    private function makeDeal(Company $company): Deal
    {
        $deal = new Deal();
        $deal->id = 10;
        $deal->name = 'Timezone Deal';
        $deal->setRelation('company', $company);

        return $deal;
    }

    public function test_deal_activity_renders_in_recipient_timezone(): void
    {
        $company = $this->makeCompany('UTC');
        $deal = $this->makeDeal($company);
        $user = $this->makeUser('Europe/Berlin', 'Berlin User');

        $notification = new DealActivityNotification($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => 'Follow-up',
            'meeting_date' => $this->meetingUtc->toIso8601String(),
            'follow_up_id' => 55,
            'triggered_by_name' => 'Admin',
        ]);

        $payload = $notification->toArray($user);

        // 15:00 UTC -> 16:00 Europe/Berlin (winter)
        $this->assertStringContainsString('Jan 19, 2026 16:00', $payload['text']);
        $this->assertSame(
            'Jan 19, 2026 16:00',
            $payload['additional_data']['meeting_date'] ?? null
        );
    }

    public function test_deal_activity_falls_back_to_company_timezone(): void
    {
        $company = $this->makeCompany('Asia/Dubai');
        $deal = $this->makeDeal($company);
        $user = $this->makeUser(null, 'No Tz User');

        $notification = new DealActivityNotification($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => 'Follow-up',
            'meeting_date' => $this->meetingUtc->toIso8601String(),
            'triggered_by_name' => 'Admin',
        ]);

        $payload = $notification->toArray($user);

        // 15:00 UTC -> 19:00 Asia/Dubai
        $this->assertStringContainsString('Jan 19, 2026 19:00', $payload['text']);
    }

    public function test_deal_activity_falls_back_to_utc(): void
    {
        $company = $this->makeCompany(null);
        $deal = $this->makeDeal($company);
        $user = $this->makeUser(null, 'Utc Fallback');

        $notification = new DealActivityNotification($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => 'Follow-up',
            'meeting_date' => $this->meetingUtc->toIso8601String(),
            'triggered_by_name' => 'Admin',
        ]);

        $payload = $notification->toArray($user);

        $this->assertStringContainsString('Jan 19, 2026 15:00', $payload['text']);
    }

    public function test_deal_activity_renders_distinct_times_for_two_recipients(): void
    {
        $company = $this->makeCompany('UTC');
        $deal = $this->makeDeal($company);

        $berlin = $this->makeUser('Europe/Berlin', 'Berlin');
        $nyc = $this->makeUser('America/New_York', 'NYC');
        $nyc->id = 3;

        $notification = new DealActivityNotification($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => 'Follow-up',
            'meeting_date' => $this->meetingUtc->toIso8601String(),
            'triggered_by_name' => 'Admin',
        ]);

        $berlinText = $notification->toArray($berlin)['text'];
        $nycText = $notification->toArray($nyc)['text'];

        $this->assertStringContainsString('Jan 19, 2026 16:00', $berlinText);
        $this->assertStringContainsString('Jan 19, 2026 10:00', $nycText);
        $this->assertNotSame($berlinText, $nycText);
    }

    public function test_deal_activity_leaves_legacy_formatted_string_unchanged(): void
    {
        $company = $this->makeCompany('UTC');
        $deal = $this->makeDeal($company);
        $user = $this->makeUser('Europe/Berlin', 'Berlin');

        $legacy = 'Jan 19, 2026 15:00';

        $notification = new DealActivityNotification($deal, DealActivityType::MEETING_UPDATED, [
            'meeting_remark' => 'Follow-up',
            'meeting_date' => $legacy,
            'triggered_by_name' => 'Admin',
        ]);

        $payload = $notification->toArray($user);

        $this->assertStringContainsString($legacy, $payload['text']);
    }

    public function test_meeting_summary_renders_in_recipient_timezone(): void
    {
        $company = $this->makeCompany('UTC');
        $deal = $this->makeDeal($company);

        $followUp = new DealFollowUp();
        $followUp->next_follow_up_date = $this->meetingUtc;
        $followUp->location = 'zoom';

        $summary = new MeetingSummary();
        $summary->id = 7;

        $notification = new MeetingSummaryNotification($summary, $followUp, $deal, 'created');
        $user = $this->makeUser('Europe/Berlin', 'Berlin');

        $mail = $notification->toMail($user);
        $lines = implode("\n", $mail->introLines ?? []);

        $this->assertStringContainsString('Jan 19, 2026 16:00', $lines);
    }

    public function test_meeting_link_failed_renders_in_recipient_timezone(): void
    {
        $company = $this->makeCompany('UTC');
        $deal = $this->makeDeal($company);
        $deal->id = 99;

        $followUp = new DealFollowUp();
        $followUp->deal_id = 99;
        $followUp->next_follow_up_date = $this->meetingUtc;
        $followUp->location = 'office';
        $followUp->setRelation('deal', $deal);
        $followUp->setRelation('meetingType', null);

        $agent = $this->makeUser('America/New_York', 'Agent');

        $notification = new MeetingLinkGenerationFailed($followUp, $agent, 'Zoho error');

        // Avoid full mail build (markdown + lang); assert via reflection of formatted date path.
        $timezone = \App\Support\UserTimezone::resolve($agent, $company);
        $formatted = $followUp->next_follow_up_date
            ->copy()
            ->setTimezone($timezone)
            ->format('M d, Y \a\t g:i A');

        $this->assertSame('Jan 19, 2026 at 10:00 AM', $formatted);

        // Ensure notification construction succeeded with UserTimezone import wired.
        $this->assertInstanceOf(MeetingLinkGenerationFailed::class, $notification);

        $mailContent = $this->invokeToMailContent($notification, $agent);
        $this->assertStringContainsString('Jan 19, 2026 at 10:00 AM', $mailContent);
    }

    /**
     * Extract markdown content array from MeetingLinkGenerationFailed::toMail without asserting full SMTP.
     */
    private function invokeToMailContent(MeetingLinkGenerationFailed $notification, User $notifiable): string
    {
        $mail = $notification->toMail($notifiable);
        $viewData = $mail->viewData ?? [];

        return (string) ($viewData['content'] ?? '');
    }
}
