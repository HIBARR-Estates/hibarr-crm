<?php

namespace Tests\Unit\EntitySummary;

use App\Models\Deal;
use App\Services\EntitySummary\EntitySummaryPromptLoader;
use App\Services\EntitySummary\EntitySummaryValidator;
use Tests\TestCase;

class EntitySummaryValidatorTest extends TestCase
{
    public function test_validates_lead_summary_shape(): void
    {
        $payload = [
            'status_line' => 'Lead is healthy.',
            'risk_level' => 'low',
            'primary_risk_source' => 'lead',
            'chips' => [
                [
                    'id' => 'contactability',
                    'label' => 'Contactability',
                    'value' => 'Reachable',
                    'tone' => 'green',
                    'sublabel' => 'Email on file',
                ],
            ],
            'bullets' => ['One bullet'],
            'next_step' => [
                'action_type' => 'CONTACT_LEAD',
                'target_deal_id' => null,
                'label' => 'Contact lead',
                'rationale' => 'No contact yet.',
                'urgency' => 'this_week',
            ],
            'meta' => [
                'generated_at' => '2026-07-01T14:04:00Z',
                'data_confidence' => 'high',
            ],
        ];

        app(EntitySummaryValidator::class)->validateLeadSummary($payload);

        $this->assertTrue(true);
    }

    public function test_validates_deal_summary_shape(): void
    {
        $payload = [
            'status_line' => 'Deal is progressing.',
            'risk_level' => 'medium',
            'chips' => [
                [
                    'id' => 'momentum',
                    'label' => 'Momentum',
                    'value' => 'Slowing',
                    'tone' => 'amber',
                    'sublabel' => 'No recent activity',
                ],
            ],
            'bullets' => ['One bullet'],
            'next_step' => [
                'action_type' => 'CREATE_TASK',
                'label' => 'Create follow-up task',
                'rationale' => 'No tasks scheduled.',
                'urgency' => 'this_week',
            ],
            'meta' => [
                'generated_at' => '2026-07-01T14:04:00Z',
                'data_confidence' => 'high',
            ],
        ];

        app(EntitySummaryValidator::class)->validateDealSummary($payload);

        $this->assertTrue(true);
    }

    public function test_to_lead_consumer_shape_extracts_deal_fields(): void
    {
        $deal = new Deal([
            'id' => 42,
            'name' => 'Test Deal',
            'value' => 100000,
        ]);

        $shape = app(EntitySummaryValidator::class)->toLeadConsumerShape([
            'risk_level' => 'high',
            'status_line' => 'Stalled deal.',
            'next_step' => [
                'action_type' => 'CREATE_TASK',
                'label' => 'Call client',
                'rationale' => 'Follow up needed.',
                'urgency' => 'immediate',
            ],
        ], $deal);

        $this->assertSame('42', $shape['deal_id']);
        $this->assertSame('Test Deal', $shape['deal_name']);
        $this->assertSame('high', $shape['risk_level']);
        $this->assertSame('Call client', $shape['next_step_label']);
    }

    public function test_loads_lead_summary_prompt_from_markdown(): void
    {
        $prompt = app(EntitySummaryPromptLoader::class)->loadLeadSummaryPrompt();

        $this->assertStringContainsString('Lead Summary agent', $prompt);
        $this->assertStringContainsString('OUTPUT', $prompt);
    }
}
