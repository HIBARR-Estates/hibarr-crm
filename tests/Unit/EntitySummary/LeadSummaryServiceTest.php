<?php

namespace Tests\Unit\EntitySummary;

use App\Models\Lead;
use App\Services\EntitySummary\EntitySummaryPromptLoader;
use App\Services\EntitySummary\EntitySummaryValidator;
use App\Services\EntitySummary\LeadSummaryService;
use PHPUnit\Framework\TestCase;

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

        $this->assertLessThanOrEqual(6, count($example['chips']));
        $this->assertLessThanOrEqual(5, count($example['bullets']));
        $this->assertStringStartsWith('Not yet recorded:', end($example['bullets']));
        $this->assertNotContains('contactability', array_column($example['chips'], 'id'));
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
