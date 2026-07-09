<?php

namespace Tests\Unit\OlWebhook;

use App\Enums\OutcomeStatus;
use App\Models\CrmEvent;
use App\Models\CrmEventType;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadCategory;
use App\Models\LeadLifecycleStatus;
use App\Models\PipelineStage;
use App\Models\User;
use App\Services\OlWebhook\OlPayloadMapper;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class OlPayloadMapperTest extends TestCase
{
    public function test_it_maps_lead_payload_with_required_subset(): void
    {
        $lead = new Lead([
            'id' => 10,
            'client_name' => 'Jane Doe',
            'client_email' => 'jane@example.com',
            'mobile' => '{"phone":"+44 7000000000","country_code":"44","country_identifier":"gb"}',
        ]);
        $lead->setRelation('leadOwner', (new User())->forceFill(['id' => 7, 'name' => 'Owner Name']));
        $lead->setRelation('category', (new LeadCategory())->forceFill(['id' => 3, 'category_name' => 'Hot']));
        $lead->setRelation('lifecycleStatus', (new LeadLifecycleStatus())->forceFill(['id' => 2, 'key' => 'qualified']));

        $event = new CrmEvent([
            'uuid' => '11111111-1111-1111-1111-111111111111',
            'model_id' => 10,
            'correlation_id' => '22222222-2222-2222-2222-222222222222',
            'occurred_at' => Carbon::parse('2026-07-07 09:00:00'),
        ]);
        $event->setRelation('eventType', new CrmEventType(['slug' => 'lead_created']));
        $event->setRelation('model', $lead);

        $payload = (new OlPayloadMapper())->map($event);

        $this->assertSame('lead', $payload['entityType']);
        $this->assertSame('Jane', $payload['entityData']['firstName']);
        $this->assertSame('Doe', $payload['entityData']['lastName']);
        $this->assertSame('jane@example.com', $payload['entityData']['email']);
        $this->assertSame('qualified', $payload['entityData']['status']);
        $this->assertSame(7, $payload['entityData']['assignedTo']['id']);
        $this->assertSame('Hot', $payload['entityData']['category']['name']);
        $this->assertSame('lead_created', $payload['eventType']);
    }

    public function test_it_maps_deal_payload_with_required_subset(): void
    {
        $agent = (new LeadAgent())->forceFill(['id' => 19]);
        $agent->setRelation('user', (new User())->forceFill(['id' => 8, 'name' => 'Agent Name']));

        $deal = new Deal([
            'id' => 20,
            'name' => 'Deal Title',
            'value' => 150000,
            'pipeline_stage_id' => 6,
            'status_id' => 4,
            'outcome_status' => OutcomeStatus::Won,
        ]);
        $deal->setRelation('leadStage', (new PipelineStage())->forceFill(['id' => 6, 'name' => 'Negotiation']));
        $deal->setRelation('leadAgent', $agent);

        $event = new CrmEvent([
            'uuid' => '33333333-3333-3333-3333-333333333333',
            'model_id' => 20,
            'correlation_id' => '44444444-4444-4444-4444-444444444444',
            'occurred_at' => Carbon::parse('2026-07-07 09:05:00'),
        ]);
        $event->setRelation('eventType', new CrmEventType(['slug' => 'deal_updated']));
        $event->setRelation('model', $deal);

        $payload = (new OlPayloadMapper())->map($event);

        $this->assertSame('deal', $payload['entityType']);
        $this->assertSame('Deal Title', $payload['entityData']['title']);
        $this->assertSame(150000, $payload['entityData']['value']);
        $this->assertSame('Negotiation', $payload['entityData']['stage']);
        $this->assertSame('won', $payload['entityData']['status']);
        $this->assertSame(8, $payload['entityData']['assignedTo']['id']);
        $this->assertSame('deal_updated', $payload['eventType']);
    }
}

