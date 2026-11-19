<?php

namespace Tests\Feature\Calendly;

use App\Support\CalendlyLinkBuilder;
use Illuminate\Support\Facades\DB;

class CalendlyLinkBuilderTest extends CalendlyTestCase
{
    public function test_the_link_is_filled_in_with_the_contact_and_tagged_with_the_record(): void
    {
        $link = $this->link(['url' => 'https://calendly.com/team/intro?hide_gdpr_banner=1']);
        DB::table('lead_contact_methods')->insert([
            ['lead_id' => 5, 'type' => 'email', 'identifier' => 'ada@example.com'],
            ['lead_id' => 5, 'type' => 'email', 'identifier' => 'ADA.WORK@example.com'],
            ['lead_id' => 5, 'type' => 'phone', 'identifier' => '+4915112345678'],
            ['lead_id' => 6, 'type' => 'email', 'identifier' => 'someone.else@example.com'],
        ]);

        $url = CalendlyLinkBuilder::build($link, 'lead', 5, $this->lead(5, 'Ada Lovelace', 'ada@example.com'), 42);

        $this->assertStringStartsWith('https://calendly.com/team/intro?', $url);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertSame('Ada Lovelace', $query['name']);
        $this->assertSame('Ada', $query['first_name']);
        $this->assertSame('Lovelace', $query['last_name']);
        $this->assertSame('ada@example.com', $query['email']);
        // Only this lead's other emails, and never their main address again.
        $this->assertSame('ADA.WORK@example.com', $query['guests']);
        $this->assertSame('1', $query['hide_gdpr_banner'], 'what the admin put on the link is kept');
        $this->assertSame(CalendlyLinkBuilder::UTM_SOURCE, $query['utm_source']);
        $this->assertSame('lead', $query['utm_medium']);
        $this->assertSame('5', $query['utm_campaign']);
        $this->assertSame((string) $link->id, $query['utm_content']);
    }

    public function test_a_single_word_name_leaves_the_last_name_out(): void
    {
        $url = CalendlyLinkBuilder::build($this->link(), 'lead', 5, $this->lead(5, 'Madonna', 'm@example.com'), null);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertSame('Madonna', $query['first_name']);
        $this->assertArrayNotHasKey('last_name', $query);
    }

    public function test_a_booking_tag_reads_back_to_the_record_it_was_made_for(): void
    {
        $link = $this->link();
        $url = CalendlyLinkBuilder::build($link, 'deal', 9, $this->lead(5, 'Ada Lovelace', 'ada@example.com'), 42);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertSame(
            ['record_type' => 'deal', 'record_id' => 9, 'link_id' => $link->id, 'user_id' => 42],
            CalendlyLinkBuilder::parseTracking($query, $this->companyId),
        );
    }

    public function test_a_tag_that_was_changed_or_is_for_another_company_is_refused(): void
    {
        $url = CalendlyLinkBuilder::build($this->link(), 'lead', 5, $this->lead(5, 'Ada Lovelace', 'ada@example.com'), 42);
        parse_str((string) parse_url($url, PHP_URL_QUERY), $query);

        $this->assertNull(CalendlyLinkBuilder::parseTracking(array_merge($query, ['utm_campaign' => '6']), $this->companyId), 'another lead');
        $this->assertNull(CalendlyLinkBuilder::parseTracking(array_merge($query, ['utm_medium' => 'deal']), $this->companyId), 'another kind of record');
        $this->assertNull(CalendlyLinkBuilder::parseTracking(array_merge($query, ['utm_term' => '7.'.explode('.', $query['utm_term'])[1]]), $this->companyId), 'another user');
        $this->assertNull(CalendlyLinkBuilder::parseTracking($query, $this->companyId + 1), 'another company');
        $this->assertNull(CalendlyLinkBuilder::parseTracking(['utm_source' => 'newsletter'], $this->companyId), 'not ours');
        $this->assertNull(CalendlyLinkBuilder::parseTracking([], $this->companyId));
    }
}
