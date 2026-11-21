<?php

namespace Tests\Feature\Meetings;

use App\Models\Lead;
use App\Models\LeadContactMethod;
use App\Services\MeetingContactability;
use Tests\TestCase;

class MeetingContactabilityTest extends TestCase
{
    private function lead(array $attributes = [], array $methods = []): Lead
    {
        $lead = new Lead;

        foreach ($attributes as $key => $value) {
            $lead->{$key} = $value;
        }

        $lead->setRelation('contactMethods', collect(array_map(
            fn (array $method) => new LeadContactMethod($method),
            $methods,
        )));

        return $lead;
    }

    public function test_every_distinct_email_and_number_on_the_lead_is_collected(): void
    {
        $lead = $this->lead(
            [
                'client_email' => 'ada@example.com',
                'mobile' => '{"countryCode":"49","areaCode":"151","phoneNumber":"12345678"}',
                'cell' => '+49 151 12345678',
                'office' => '030 123456',
            ],
            [
                ['type' => 'email', 'identifier' => 'ADA@example.com'],
                ['type' => 'email', 'identifier' => 'ada.work@example.com'],
                ['type' => 'phone', 'identifier' => '+44 20 7946 0958'],
            ],
        );

        $contact = MeetingContactability::forLead($lead);

        $this->assertSame(['ada@example.com', 'ada.work@example.com'], $contact['emails'], 'the same address is kept once');
        $this->assertCount(3, $contact['phones'], 'the same number written two ways is kept once');
    }

    public function test_a_lead_with_nothing_usable_has_no_contact(): void
    {
        $lead = $this->lead(
            ['client_email' => '   ', 'mobile' => '', 'cell' => '12', 'office' => '--'],
            [['type' => 'email', 'identifier' => 'not-an-email']],
        );

        $this->assertSame(['emails' => [], 'phones' => []], MeetingContactability::forLead($lead));
        $this->assertSame(['emails' => [], 'phones' => []], MeetingContactability::forLead(null));
    }

    public function test_online_meetings_need_an_email_and_phone_meetings_a_number(): void
    {
        foreach (['zoom', 'zoho', 'zoho_meet', 'google_meet', 'meet', 'teams'] as $location) {
            $this->assertSame(MeetingContactability::NEEDS_EMAIL, MeetingContactability::requirement($location), $location);
        }

        $this->assertSame(MeetingContactability::NEEDS_PHONE, MeetingContactability::requirement('phone'));
        $this->assertSame(MeetingContactability::NEEDS_PHONE, MeetingContactability::requirement(' Phone '));

        foreach (['physical', 'office', 'other', 'skype', '', null] as $location) {
            $this->assertSame(MeetingContactability::NEEDS_ANY, MeetingContactability::requirement($location), (string) $location);
        }
    }

    public function test_the_shortfall_names_what_the_method_needs_and_the_lead_lacks(): void
    {
        $none = ['emails' => [], 'phones' => []];
        $emailOnly = ['emails' => ['a@example.com'], 'phones' => []];
        $phoneOnly = ['emails' => [], 'phones' => ['+4915112345678']];
        $both = ['emails' => ['a@example.com'], 'phones' => ['+4915112345678']];

        $this->assertSame('email', MeetingContactability::shortfall('zoom', $phoneOnly));
        $this->assertSame('email', MeetingContactability::shortfall('google_meet', $none));
        $this->assertNull(MeetingContactability::shortfall('zoom', $emailOnly));

        $this->assertSame('phone', MeetingContactability::shortfall('phone', $emailOnly));
        $this->assertNull(MeetingContactability::shortfall('phone', $phoneOnly));

        $this->assertSame('any', MeetingContactability::shortfall('physical', $none));
        $this->assertNull(MeetingContactability::shortfall('physical', $emailOnly));
        $this->assertNull(MeetingContactability::shortfall('physical', $phoneOnly));

        foreach (['zoom', 'phone', 'physical'] as $location) {
            $this->assertNull(MeetingContactability::shortfall($location, $both), $location);
        }
    }
}
