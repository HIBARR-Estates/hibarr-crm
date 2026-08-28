<?php

namespace Tests\Unit\Support;

use App\Support\NotificationBypass;
use App\Support\NotificationBypassCatalog;
use Tests\TestCase;

class NotificationBypassCatalogTest extends TestCase
{
    public function test_flag_is_a_known_flag(): void
    {
        $this->assertContains(NotificationBypass::FLAG, config('features.known_flags'));
    }

    public function test_deal_and_meeting_types_are_bypassable(): void
    {
        $this->assertTrue(NotificationBypassCatalog::isBypassable('DealActivityNotification'));
        $this->assertTrue(NotificationBypassCatalog::isBypassable('MeetingLinkGenerationFailed'));
        $this->assertTrue(NotificationBypassCatalog::isBypassable('MeetingSummaryNotification'));
    }

    public function test_security_types_are_not_bypassable_or_listed(): void
    {
        $keys = array_column(NotificationBypassCatalog::types(), 'key');

        foreach (NotificationBypassCatalog::DENYLIST as $denied) {
            $this->assertFalse(NotificationBypassCatalog::isBypassable($denied), $denied);
            $this->assertNotContains($denied, $keys);
        }
    }

    public function test_unknown_class_is_not_bypassable(): void
    {
        $this->assertFalse(NotificationBypassCatalog::isBypassable('NotARealNotification'));
    }
}
