<?php

namespace App\Observers;

use App\Events\DealEvent;
use App\Events\DealWonEvent;
use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\UniversalSearch;
use App\Models\User;
use App\Models\Role;
use App\Models\Lead;
use App\Models\PipelineStage;
use App\Notifications\LeadAgentAssigned;
use App\Models\LeadSetting;
use Illuminate\Support\Facades\Notification;
use App\Traits\EmployeeActivityTrait;
use App\Notifications\LeadImported;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Services\DealTaskService;
use App\Models\MetaConversionTrigger;
use App\Jobs\SendMetaConversionEventJob;

use App\Traits\DealHistoryTrait;
use App\Traits\RecordsCrmEvents;

class DealObserver
{
    use DealHistoryTrait;
    use EmployeeActivityTrait;
    use RecordsCrmEvents;

    protected DealAutomationService $dealAutomation;
    protected DealNotificationService $notificationService;
    protected DealTaskService $dealTaskService;

    public function __construct(
        DealAutomationService $dealAutomation,
        DealNotificationService $notificationService,
        DealTaskService $dealTaskService
    ) {
        $this->dealAutomation = $dealAutomation;
        $this->notificationService = $notificationService;
        $this->dealTaskService = $dealTaskService;
    }

    public function saving(Deal $deal)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $userID = (!is_null(user())) ? user()->id : null;
            $deal->last_updated_by = $userID;
        }

        $deal->next_follow_up = 'yes';
    }

    public function creating(Deal $deal)
    {
        $deal->hash = md5(microtime());

        if (!isRunningInConsoleOrSeeding()) {


            if (request()->has('added_by')) {
                $deal->added_by = request('added_by');


            }
            else {

                $userID = (!is_null(user())) ? user()->id : null;
                $deal->added_by = $userID;
            }

            if (company()) {
                $deal->company_id = company()->id;
            }

            if (!isRunningInConsoleOrSeeding()) {
                $categoryId = request()->category_id;

                $ticketSettings = LeadSetting::select('status')->first();

                if ($ticketSettings && $ticketSettings->status == 1) {
                    $agentCategoryData = LeadAgent::where('company_id', $deal->company_id)
                    ->where('status', 'enabled')
                    ->where('lead_category_id', $categoryId)
                    ->pluck('id')
                    ->toArray();

                    $dealData = $deal->where('company_id', $deal->company_id)
                        ->where('category_id', $categoryId)
                        ->whereIn('agent_id', $agentCategoryData)
                        ->whereNotNull('agent_id')
                        ->pluck('agent_id')
                        ->toArray();

                    $diffAgent = array_diff($agentCategoryData, $dealData);

                    if (is_null(request()->agent_id)) {
                        if (!empty($diffAgent)) {
                            $deal->agent_id = current($diffAgent);
                        }
                        else {
                            $agentDuplicateCount = array_count_values($dealData);

                            if (!empty($agentDuplicateCount)) {
                                $minVal = min($agentDuplicateCount);
                                $agent_id = array_search($minVal, $agentDuplicateCount);
                                $deal->agent_id = $agent_id;
                            }
                        }
                    }
                    else {
                        $leadAgent = LeadAgent::where('user_id', request()->agent_id)->where('lead_category_id', $categoryId)->first();
                        if(!is_null($leadAgent))
                        {
                            $deal->agent_id = $leadAgent->id;
                        }
                    }
                }
            }
        }
    }

    public function updating(Deal $deal)
    {
        // Prevent modifications to locked deals
        if ($deal->getOriginal('is_locked') && !$deal->isDirty('is_locked')) {
            // Allow only is_locked changes (for the locking operation itself)
            // All other changes are blocked
            $changedFields = array_keys($deal->getDirty());
            $allowedFields = ['is_locked', 'locked_at', 'outcome_status', 'updated_at'];
            $disallowedChanges = array_diff($changedFields, $allowedFields);

            if (!empty($disallowedChanges)) {
                \Log::warning("DealObserver: Attempted to modify locked deal {$deal->id}. Blocked fields: " . implode(', ', $disallowedChanges));
                // Revert disallowed changes
                foreach ($disallowedChanges as $field) {
                    $deal->{$field} = $deal->getOriginal($field);
                }
            }
        }

        if ($deal->isDirty('pipeline_stage_id')){
            self::createDealHistory($deal->id, 'stage-updated', agentId: $deal->agent_id, stageFromId: $deal->getOriginal('pipeline_stage_id'), stageToId: $deal->pipeline_stage_id);
        }

    }

    public function updated(Deal $deal)
    {
        if (!isRunningInConsoleOrSeeding()) {

            $this->createClient($deal);

            if (user()) {
                self::createEmployeeActivity(user()->id, 'deal-updated', $deal->id, 'deal');
            }

            if (user() && !$deal->isDirty('pipeline_stage_id') && !$deal->isDirty('lead_pipeline_id') && !$deal->isDirty('agent_id')) {
                self::createDealHistory($deal->id, 'deal-updated', agentId: $deal->agent_id);
            }

            if ($deal->isDirty('lead_pipeline_id')){
                self::createDealHistory($deal->id, 'pipeline-updated', agentId: $deal->agent_id);
            }

            if ($deal->isDirty('agent_id')) {
                event(new DealEvent($deal, $deal->leadAgent, 'LeadAgentAssigned'));
                $this->addParentAgentAsWatcher($deal);
            }

            if ($deal->isDirty('pipeline_stage_id') || $deal->isDirty('lead_pipeline_id')) {
                event(new DealEvent($deal, $deal->leadAgent, 'StageUpdated'));
            }

            // Send notification for stage change to watchers and agent
            if ($deal->isDirty('pipeline_stage_id')) {
                $fromStage = PipelineStage::find($deal->getOriginal('pipeline_stage_id'))?->name ?? 'Unknown';
                $toStage = PipelineStage::find($deal->pipeline_stage_id)?->name ?? 'Unknown';
                $this->notificationService->notifyStageChanged($deal, $fromStage, $toStage);
            }

            // Meta Conversions API trigger
            if ($deal->isDirty('pipeline_stage_id')) {
                $this->triggerMetaConversionEvent($deal);
            }

            // MLM: Fire DealWonEvent when outcome_status changes to 'won'
            if ($deal->isDirty('outcome_status') && $deal->outcome_status === \App\Enums\OutcomeStatus::Won && !$deal->is_locked) {
                $this->fireDealWonEvent($deal);
            }

            // ── CRM Events for specific deal changes ──
            if ($deal->isDirty('pipeline_stage_id')) {
                $fromStage = PipelineStage::find($deal->getOriginal('pipeline_stage_id'));
                $toStage = PipelineStage::find($deal->pipeline_stage_id);
                $this->recordCrmEvent('deal_stage_changed', $deal, [
                    'metadata' => [
                        'comment' => 'Stage changed from ' . ($fromStage->name ?? 'Unknown') . ' to ' . ($toStage->name ?? 'Unknown'),
                        'from_stage_id' => $deal->getOriginal('pipeline_stage_id'),
                        'to_stage_id' => $deal->pipeline_stage_id,
                        'from_stage_name' => $fromStage->name ?? null,
                        'to_stage_name' => $toStage->name ?? null,
                    ],
                ]);

                // Check for closed won / closed lost based on stage slug
                if ($toStage && $toStage->slug === 'win') {
                    $this->recordCrmEvent('deal_closed_won', $deal, [
                        'status' => 'completed',
                        'metadata' => ['comment' => 'Deal closed as won'],
                    ]);
                } elseif ($toStage && $toStage->slug === 'lost') {
                    $this->recordCrmEvent('deal_closed_lost', $deal, [
                        'status' => 'completed',
                        'metadata' => ['comment' => 'Deal closed as lost'],
                    ]);
                }
            }

            if ($deal->isDirty('lead_pipeline_id')) {
                $this->recordCrmEvent('deal_pipeline_changed', $deal, [
                    'metadata' => [
                        'comment' => 'Deal moved to different pipeline',
                        'from_pipeline_id' => $deal->getOriginal('lead_pipeline_id'),
                        'to_pipeline_id' => $deal->lead_pipeline_id,
                    ],
                ]);
            }

            if ($deal->isDirty('agent_id')) {
                $this->recordCrmEvent('deal_agent_assigned', $deal, [
                    'metadata' => [
                        'comment' => 'Agent reassigned on deal',
                        'from_agent_id' => $deal->getOriginal('agent_id'),
                        'to_agent_id' => $deal->agent_id,
                    ],
                ]);
            }

            // Generic deal_updated for all other field changes
            if (!$deal->isDirty('pipeline_stage_id') && !$deal->isDirty('lead_pipeline_id') && !$deal->isDirty('agent_id')) {
                $this->recordCrmEvent('deal_updated', $deal, [
                    'metadata' => [
                        'comment' => 'Deal details updated',
                        'changed_fields' => array_keys($deal->getDirty()),
                    ],
                ]);
            }
        }
        //deal automation trigger
        if (!$deal->is_locked) {
            $this->dealAutomation->process($deal, 'deal_updated');
        }
        
    }

    public function created(Deal $deal)
    {

        if (!isRunningInConsoleOrSeeding()) {
            if (user()) {
                self::createEmployeeActivity(user()->id, 'deal-created', $deal->id, 'deal');
            }

            if(!session()->has('is_deal')){

                if (!session()->has('is_imported') && !session()->has('create_deal_with_lead')) {

                    if (request('agent_id') != '') {

                        event(new DealEvent($deal, $deal->leadAgent, 'LeadAgentAssigned'));
                        self::createDealHistory($deal->id, 'agent-assigned', agentId: $deal->agent_id);

                    }
                    else {

                        Notification::send(User::allAdmins($deal->company->id), new LeadAgentAssigned($deal));
                    }
                }else if(session()->has('is_imported')){

                    if (session('leads_count') == session('total_leads')) {



                        $admins = User::allAdmins(company()->id);
                        Notification::send($admins, new LeadImported());
                    }

                }
            }

            $this->createClient($deal);

            // Add parent agent as watcher when deal is created with an agent
            if ($deal->agent_id) {
                $this->addParentAgentAsWatcher($deal);
            }

            // Meta Conversions API trigger for new deals
            if ($deal->pipeline_stage_id) {
                $this->triggerMetaConversionEvent($deal);
            }

            // Note: Default task creation disabled - tasks should be created manually
            // $this->dealTaskService->createDefaultTasks($deal);
        }
        //deal automation trigger
        $this->dealAutomation->process($deal, 'deal_created');

        // ── CRM Event: deal_created ──
        $this->recordCrmEvent('deal_created', $deal, [
            'metadata' => [
                'comment' => 'Deal created' . ($deal->agent_id ? ' with agent assigned' : ''),
                'pipeline_stage_id' => $deal->pipeline_stage_id,
                'lead_pipeline_id' => $deal->lead_pipeline_id,
            ],
        ]);
    }

    public function deleting(Deal $deal)
    {
        if ($deal->isLocked()) {
            return false;
        }

        $notifyData = ['App\Notifications\LeadAgentAssigned'];
        \App\Models\Notification::deleteNotification($notifyData, $deal->id);

    }

    public function deleted(Deal $deal)
    {
        UniversalSearch::where('searchable_id', $deal->id)->where('module_type', 'lead')->delete();

        if (user()) {
            self::createEmployeeActivity(user()->id, 'deal-deleted');
        }
    }

    private function createClient($deal){

        $stage = PipelineStage::where('company_id', company()->id)->where('slug', 'win')->first();

        if($deal->create_client == 1 && $deal->pipeline_stage_id == $stage?->id) {

            $lead = Lead::where('id',$deal->lead_id)->first();
            if ($lead->client_id) {
                return;
            }

            $data = [
                'salutation' => $lead->salutation,
                'name' => $lead->client_name,
                'email_notifications' => 1,
                'login' => 'disable',
                'email' => $lead->client_email,
                'company_name' => $lead->company_name,
                'website' => $lead->website,
                'added_by' => user()->id,
                'company_id' => company()->id,
                'address' => $lead->address,
            ];

            $user = User::create($data);
            $user->clientDetails()->create($data);
            $client_id = $user->id;

            $role = Role::where('name', 'client')->select('id')->first();
            $user->attachRole($role->id);
            $user->assignUserRolePermission($role->id);

            $lead->client_id = $client_id;
            $lead->save();

        }
    }

    /**
     * Trigger Meta Conversion Event when deal moves to a configured stage
     *
     * @param Deal $deal
     * @return void
     */
    private function triggerMetaConversionEvent(Deal $deal): void
    {
        try {
            // Query for active trigger matching the new stage and pipeline
            $trigger = MetaConversionTrigger::where('lead_pipeline_id', $deal->lead_pipeline_id)
                ->where('lead_pipeline_stage_id', $deal->pipeline_stage_id)
                ->where('company_id', $deal->company_id)
                ->active()
                ->first();

            if ($trigger) {
                // Dispatch job to send Meta conversion event with the trigger's value
                SendMetaConversionEventJob::dispatch($deal, $trigger->event_name, $trigger->value);

                \Log::info('Meta Conversion Event Job dispatched', [
                    'deal_id' => $deal->id,
                    'event_name' => $trigger->event_name,
                    'value' => $trigger->value,
                    'pipeline_id' => $deal->lead_pipeline_id,
                    'stage_id' => $deal->pipeline_stage_id,
                ]);
            }
        } catch (\Exception $e) {
            // Log error but don't block deal update
            \Log::error('Failed to trigger Meta Conversion Event', [
                'deal_id' => $deal->id,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Fire DealWonEvent when outcome_status is set to won.
     * Triggered by automation setting outcome_status = 'won', not by pipeline stage.
     */
    private function fireDealWonEvent(Deal $deal): void
    {
        try {
            $agent = $deal->leadAgent;

            if ($agent) {
                event(new DealWonEvent($deal, $agent));

                \Log::info('DealWonEvent fired', [
                    'deal_id' => $deal->id,
                    'agent_id' => $agent->id,
                ]);
            } else {
                \Log::warning('DealWonEvent not fired: no agent assigned', [
                    'deal_id' => $deal->id,
                ]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to fire DealWonEvent', [
                'deal_id' => $deal->id,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Add the assigned agent's parent agent as a watcher on the deal.
     */
    private function addParentAgentAsWatcher(Deal $deal): void
    {
        try {
            $agent = $deal->leadAgent;

            if (!$agent) {
                return;
            }

            $parentAgent = $agent->parentAgent;

            if ($parentAgent && $parentAgent->user_id) {
                $deal->dealWatchers()->syncWithoutDetaching([$parentAgent->user_id]);
            }
        } catch (\Exception $e) {
            \Log::error('Failed to add parent agent as deal watcher', [
                'deal_id' => $deal->id,
                'agent_id' => $deal->agent_id,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}

