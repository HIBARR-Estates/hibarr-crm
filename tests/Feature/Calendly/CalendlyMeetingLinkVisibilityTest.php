<?php

namespace Tests\Feature\Calendly;

use App\Http\Controllers\CalendlyMeetingLinkController;
use App\Models\CalendlyMeetingLink;

class CalendlyMeetingLinkVisibilityTest extends CalendlyTestCase
{
    private function visibleTo(array $roleIds): array
    {
        return CalendlyMeetingLink::visibleToRoles($roleIds)->orderBy('name')->pluck('name')->all();
    }

    public function test_a_link_is_shown_only_to_the_roles_it_names(): void
    {
        $this->link(['name' => 'A everyone (null)', 'role_ids' => null]);
        $this->link(['name' => 'B everyone (empty)', 'role_ids' => []]);
        $this->link(['name' => 'C sales', 'role_ids' => [2]]);
        $this->link(['name' => 'D managers', 'role_ids' => [3]]);
        $this->link(['name' => 'E sales or managers, hidden', 'role_ids' => [2, 3], 'is_active' => false]);
        $this->link(['name' => 'F sales or managers', 'role_ids' => [2, 3]]);

        $this->assertSame(
            ['A everyone (null)', 'B everyone (empty)', 'C sales', 'F sales or managers'],
            $this->visibleTo([2]),
        );
        $this->assertSame(
            ['A everyone (null)', 'B everyone (empty)', 'D managers', 'F sales or managers'],
            $this->visibleTo([3]),
        );
        $this->assertSame(
            ['A everyone (null)', 'B everyone (empty)', 'C sales', 'D managers', 'F sales or managers'],
            $this->visibleTo([2, 3]),
        );
        $this->assertSame(
            ['A everyone (null)', 'B everyone (empty)'],
            $this->visibleTo([9]),
            'a role no link names still sees the ones open to everyone',
        );
        $this->assertSame(
            ['A everyone (null)', 'B everyone (empty)'],
            $this->visibleTo([]),
        );
    }

    public function test_only_secure_calendly_addresses_are_accepted(): void
    {
        foreach ([
            'https://calendly.com/team/intro',
            'https://calendly.com/team/intro?month=2026-12',
            'https://events.calendly.com/team/intro',
        ] as $accepted) {
            $this->assertTrue(CalendlyMeetingLinkController::isCalendlyUrl($accepted), $accepted);
        }

        // The contact's name and email are added when the link opens, so it
        // must not be able to point anywhere but Calendly.
        foreach ([
            'http://calendly.com/team/intro',
            'https://evil.example.com/calendly.com',
            'https://calendly.com.evil.example.com/team',
            'https://notcalendly.com/team',
            'https://evil.example.com/?next=https://calendly.com/team',
            'javascript:alert(1)',
            'calendly.com/team/intro',
            '',
        ] as $refused) {
            $this->assertFalse(CalendlyMeetingLinkController::isCalendlyUrl($refused), $refused);
        }
    }
}
