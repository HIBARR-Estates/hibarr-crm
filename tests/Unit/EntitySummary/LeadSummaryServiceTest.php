<?php

namespace Tests\Unit\EntitySummary;

use App\Models\Lead;
use App\Services\EntitySummary\EntitySummaryPromptLoader;
use App\Services\EntitySummary\EntitySummaryValidator;
use App\Services\EntitySummary\LeadSummaryService;
use App\Services\EntitySummary\LeadSummaryTokens;
use Tests\TestCase;

class LeadSummaryServiceTest extends TestCase
{
    public function test_heuristic_fallback_for_a_thin_lead_is_valid_and_states_what_is_on_file(): void
    {
        $summary = $this->fallback([
            'now' => '2026-11-02T10:00:00Z',
            'lead' => ['type' => 'buyer', 'source' => 'Facebook', 'days_since_created' => 1],
            'sections' => [],
        ]);

        (new EntitySummaryValidator())->validateLeadSummary($summary);

        $this->assertSame('lead', $summary['primary_risk_source']);
        $this->assertSame('low', $summary['meta']['data_confidence']);
        $this->assertSame('heuristic', $summary['meta']['source']);
        $this->assertStringContainsString('Facebook', $summary['summary']);
        $this->assertStringContainsString('Facebook', $summary['status_line']);
        $this->assertSame('CONTACT_LEAD', $summary['next_step']['action_type']);
        $this->assertSame(['source'], array_column($summary['chips'], 'id'));
    }

    public function test_heuristic_fallback_does_not_need_a_lead_name_or_deal_name(): void
    {
        $summary = $this->fallback([
            'now' => '2026-11-02T10:00:00Z',
            'lead' => ['type' => 'buyer'],
            'sections' => [
                'deals' => [
                    ['deal_id' => 'd1', 'stage_label' => 'Payment', 'risk_level' => 'high', 'value' => 310000, 'currency' => 'USD'],
                ],
            ],
        ]);

        (new EntitySummaryValidator())->validateLeadSummary($summary);

        $this->assertSame('linked_deal', $summary['primary_risk_source']);
        $this->assertSame('high', $summary['risk_level']);
        $this->assertSame('OPEN_DEAL', $summary['next_step']['action_type']);
        $this->assertSame('d1', $summary['next_step']['target_deal_id']);
        $this->assertSame('immediate', $summary['next_step']['urgency']);
        $this->assertStringContainsString('Payment', $summary['status_line']);
    }

    public function test_heuristic_fallback_reviews_several_at_risk_deals_without_picking_one(): void
    {
        $summary = $this->fallback([
            'now' => '2026-11-02T10:00:00Z',
            'lead' => ['type' => 'buyer'],
            'sections' => [
                'deals' => [
                    ['deal_id' => 'd1', 'stage_label' => 'Payment', 'risk_level' => 'high'],
                    ['deal_id' => 'd2', 'stage_label' => 'Documents', 'risk_level' => 'medium'],
                    ['deal_id' => 'd3', 'stage_label' => 'Arrangements', 'risk_level' => 'low'],
                ],
            ],
        ]);

        (new EntitySummaryValidator())->validateLeadSummary($summary);

        $this->assertSame('REVIEW_DEALS', $summary['next_step']['action_type']);
        $this->assertNull($summary['next_step']['target_deal_id']);
        $this->assertStringContainsString('2 linked deals', $summary['status_line']);
    }

    public function test_heuristic_fallback_summarises_the_substantive_sections(): void
    {
        $summary = $this->fallback([
            'now' => '2026-11-02T10:00:00Z',
            'lead' => ['type' => 'buyer', 'source' => 'Google Ads', 'category' => 'Investor'],
            'sections' => [
                'qualification_calls' => [['answers' => [['answer' => 'a'], ['answer' => 'b'], ['answer' => 'c']]]],
                'notes' => [['days_ago' => 4, 'text' => 'x'], ['days_ago' => 9, 'text' => 'y']],
            ],
        ]);

        $chips = array_column($summary['chips'], null, 'id');

        $this->assertSame('3 answers', $chips['qualification_calls']['value']);
        $this->assertSame('2 logged', $chips['notes']['value']);
        $this->assertSame('Latest 4 days ago', $chips['notes']['sublabel']);
        $this->assertArrayNotHasKey('contactability', $chips);
    }

    /**
     * The service sanitizes tokens before validating: a fact whose value is only a
     * made-up token is valid as the model wrote it, but empty once the token is
     * stripped, and must be rejected rather than stored as an empty fact.
     */
    public function test_a_fact_emptied_by_token_sanitizing_fails_validation(): void
    {
        $prompt = (new EntitySummaryPromptLoader())->loadLeadSummaryPrompt();
        preg_match('/EXAMPLE OUTPUT:\s*(\{.*\})\s*$/s', $prompt, $match);
        $example = json_decode($match[1], true);
        $example['facts'][0]['value'] = '{{lead_nickname}}';

        $validator = new EntitySummaryValidator();
        $validator->validateLeadSummary($example);

        $this->expectException(\InvalidArgumentException::class);
        $validator->validateLeadSummary(LeadSummaryTokens::sanitize($example));
    }

    /**
     * The prompt ships a worked example. If the example stops being valid output
     * (wrong key, bad tone, unknown action) the model is being taught to fail
     * validation, so hold it to the same validator the real response goes through.
     */
    public function test_the_prompts_example_output_passes_the_validator(): void
    {
        $prompt = (new EntitySummaryPromptLoader())->loadLeadSummaryPrompt();

        $this->assertStringNotContainsString('`', $prompt, 'the loader stops at the first closing fence');
        $this->assertSame(1, preg_match('/EXAMPLE OUTPUT:\s*(\{.*\})\s*$/s', $prompt, $match), 'prompt has no example output');

        $example = json_decode($match[1], true);
        $this->assertIsArray($example, 'example output is not valid JSON: '.json_last_error_msg());

        (new EntitySummaryValidator())->validateLeadSummary($example);

        // The example must obey the prompt's own rules — it is what the model
        // imitates, so a wordy or list-shaped example produces the same.
        $this->assertLessThanOrEqual(20, $this->words($example['status_line']), 'status_line');

        $summary = $example['summary'];
        $this->assertLessThanOrEqual(80, $this->words($summary), 'summary words');
        $sentences = preg_match_all('/[.!?](\s|$)/u', $summary);
        $this->assertGreaterThanOrEqual(3, $sentences, 'summary sentences');
        $this->assertLessThanOrEqual(4, $sentences, 'summary sentences');
        $highlights = preg_match_all('/\*\*[^*]+\*\*/u', $summary);
        $this->assertGreaterThanOrEqual(1, $highlights);
        $this->assertLessThanOrEqual(4, $highlights);
        $this->assertLessThanOrEqual(1, preg_match_all('/==[^=]+==/u', $summary), 'at most one open item');

        // Facts row: icon + value, no labels — the value has to stand alone.
        $facts = $example['facts'];
        $this->assertGreaterThanOrEqual(3, count($facts));
        $this->assertLessThanOrEqual(6, count($facts));
        $kinds = array_column($facts, 'kind');
        $this->assertSame($kinds, array_values(array_unique($kinds)), 'one fact per kind');
        foreach ($facts as $fact) {
            $this->assertContains($fact['kind'], EntitySummaryValidator::LEAD_FACT_KINDS);
            $this->assertLessThanOrEqual(5, $this->words($fact['value']), "fact: {$fact['value']}");
        }
        $this->assertStringNotContainsString("\n", $summary, 'summary must be one paragraph, not a list');

        // The lead is named with a replacement token (the model never sees the real name),
        // only ever one the card can fill in, and never a leaked redaction placeholder.
        $text = json_encode($example, JSON_UNESCAPED_UNICODE);
        preg_match_all('/\{\{(\w+)\}\}/', $text, $used);
        $this->assertNotEmpty($used[1], 'the example must show the model using a token');
        $this->assertSame([], array_diff($used[1], \App\Services\EntitySummary\LeadSummaryTokens::NAMES));
        $this->assertStringContainsString('{{lead_first_name}}', $example['status_line']);
        $this->assertStringContainsString('{{lead_first_name}}', $example['summary']);
        foreach (['[name]', '[email]', '[phone]'] as $placeholder) {
            $this->assertStringNotContainsString($placeholder, $text);
        }

        // Prose only: no labels, chips or bullet lists.
        $this->assertSame([], $example['chips']);
        $this->assertSame([], $example['bullets']);

        $this->assertLessThanOrEqual(6, $this->words($example['next_step']['label']));
        $this->assertLessThanOrEqual(10, $this->words($example['next_step']['rationale']));
    }

    private function words(string $text): int
    {
        // Separators such as "·" are not words.
        return count(array_filter(
            preg_split('/\s+/u', trim($text), -1, PREG_SPLIT_NO_EMPTY) ?: [],
            fn (string $token) => preg_match('/[\p{L}\p{N}]/u', $token) === 1
        ));
    }

    /**
     * @param  array<string, mixed>  $input
     * @return array<string, mixed>
     */
    private function fallback(array $input): array
    {
        $service = (new \ReflectionClass(LeadSummaryService::class))->newInstanceWithoutConstructor();
        $lead = (new \ReflectionClass(Lead::class))->newInstanceWithoutConstructor();

        $method = new \ReflectionMethod(LeadSummaryService::class, 'heuristicFallback');
        $method->setAccessible(true);

        return $method->invoke($service, $lead, $input);
    }
}
