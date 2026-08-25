<?php

namespace Tests\Unit\Support;

use App\Support\MeetingLocation;
use Tests\TestCase;

class MeetingLocationTest extends TestCase
{
    public function test_non_video_locations_do_not_support_join_links(): void
    {
        foreach (MeetingLocation::NON_VIDEO_LOCATIONS as $location) {
            $this->assertFalse(MeetingLocation::supportsJoinLink($location));
        }
    }

    public function test_video_locations_support_join_links(): void
    {
        foreach (MeetingLocation::VIDEO_LOCATIONS as $location) {
            $this->assertTrue(MeetingLocation::supportsJoinLink($location));
        }
    }

    public function test_free_text_physical_address_does_not_support_join_link(): void
    {
        $this->assertFalse(MeetingLocation::supportsJoinLink('123 Main Street, Berlin'));
    }

    public function test_empty_location_keeps_legacy_join_link_behavior(): void
    {
        $this->assertTrue(MeetingLocation::supportsJoinLink(null));
        $this->assertTrue(MeetingLocation::supportsJoinLink(''));
    }
}
