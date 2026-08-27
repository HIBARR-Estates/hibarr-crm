<?php

namespace Tests\Unit\Services;

use App\Models\EmailNotificationSetting;
use App\Models\User;
use App\Notifications\Channels\BeamsPushChannel;
use App\Services\NotificationChannelResolver;
use NotificationChannels\OneSignal\OneSignalChannel;
use Tests\TestCase;

class NotificationChannelResolverTest extends TestCase
{
    private NotificationChannelResolver $resolver;

    protected function setUp(): void
    {
        parent::setUp();

        $this->resolver = new NotificationChannelResolver();

        // push_setting() reads from cache — seed it directly so these are pure
        // unit tests with no database access, matching TaskNotificationServiceTest.
        cache(['push_setting' => (object) [
            'status' => 'inactive',
            'beams_push_status' => 'inactive',
        ]]);
    }

    public function test_null_setting_fails_open_to_database_only(): void
    {
        $via = $this->resolver->resolve(null, $this->makeNotifiable());

        $this->assertSame(['database'], $via);
    }

    public function test_fully_disabled_setting_returns_empty_array(): void
    {
        $setting = $this->makeSetting();

        $via = $this->resolver->resolve($setting, $this->makeNotifiable());

        $this->assertSame([], $via);
    }

    public function test_database_only_when_only_send_database_enabled(): void
    {
        $setting = $this->makeSetting(['send_database' => 'yes']);

        $via = $this->resolver->resolve($setting, $this->makeNotifiable());

        $this->assertSame(['database'], $via);
    }

    public function test_mail_added_when_email_enabled_and_notifiable_opted_in(): void
    {
        $setting = $this->makeSetting(['send_email' => 'yes']);
        $notifiable = $this->makeNotifiable(['email_notifications' => true, 'email' => 'user@example.com']);

        $via = $this->resolver->resolve($setting, $notifiable);

        $this->assertContains('mail', $via);
    }

    public function test_mail_skipped_when_notifiable_opted_out(): void
    {
        $setting = $this->makeSetting(['send_email' => 'yes']);
        $notifiable = $this->makeNotifiable(['email_notifications' => false, 'email' => 'user@example.com']);

        $via = $this->resolver->resolve($setting, $notifiable);

        $this->assertNotContains('mail', $via);
    }

    public function test_mail_skipped_when_notifiable_has_no_email(): void
    {
        $setting = $this->makeSetting(['send_email' => 'yes']);
        $notifiable = $this->makeNotifiable(['email_notifications' => true, 'email' => '']);

        $via = $this->resolver->resolve($setting, $notifiable);

        $this->assertNotContains('mail', $via);
    }

    public function test_slack_only_added_when_eligible(): void
    {
        $setting = $this->makeSetting(['send_slack' => 'yes']);

        $viaIneligible = $this->resolver->resolve($setting, $this->makeNotifiable(), false);
        $viaEligible = $this->resolver->resolve($setting, $this->makeNotifiable(), true);

        $this->assertNotContains('slack', $viaIneligible);
        $this->assertContains('slack', $viaEligible);
    }

    public function test_slack_not_added_when_disabled_even_if_eligible(): void
    {
        $setting = $this->makeSetting(['send_slack' => 'no']);

        $via = $this->resolver->resolve($setting, $this->makeNotifiable(), true);

        $this->assertNotContains('slack', $via);
    }

    public function test_onesignal_channel_added_when_push_enabled_and_active(): void
    {
        cache(['push_setting' => (object) ['status' => 'active', 'beams_push_status' => 'inactive']]);
        $setting = $this->makeSetting(['send_push' => 'yes']);

        $via = $this->resolver->resolve($setting, $this->makeNotifiable());

        $this->assertContains(OneSignalChannel::class, $via);
        $this->assertNotContains(BeamsPushChannel::class, $via);
    }

    public function test_beams_channel_added_when_push_enabled_and_active(): void
    {
        cache(['push_setting' => (object) ['status' => 'inactive', 'beams_push_status' => 'active']]);
        $setting = $this->makeSetting(['send_push' => 'yes']);

        $via = $this->resolver->resolve($setting, $this->makeNotifiable(['id' => 7]));

        $this->assertContains(BeamsPushChannel::class, $via);
        $this->assertNotContains(OneSignalChannel::class, $via);
    }

    public function test_beams_channel_skipped_when_notifiable_has_no_id(): void
    {
        cache(['push_setting' => (object) ['status' => 'inactive', 'beams_push_status' => 'active']]);
        $setting = $this->makeSetting(['send_push' => 'yes']);
        $notifiable = new \stdClass();
        $notifiable->email_notifications = false;

        $via = $this->resolver->resolve($setting, $notifiable);

        $this->assertNotContains(BeamsPushChannel::class, $via);
    }

    public function test_all_channels_enabled_together(): void
    {
        cache(['push_setting' => (object) ['status' => 'active', 'beams_push_status' => 'active']]);
        $setting = $this->makeSetting([
            'send_database' => 'yes',
            'send_email' => 'yes',
            'send_slack' => 'yes',
            'send_push' => 'yes',
        ]);
        $notifiable = $this->makeNotifiable(['email_notifications' => true, 'email' => 'user@example.com', 'id' => 3]);

        $via = $this->resolver->resolve($setting, $notifiable, true);

        $this->assertSame(['database', 'mail', 'slack', OneSignalChannel::class, BeamsPushChannel::class], $via);
    }

    /**
     * @param  array<string, string>  $overrides
     */
    private function makeSetting(array $overrides = []): EmailNotificationSetting
    {
        return new EmailNotificationSetting(array_merge([
            'send_database' => 'no',
            'send_email' => 'no',
            'send_slack' => 'no',
            'send_push' => 'no',
            'setting_name' => 'Test Notification',
            'slug' => 'test-notification',
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function makeNotifiable(array $overrides = []): User
    {
        $attributes = array_merge([
            'name' => 'Test User',
            'email' => '',
            'email_notifications' => false,
        ], $overrides);

        $id = $attributes['id'] ?? 1;
        unset($attributes['id']);

        $user = new User($attributes);
        $user->id = $id;
        $user->exists = true;

        return $user;
    }
}
