<?php

namespace Tests\Unit\EntitySummary;

use App\Services\EntitySummary\LeadSummaryRedactor;
use PHPUnit\Framework\TestCase;

class LeadSummaryRedactorTest extends TestCase
{
    public function test_it_masks_email_addresses(): void
    {
        $redactor = new LeadSummaryRedactor();

        $this->assertSame(
            'Send it to [email] please',
            $redactor->redact('Send it to jane.doe+crm@example.co.uk please')
        );
    }

    public function test_it_masks_international_and_local_phone_numbers(): void
    {
        $redactor = new LeadSummaryRedactor();

        $this->assertSame('Call [phone] after 6pm', $redactor->redact('Call +90 533 877 3001 after 6pm'));
        $this->assertSame('Call [phone] after 6pm', $redactor->redact('Call 0533 877 30 01 after 6pm'));
        $this->assertSame('WhatsApp [phone]', $redactor->redact('WhatsApp (0049) 151-2345-6789'));
    }

    public function test_it_leaves_budgets_dates_and_ordinary_numbers_alone(): void
    {
        $redactor = new LeadSummaryRedactor();

        foreach ([
            'Budget is 1 500 000 USD',
            'Budget 200,000 - 250,000 EUR',
            'Trip on 2026-11-14 for 5 nights',
            'Viewing on 14.11.2026 at 10:30',
            '2 bedrooms, not above the 5th floor, 120 m2',
        ] as $text) {
            $this->assertSame($text, $redactor->redact($text), $text);
        }
    }

    public function test_it_masks_the_leads_own_name_and_each_part_of_it(): void
    {
        $redactor = new LeadSummaryRedactor(['Jane Doe', 'Acme Holdings']);

        $this->assertSame(
            '[name] works at [name] and [name] prefers email. Ask [name] about it.',
            $redactor->redact('Jane Doe works at Acme Holdings and Jane prefers email. Ask doe about it.')
        );
    }

    public function test_name_masking_respects_word_boundaries(): void
    {
        $redactor = new LeadSummaryRedactor(['Ann']);

        $this->assertSame('[name] asked about annual fees', $redactor->redact('Ann asked about annual fees'));
    }

    public function test_it_ignores_empty_and_very_short_known_terms(): void
    {
        $redactor = new LeadSummaryRedactor([null, '', '  ', 'Al']);

        // "Al" is the whole value so it is masked as a whole word, but nothing short
        // is split out of longer terms and empties never produce an empty pattern.
        $this->assertSame('Talk to [name] about alpine villas', $redactor->redact('Talk to Al about alpine villas'));
        $this->assertSame('plain text', $redactor->redact('plain text'));
    }

    public function test_clean_strips_html_collapses_whitespace_redacts_and_truncates(): void
    {
        $redactor = new LeadSummaryRedactor(['Jane Doe']);

        $html = "<p>Spoke to <b>Jane Doe</b>&nbsp;today.</p>\n\n<p>Email  jane@example.com &amp; confirm.</p>";

        $this->assertSame(
            'Spoke to [name] today. Email [email] & confirm.',
            $redactor->clean($html)
        );

        $this->assertSame('abcde', $redactor->clean('abcdefghij', 5));
        $this->assertSame('', $redactor->clean(null));
        $this->assertSame('', $redactor->clean('<p> </p>'));
    }

    public function test_clean_does_not_split_multibyte_characters(): void
    {
        $redactor = new LeadSummaryRedactor();

        $this->assertSame('Bütçe 2', $redactor->clean('Bütçe 250.000 euro', 7));
        $this->assertNotFalse(json_encode($redactor->clean(str_repeat('ğ', 6000), 600)));
    }
}
