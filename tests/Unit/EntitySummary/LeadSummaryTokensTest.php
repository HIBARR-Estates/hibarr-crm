<?php

namespace Tests\Unit\EntitySummary;

use App\Services\EntitySummary\EntitySummaryPromptLoader;
use App\Services\EntitySummary\LeadSummaryTokens;
use Tests\TestCase;

class LeadSummaryTokensTest extends TestCase
{
    public function test_known_tokens_are_kept(): void
    {
        $summary = LeadSummaryTokens::sanitize([
            'status_line' => '{{lead_first_name}} wants an apartment.',
            'summary' => '{{lead_first_name}} and {{lead_full_name}}.',
        ]);

        $this->assertSame('{{lead_first_name}} wants an apartment.', $summary['status_line']);
        $this->assertSame('{{lead_first_name}} and {{lead_full_name}}.', $summary['summary']);
    }

    public function test_known_tokens_are_normalised_for_spacing_and_case(): void
    {
        $summary = LeadSummaryTokens::sanitize([
            'summary' => '{{ Lead_First_Name }} wants it, and so does {{LEAD_FULL_NAME}}.',
        ]);

        $this->assertSame('{{lead_first_name}} wants it, and so does {{lead_full_name}}.', $summary['summary']);
    }

    public function test_unknown_tokens_are_removed_and_the_gap_is_tidied(): void
    {
        $summary = LeadSummaryTokens::sanitize([
            'status_line' => 'Call {{lead_nickname}} today.',
            'summary' => 'Contact {{partner_name}}, then {{lead_first_name}} , and {{}} done.',
        ]);

        $this->assertSame('Call today.', $summary['status_line']);
        $this->assertSame('Contact, then {{lead_first_name}}, and done.', $summary['summary']);
    }

    public function test_it_reaches_strings_at_any_depth(): void
    {
        $summary = LeadSummaryTokens::sanitize([
            'facts' => [['kind' => 'property', 'value' => '{{bogus}} 2-bed']],
            'next_step' => ['label' => 'Send {{lead_first_name}} figures', 'rationale' => 'Ask {{bogus}}.'],
            'bullets' => ['{{lead_full_name}} said so'],
            'meta' => ['confidence' => 3],
        ]);

        $this->assertSame('2-bed', $summary['facts'][0]['value']);
        $this->assertSame('Send {{lead_first_name}} figures', $summary['next_step']['label']);
        $this->assertSame('Ask.', $summary['next_step']['rationale']);
        $this->assertSame('{{lead_full_name}} said so', $summary['bullets'][0]);
        $this->assertSame(3, $summary['meta']['confidence'], 'non-strings are left alone');
    }

    public function test_text_without_tokens_is_untouched(): void
    {
        $input = ['summary' => 'Budget is {200K} or ==open== and **bold**, no tokens.', 'n' => null];

        $this->assertSame($input, LeadSummaryTokens::sanitize($input));
    }

    /**
     * The prompt, this class and the card's TypeScript each carry the token list. If
     * one gains or loses a token the model, the sanitizer or the renderer would
     * disagree about what a token means.
     */
    public function test_the_prompt_the_sanitizer_and_the_card_agree_on_the_tokens(): void
    {
        $expected = LeadSummaryTokens::NAMES;
        sort($expected);

        $prompt = (new EntitySummaryPromptLoader())->loadLeadSummaryPrompt();
        preg_match_all('/\{\{(\w+)\}\}/', $prompt, $inPrompt);
        $promptTokens = array_values(array_unique($inPrompt[1]));
        sort($promptTokens);
        $this->assertSame($expected, $promptTokens, 'tokens used or documented in the prompt');

        $ts = file_get_contents(dirname(__DIR__, 3).'/resources/js/Components/EntitySummary/summaryTokens.ts');
        $this->assertSame(1, preg_match('/SUMMARY_TOKEN_NAMES\s*=\s*\[(.*?)\]/s', (string) $ts, $list), 'summaryTokens.ts must export SUMMARY_TOKEN_NAMES');
        preg_match_all('/"(\w+)"/', $list[1], $inTs);
        $tsTokens = $inTs[1];
        sort($tsTokens);
        $this->assertSame($expected, $tsTokens, 'tokens the card knows how to fill in');
    }
}
