<?php

namespace Tests\Feature\CommunicationActivity;

use App\Jobs\ProcessCommunicationActivityJob;
use App\Jobs\ResolveCommunicationActivityJob;
use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use App\Services\CommunicationActivityResolverService;
use Illuminate\Support\Facades\Bus;
use Tests\CommunicationActivityEmailListenerTestCase;

class EmailListenerAssignmentTest extends CommunicationActivityEmailListenerTestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Bus::fake([ProcessCommunicationActivityJob::class]);
    }

    public function test_new_lead_is_assigned_to_linked_mailbox_employee(): void
    {
        $companyId = $this->seedCompany();
        $userId = $this->seedUser($companyId, 'dm@hibarr.de', 'Dennis Mullokandov');
        $agentId = $this->seedLeadAgent($companyId, $userId);

        $activity = CommunicationActivity::create([
            'company_id' => $companyId,
            'channel_type' => 'email',
            'email' => 'info@zell-immobilien.de',
            'message_content' => 'Inbound partnership inquiry',
            'sender_info' => [
                'name' => 'Dennis Mullokandov',
                'contact' => 'dm@hibarr.de',
            ],
            'first_name' => 'info',
            'last_name' => '',
            'timestamp' => now(),
            'metadata' => ['read_status' => 'unread'],
        ]);

        Lead::withoutEvents(function () use ($activity) {
            app(CommunicationActivityResolverService::class)->resolve($activity);
        });

        $lead = Lead::withoutGlobalScopes()->findOrFail($activity->fresh()->lead_id);

        $this->assertSame($userId, (int) $lead->lead_owner);
        $this->assertSame($agentId, (int) $lead->agent_id);
    }

    public function test_new_deal_is_assigned_to_linked_mailbox_employee(): void
    {
        $companyId = $this->seedCompany();
        $userId = $this->seedUser($companyId, 'dm@hibarr.de', 'Dennis Mullokandov');
        $agentId = $this->seedLeadAgent($companyId, $userId);
        $this->seedPipeline($companyId);

        $activity = CommunicationActivity::create([
            'company_id' => $companyId,
            'channel_type' => 'email',
            'email' => 'info@zell-immobilien.de',
            'message_content' => 'Inbound partnership inquiry',
            'sender_info' => [
                'name' => 'Dennis Mullokandov',
                'contact' => 'dm@hibarr.de',
            ],
            'timestamp' => now(),
            'metadata' => ['direction' => 'inbound'],
        ]);

        Lead::withoutEvents(function () use ($activity) {
            Deal::withoutEvents(function () use ($activity) {
                $job = new ResolveCommunicationActivityJob($activity->id, true);
                $job->handle(app(CommunicationActivityResolverService::class));
            });
        });

        $activity->refresh();
        $deal = Deal::withoutGlobalScopes()->findOrFail($activity->deal_id);

        $this->assertSame($agentId, (int) $deal->agent_id);
        $this->assertNotNull($activity->lead_id);
    }

    public function test_record_stays_unassigned_when_mailbox_has_no_linked_lead_agent(): void
    {
        $companyId = $this->seedCompany();
        $this->seedUser($companyId, 'unknown@hibarr.de', 'Unknown User');

        $activity = CommunicationActivity::create([
            'company_id' => $companyId,
            'channel_type' => 'email',
            'email' => 'client@example.com',
            'message_content' => 'Hello',
            'sender_info' => [
                'name' => 'Unknown User',
                'contact' => 'unknown@hibarr.de',
            ],
            'timestamp' => now(),
            'metadata' => ['direction' => 'inbound'],
        ]);

        Lead::withoutEvents(function () use ($activity) {
            app(CommunicationActivityResolverService::class)->resolve($activity);
        });

        $lead = Lead::withoutGlobalScopes()->findOrFail($activity->fresh()->lead_id);

        $this->assertNull($lead->lead_owner);
        $this->assertNull($lead->agent_id);
    }

    public function test_existing_unassigned_lead_is_assigned_when_matched_by_email(): void
    {
        $companyId = $this->seedCompany();
        $userId = $this->seedUser($companyId, 'dm@hibarr.de', 'Dennis Mullokandov');
        $agentId = $this->seedLeadAgent($companyId, $userId);
        $leadId = $this->seedLead($companyId, 'info@zell-immobilien.de');

        $activity = CommunicationActivity::create([
            'company_id' => $companyId,
            'channel_type' => 'email',
            'email' => 'info@zell-immobilien.de',
            'message_content' => 'Follow-up',
            'sender_info' => [
                'name' => 'Dennis Mullokandov',
                'contact' => 'dm@hibarr.de',
            ],
            'timestamp' => now(),
        ]);

        app(CommunicationActivityResolverService::class)->resolve($activity);

        $lead = Lead::withoutGlobalScopes()->findOrFail($leadId);

        $this->assertSame($leadId, (int) $activity->fresh()->lead_id);
        $this->assertSame($userId, (int) $lead->lead_owner);
        $this->assertSame($agentId, (int) $lead->agent_id);
    }

    public function test_mailbox_resolution_is_scoped_to_activity_company(): void
    {
        $companyOne = $this->seedCompany();
        $companyTwo = $this->seedCompany();

        $userOne = $this->seedUser($companyOne, 'dm@hibarr.de', 'Company One Agent');
        $agentOne = $this->seedLeadAgent($companyOne, $userOne);

        $userTwo = $this->seedUser($companyTwo, 'dm@hibarr.de', 'Company Two Agent');
        $this->seedLeadAgent($companyTwo, $userTwo);

        $activity = CommunicationActivity::create([
            'company_id' => $companyOne,
            'channel_type' => 'email',
            'email' => 'client@example.com',
            'message_content' => 'Hello',
            'sender_info' => [
                'name' => 'Company One Agent',
                'contact' => 'dm@hibarr.de',
            ],
            'timestamp' => now(),
        ]);

        $resolvedAgent = app(CommunicationActivityResolverService::class)
            ->resolveLinkedLeadAgent($activity);

        $this->assertNotNull($resolvedAgent);
        $this->assertSame($agentOne, (int) $resolvedAgent->id);
        $this->assertSame($userOne, (int) $resolvedAgent->user_id);
    }
}
