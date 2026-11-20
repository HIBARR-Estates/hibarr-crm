<?php

namespace Tests\Feature\Calendly;

use App\Support\CalendlyLinkBuilder;

class CalendlyLinkBuilderTest extends CalendlyTestCase
{
    private function queryOf(string $url): array
    {
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        return $query;
    }

    public function test_the_link_is_filled_in_with_the_contact_and_the_guests(): void
    {
        $link = $this->link(['url' => 'https://calendly.com/team/intro?hide_gdpr_banner=1']);

        $url = CalendlyLinkBuilder::build($link, $this->lead('Ada Lovelace', 'ada@example.com'), ['sam@hibarr.de', 'kim@hibarr.de']);
        $query = $this->queryOf($url);

        $this->assertStringStartsWith('https://calendly.com/team/intro?', $url);
        $this->assertSame('Ada Lovelace', $query['name']);
        $this->assertSame('Ada', $query['first_name']);
        $this->assertSame('Lovelace', $query['last_name']);
        $this->assertSame('ada@example.com', $query['email']);
        $this->assertSame('sam@hibarr.de,kim@hibarr.de', $query['guests']);
        $this->assertSame('1', $query['hide_gdpr_banner'], 'what the admin put on the link is kept');
    }

    public function test_no_guests_leaves_the_guests_field_off(): void
    {
        $query = $this->queryOf(CalendlyLinkBuilder::build($this->link(), $this->lead('Ada Lovelace', 'ada@example.com'), []));

        $this->assertArrayNotHasKey('guests', $query);
    }

    public function test_guests_are_deduplicated_and_never_include_the_contact(): void
    {
        $query = $this->queryOf(CalendlyLinkBuilder::build(
            $this->link(),
            $this->lead('Ada Lovelace', 'ada@example.com'),
            ['Sam@hibarr.de', 'sam@hibarr.de', '', ' ADA@example.com ', 'kim@hibarr.de'],
        ));

        $this->assertSame('Sam@hibarr.de,kim@hibarr.de', $query['guests']);
    }

    public function test_guests_are_capped_at_what_calendly_accepts(): void
    {
        $emails = array_map(fn ($i) => "person{$i}@hibarr.de", range(1, 14));

        $query = $this->queryOf(CalendlyLinkBuilder::build($this->link(), $this->lead('Ada Lovelace', 'ada@example.com'), $emails));

        $this->assertCount(CalendlyLinkBuilder::MAX_GUESTS, explode(',', $query['guests']));
    }

    public function test_a_guest_list_saved_on_the_link_never_leaks_into_a_booking(): void
    {
        $link = $this->link(['url' => 'https://calendly.com/team/intro?guests=old@example.com']);

        $query = $this->queryOf(CalendlyLinkBuilder::build($link, $this->lead('Ada Lovelace', 'ada@example.com'), ['sam@hibarr.de']));
        $this->assertSame('sam@hibarr.de', $query['guests']);

        $query = $this->queryOf(CalendlyLinkBuilder::build($link, $this->lead('Ada Lovelace', 'ada@example.com'), []));
        $this->assertArrayNotHasKey('guests', $query, 'removing everybody means no guests, whatever the stored link says');
    }

    public function test_a_single_word_name_leaves_the_last_name_out(): void
    {
        $query = $this->queryOf(CalendlyLinkBuilder::build($this->link(), $this->lead('Madonna', 'm@example.com')));

        $this->assertSame('Madonna', $query['first_name']);
        $this->assertArrayNotHasKey('last_name', $query);
    }

    public function test_a_deal_without_a_lead_still_gets_the_guests(): void
    {
        $query = $this->queryOf(CalendlyLinkBuilder::build($this->link(), null, ['sam@hibarr.de']));

        $this->assertSame('sam@hibarr.de', $query['guests']);
        $this->assertArrayNotHasKey('email', $query);
    }
}
