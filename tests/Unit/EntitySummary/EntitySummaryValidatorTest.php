<?php

namespace Tests\Unit\EntitySummary;

use App\Exceptions\EntityAiSummaryGenerationException;
use App\Models\Deal;
use App\Services\EntitySummary\EntitySummaryValidator;
use PHPUnit\Framework\TestCase;

class EntitySummaryValidatorTest extends TestCase
{
    public function test_validates_lead_summary_shape(): void
    {
        (new EntitySummaryValidator())->validateLeadSummary([
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
        ]);

        $this->assertTrue(true);
    }

    public function test_validates_deal_summary_shape(): void
    {
        (new EntitySummaryValidator())->validateDealSummary([
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
        ]);

        $this->assertTrue(true);
    }

    public function test_rejects_invalid_deal_action_type(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new EntitySummaryValidator())->validateDealSummary([
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
                'action_type' => 'CONTACT_LEAD',
                'label' => 'Bad action for deal',
                'rationale' => 'Wrong taxonomy',
                'urgency' => 'this_week',
            ],
            'meta' => [
                'generated_at' => '2026-07-01T14:04:00Z',
                'data_confidence' => 'high',
            ],
        ]);
    }

    public function test_rejects_missing_meta_generated_at(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        (new EntitySummaryValidator())->validateDealSummary([
            'status_line' => 'Deal is progressing.',
            'risk_level' => 'low',
            'chips' => [
                [
                    'id' => 'momentum',
                    'label' => 'Momentum',
                    'value' => 'On track',
                    'tone' => 'green',
                    'sublabel' => 'ok',
                ],
            ],
            'bullets' => [],
            'next_step' => [
                'action_type' => 'NO_ACTION_NEEDED',
                'label' => 'No action needed',
                'rationale' => 'Fine',
                'urgency' => 'routine',
            ],
            'meta' => [
                'data_confidence' => 'high',
            ],
        ]);
    }

    public function test_to_lead_consumer_shape_extracts_deal_fields(): void
    {
        $deal = $this->createMock(Deal::class);
        $deal->method('__get')->willReturnMap([
            ['id', 42],
            ['name', 'Test Deal'],
            ['value', 100000],
            ['leadStage', null],
            ['currency', null],
        ]);
        $deal->id = 42;
        $deal->name = 'Test Deal';
        $deal->value = 100000;

        $shape = (new EntitySummaryValidator())->toLeadConsumerShape([
            'risk_level' => 'high',
            'status_line' => 'Stalled deal.',
            'next_step' => [
                'action_type' => 'CREATE_TASK',
                'label' => 'Call client',
                'rationale' => 'Follow up needed.',
                'urgency' => 'immediate',
            ],
            'meta' => [
                'is_stale' => true,
                'source' => 'ai',
            ],
        ], $deal);

        $this->assertSame('42', $shape['deal_id']);
        $this->assertSame('Test Deal', $shape['deal_name']);
        $this->assertSame('high', $shape['risk_level']);
        $this->assertSame('Call client', $shape['next_step_label']);
        $this->assertTrue($shape['is_stale']);
    }

    public function test_generation_exception_preserves_existing_summary(): void
    {
        $existing = ['status_line' => 'Kept', 'meta' => ['source' => 'ai']];
        $e = new EntityAiSummaryGenerationException('failed', $existing, 503);

        $this->assertSame(503, $e->getCode());
        $this->assertSame($existing, $e->existingSummary());
    }
}
