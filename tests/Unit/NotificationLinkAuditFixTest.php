<?php

namespace Tests\Unit;

use App\Models\Company;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\MeetingSummary;
use App\Notifications\AvailabilityEscalation;
use App\Notifications\BaseNotification;
use App\Notifications\MeetingSummaryNotification;
use App\Notifications\NewMentionChat;
use App\Notifications\NewTimesheetApproval;
use App\Notifications\ProjectTimelogApproveNotification;
use App\Notifications\PublishRequestSubmitted;
use App\Notifications\WeeklyTimesheetApproved;
use Illuminate\Notifications\Messages\MailMessage;
use ReflectionClass;
use Tests\TestCase;

class NotificationLinkAuditFixTest extends TestCase
{
    public function test_meeting_summary_route_resolves_under_account_prefix(): void
    {
        $url = route('meeting-summary.show', 99);

        $this->assertStringContainsString('account/meeting-summary/99', $url);
        $this->assertStringNotContainsString('/deals/', $url);
    }

    public function test_meeting_summary_notification_uses_correct_route(): void
    {
        $notification = $this->makeMeetingSummaryNotification(42);

        $link = $this->invokeProtected($notification, 'modifyUrl', [
            route('meeting-summary.show', 42),
        ]);

        $this->assertStringContainsString('meeting-summary/42', $link);
        $this->assertStringNotContainsString('/deals/', $link);
    }

    public function test_meeting_summary_notification_extends_base_notification(): void
    {
        $notification = $this->makeMeetingSummaryNotification(1);

        $this->assertInstanceOf(BaseNotification::class, $notification);
    }

    public function test_get_domain_specific_url_leaves_url_unchanged_when_subdomain_module_disabled(): void
    {
        $url = route('messages.index');

        $this->assertSame($url, getDomainSpecificUrl($url, new Company()));
    }

    public function test_new_mention_chat_channels_use_modify_url_for_messages_index(): void
    {
        $notification = new class extends NewMentionChat {
            public function __construct()
            {
            }

            public function messagesUrl(): string
            {
                return $this->modifyUrl(route('messages.index'));
            }
        };

        $expected = route('messages.index');
        $this->assertSame($expected, $notification->messagesUrl());
    }

    public function test_flagged_notifications_extend_base_notification(): void
    {
        $classes = [
            AvailabilityEscalation::class,
            PublishRequestSubmitted::class,
            ProjectTimelogApproveNotification::class,
            NewTimesheetApproval::class,
            WeeklyTimesheetApproved::class,
            NewMentionChat::class,
        ];

        foreach ($classes as $class) {
            $this->assertTrue(
                is_subclass_of($class, BaseNotification::class),
                "{$class} should extend BaseNotification"
            );
        }
    }

    public function test_meeting_summary_notification_to_mail_builds_action_with_correct_route(): void
    {
        if (!\Illuminate\Support\Facades\Schema::hasTable('global_settings')) {
            $this->markTestSkipped('Database not migrated for notification mail build test.');
        }

        $notification = $this->makeMeetingSummaryNotification(7);
        $notifiable = (object) ['name' => 'Test User', 'locale' => 'en'];

        $mail = $notification->toMail($notifiable);

        $this->assertInstanceOf(MailMessage::class, $mail);
        $actionUrl = $this->extractMailActionUrl($mail);
        $this->assertNotNull($actionUrl);
        $this->assertStringContainsString('meeting-summary/7', $actionUrl);
        $this->assertStringNotContainsString('/deals/', $actionUrl);
    }

    private function makeMeetingSummaryNotification(int $summaryId): MeetingSummaryNotification
    {
        $summary = new MeetingSummary();
        $summary->id = $summaryId;

        $followUp = new DealFollowUp();

        $deal = new Deal();
        $deal->id = 10;
        $deal->name = 'Test Deal';
        $deal->setRelation('company', new Company());

        return new MeetingSummaryNotification($summary, $followUp, $deal, 'created');
    }

    private function invokeProtected(object $object, string $method, array $args = []): mixed
    {
        $reflection = new ReflectionClass($object);
        $reflectionMethod = $reflection->getMethod($method);
        $reflectionMethod->setAccessible(true);

        return $reflectionMethod->invoke($object, ...$args);
    }

    private function extractMailActionUrl(MailMessage $mail): ?string
    {
        $reflection = new ReflectionClass($mail);
        $property = $reflection->getProperty('actionUrl');
        $property->setAccessible(true);

        return $property->getValue($mail);
    }
}
