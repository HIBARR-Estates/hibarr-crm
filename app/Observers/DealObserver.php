<?php

namespace App\Observers;

use App\Events\DealEvent;
use App\Events\DealWonEvent;
use App\Jobs\SendMetaConversionEventJob;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadPipeline;
use App\Models\LeadSetting;
use App\Models\LeadSource;
use App\Models\LeadStatus;
use App\Models\MetaConversionTrigger;
use App\Models\PipelineStage;
use App\Models\Role;
use App\Models\UniversalSearch;
use App\Models\User;
use App\Notifications\LeadAgentAssigned;
use App\Notifications\LeadImported;
use App\Services\CrmEventDescriptionBuilder;
use App\Services\DealAutomationService;
use App\Services\DealNotificationService;
use App\Services\DealTaskService;
use App\Traits\DealHistoryTrait;
use App\Traits\EmployeeActivityTrait;
use App\Traits\HasDynamicTranslations;
use App\Traits\RecordsCrmEvents;
use Illuminate\Support\Facades\Notification;

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
        if (! isRunningInConsoleOrSeeding()) {
            $userID = (! is_null(user())) ? user()->id : null;
            $deal->last_updated_by = $userID;
        }

        $deal->next_follow_up = 'yes';
    }

    public function creating(Deal $deal)
    {
        $deal->hash = md5(microtime());

        if (! isRunningInConsoleOrSeeding()) {

            if (request()->has('added_by')) {
                $deal->added_by = request('added_by');

            } else {

                $userID = (! is_null(user())) ? user()->id : null;
                $deal->added_by = $userID;
            }

            if (company()) {
                $deal->company_id = company()->id;
            }

            if (! isRunningInConsoleOrSeeding()) {
                $categoryId = request()->category_id;

                $ticketSettings = LeadSetting::select('status')->first();

                // Skip round-robin when triage (or the request) already assigned an agent.
                if ($ticketSettings && $ticketSettings->status == 1 && is_null($deal->agent_id)) {
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

                    if (is_null(request()->agent_id) || request()->agent_id === '') {
                        if (! empty($diffAgent)) {
                            $deal->agent_id = current($diffAgent);
                        } else {
                            $agentDuplicateCount = array_count_values($dealData);

                            if (! empty($agentDuplicateCount)) {
                                $minVal = min($agentDuplicateCount);
                                $agent_id = array_search($minVal, $agentDuplicateCount);
                                $deal->agent_id = $agent_id;
                            }
                        }
                    } else {
                        // Prefer lead_agents.id; fall back to legacy user_id lookup.
                        $leadAgent = LeadAgent::find(request()->agent_id)
                            ?: LeadAgent::where('user_id', request()->agent_id)
                                ->where('lead_category_id', $categoryId)
                                ->first();

                        if (! is_null($leadAgent)) {
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
        if ($deal->getOriginal('is_locked') && ! $deal->isDirty('is_locked')) {
            // Allow only is_locked changes (for the locking operation itself)
            // All other changes are blocked
            $changedFields = array_keys($deal->getDirty());
            $allowedFields = ['is_locked', 'locked_at', 'outcome_status', 'updated_at'];
            $disallowedChanges = array_diff($changedFields, $allowedFields);

            if (! empty($disallowedChanges)) {
                \Log::warning("DealObserver: Attempted to modify locked deal {$deal->id}. Blocked fields: ".implode(', ', $disallowedChanges));
                // Revert disallowed changes
                foreach ($disallowedChanges as $field) {
                    $deal->{$field} = $deal->getOriginal($field);
                }
            }
        }

        if ($deal->isDirty('pipeline_stage_id')) {
            self::createDealHistory($deal->id, 'stage-updated', agentId: $deal->agent_id, stageFromId: $deal->getOriginal('pipeline_stage_id'), stageToId: $deal->pipeline_stage_id);
        }

    }

    public function updated(Deal $deal)
    {
        HasDynamicTranslations::dispatchDynamicTranslation($deal, true);

        if (! isRunningInConsoleOrSeeding()) {

            $this->createClient($deal);

            if (user()) {
                self::createEmployeeActivity(user()->id, 'deal-updated', $deal->id, 'deal');
            }

            if (user() && ! $deal->isDirty('pipeline_stage_id') && ! $deal->isDirty('lead_pipeline_id') && ! $deal->isDirty('agent_id')) {
                self::createDealHistory($deal->id, 'deal-updated', agentId: $deal->agent_id);
            }

            if ($deal->isDirty('lead_pipeline_id')) {
                self::createDealHistory($deal->id, 'pipeline-updated', agentId: $deal->agent_id);
            }

            if ($deal->isDirty('agent_id')) {
                event(new DealEvent($deal, $deal->leadAgent, 'LeadAgentAssigned'));
                $this->addParentAgentAsWatcher($deal);

                // Reassignment (not the first-time assignment): notify everyone else who
                // watches this deal. The new agent already gets LeadAgentAssigned above.
                if ($deal->getOriginal('agent_id')) {
                    $fromAgentName = $this->resolveAgentName($deal->getOriginal('agent_id'));
                    $toAgentName = $this->resolveAgentName($deal->agent_id);
                    $this->notificationService->notifyAgentChanged($deal, $fromAgentName, $toAgentName, $deal->leadAgent?->user_id);
                }
            }

            // Only pipeline moves that don't also change stage — stage changes are covered below.
            if ($deal->isDirty('lead_pipeline_id')) {
                $fromPipeline = LeadPipeline::find($deal->getOriginal('lead_pipeline_id'))?->name ?? 'Unknown';
                $toPipeline = LeadPipeline::find($deal->lead_pipeline_id)?->name ?? 'Unknown';
                $this->notificationService->notifyPipelineChanged($deal, $fromPipeline, $toPipeline);
            }

            // Send notification for stage change to watchers and agent
            if ($deal->isDirty('pipeline_stage_id')) {
                $fromStage = PipelineStage::find($deal->getOriginal('pipeline_stage_id'))?->name ?? 'Unknown';
                $toStage = PipelineStage::find($deal->pipeline_stage_id)?->name ?? 'Unknown';
                $this->notificationService->notifyStageChanged($deal, $fromStage, $toStage);

                $toStageModel = PipelineStage::find($deal->pipeline_stage_id);
                if ($toStageModel?->slug === 'win') {
                    $this->notificationService->notifyDealWon($deal);
                } elseif ($toStageModel?->slug === 'lost') {
                    $this->notificationService->notifyDealLost($deal);
                }
            } elseif ($deal->isDirty('outcome_status')) {
                if ($deal->outcome_status === \App\Enums\OutcomeStatus::Won) {
                    $this->notificationService->notifyDealWon($deal);
                } elseif ($deal->outcome_status === \App\Enums\OutcomeStatus::Lost) {
                    $this->notificationService->notifyDealLost($deal);
                }
            }

            // Meta Conversions API trigger
            if ($deal->isDirty('pipeline_stage_id')) {
                $this->triggerMetaConversionEvent($deal);
            }

            // MLM: Fire DealWonEvent when outcome_status changes to 'won'
            if ($deal->isDirty('outcome_status') && $deal->outcome_status === \App\Enums\OutcomeStatus::Won && ! $deal->is_locked) {
                $this->fireDealWonEvent($deal);
            }

            // ── CRM Events for specific deal changes ──
            $trackedDirtyFields = [];

            if ($deal->isDirty('pipeline_stage_id')) {
                $trackedDirtyFields[] = 'pipeline_stage_id';
                $fromStage = PipelineStage::find($deal->getOriginal('pipeline_stage_id'));
                $toStage = PipelineStage::find($deal->pipeline_stage_id);
                $this->recordCrmEvent('deal_stage_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealStageChanged($fromStage->name ?? null, $toStage->name ?? null),
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
                        'metadata' => [
                            'comment' => 'Deal closed as won',
                            'value' => $deal->value,
                            'currency_id' => $deal->currency_id,
                        ],
                    ]);
                } elseif ($toStage && $toStage->slug === 'lost') {
                    $this->recordCrmEvent('deal_closed_lost', $deal, [
                        'status' => 'completed',
                        'metadata' => [
                            'comment' => 'Deal closed as lost',
                            'value' => $deal->value,
                            'currency_id' => $deal->currency_id,
                        ],
                    ]);
                }
            }

            if ($deal->isDirty('lead_pipeline_id')) {
                $trackedDirtyFields[] = 'lead_pipeline_id';
                $fromPipeline = LeadPipeline::find($deal->getOriginal('lead_pipeline_id'));
                $toPipeline = LeadPipeline::find($deal->lead_pipeline_id);

                $this->recordCrmEvent('deal_pipeline_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealPipelineChanged($fromPipeline->name ?? null, $toPipeline->name ?? null),
                        'from_pipeline_id' => $deal->getOriginal('lead_pipeline_id'),
                        'to_pipeline_id' => $deal->lead_pipeline_id,
                        'from_pipeline_name' => $fromPipeline->name ?? null,
                        'to_pipeline_name' => $toPipeline->name ?? null,
                    ],
                ]);
            }

            if ($deal->isDirty('agent_id')) {
                $trackedDirtyFields[] = 'agent_id';
                $fromAgentName = $this->resolveAgentName($deal->getOriginal('agent_id'));
                $toAgentName = $this->resolveAgentName($deal->agent_id);

                $this->recordCrmEvent('deal_agent_assigned', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealAgentAssigned($fromAgentName, $toAgentName),
                        'from_agent_id' => $deal->getOriginal('agent_id'),
                        'to_agent_id' => $deal->agent_id,
                        'from_agent_name' => $fromAgentName,
                        'to_agent_name' => $toAgentName,
                    ],
                ]);
            }

            if (
                $deal->isDirty('value') ||
                $deal->isDirty('currency_id') ||
                $deal->isDirty('manual_value') ||
                $deal->isDirty('calculated_value') ||
                $deal->isDirty('value_source')
            ) {
                $trackedDirtyFields[] = 'value';
                $trackedDirtyFields[] = 'currency_id';
                $trackedDirtyFields[] = 'manual_value';
                $trackedDirtyFields[] = 'calculated_value';
                $trackedDirtyFields[] = 'value_source';

                $oldValue = $deal->getOriginal('value');
                $newValue = $deal->value;
                $oldCurrencyId = $deal->getOriginal('currency_id');
                $newCurrencyId = $deal->currency_id;

                $isInternalValueRecalc =
                    ! $deal->isDirty('value') &&
                    (
                        $deal->isDirty('manual_value') ||
                        $deal->isDirty('value_source') ||
                        $deal->isDirty('calculated_value')
                    );

                // Skip intermediate recalculation saves that only update manual/calculated value state
                if (! $isInternalValueRecalc && ($oldValue != $newValue || $oldCurrencyId !== $newCurrencyId)) {
                    $this->recordCrmEvent('deal_value_updated', $deal, [
                        'metadata' => [
                            'comment' => CrmEventDescriptionBuilder::dealValueUpdated(
                                $oldValue,
                                $newValue,
                                $newCurrencyId ?? $oldCurrencyId
                            ),
                            'old_value' => $oldValue,
                            'new_value' => $newValue,
                            'old_currency_id' => $oldCurrencyId,
                            'currency_id' => $newCurrencyId,
                        ],
                    ]);
                }
            }

            if ($deal->isDirty('name')) {
                $trackedDirtyFields[] = 'name';

                $this->recordCrmEvent('deal_title_renamed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealTitleRenamed($deal->getOriginal('name'), $deal->name),
                        'old_title' => $deal->getOriginal('name'),
                        'new_title' => $deal->name,
                    ],
                ]);
            }

            if ($deal->isDirty('close_date')) {
                $trackedDirtyFields[] = 'close_date';

                $this->recordCrmEvent('deal_close_date_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealCloseDateChanged(
                            $deal->getOriginal('close_date'),
                            $deal->close_date
                        ),
                        'old_close_date' => $deal->getOriginal('close_date'),
                        'new_close_date' => $deal->close_date,
                    ],
                ]);
            }

            if ($deal->isDirty('status_id')) {
                $trackedDirtyFields[] = 'status_id';

                $fromStatusName = $this->resolveStatusName($deal->getOriginal('status_id'));
                $toStatusName = $this->resolveStatusName($deal->status_id);

                $this->recordCrmEvent('deal_status_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealStatusChanged($fromStatusName, $toStatusName),
                        'old_status_id' => $deal->getOriginal('status_id'),
                        'status_id' => $deal->status_id,
                        'old_status_name' => $fromStatusName,
                        'status_name' => $toStatusName,
                    ],
                ]);
            }

            if ($deal->isDirty('client_id')) {
                $trackedDirtyFields[] = 'client_id';

                $fromClientName = $this->resolveClientName($deal->getOriginal('client_id'));
                $toClientName = $this->resolveClientName($deal->client_id);

                $this->recordCrmEvent('deal_client_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealClientChanged($fromClientName, $toClientName),
                        'old_client_id' => $deal->getOriginal('client_id'),
                        'client_id' => $deal->client_id,
                        'old_client_name' => $fromClientName,
                        'client_name' => $toClientName,
                    ],
                ]);
            }

            if ($deal->isDirty('source_id')) {
                $trackedDirtyFields[] = 'source_id';

                $fromSourceName = $this->resolveSourceName($deal->getOriginal('source_id'));
                $toSourceName = $this->resolveSourceName($deal->source_id);

                $this->recordCrmEvent('deal_source_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealSourceChanged($fromSourceName, $toSourceName),
                        'old_source_id' => $deal->getOriginal('source_id'),
                        'source_id' => $deal->source_id,
                        'old_source_name' => $fromSourceName,
                        'source_name' => $toSourceName,
                    ],
                ]);
            }

            if ($deal->isDirty('outcome_status')) {
                $trackedDirtyFields[] = 'outcome_status';

                $this->recordCrmEvent('deal_outcome_changed', $deal, [
                    'metadata' => [
                        'comment' => CrmEventDescriptionBuilder::dealOutcomeChanged(
                            $deal->getOriginal('outcome_status'),
                            $deal->outcome_status
                        ),
                        'old_outcome_status' => $deal->getOriginal('outcome_status'),
                        'outcome_status' => $deal->outcome_status,
                    ],
                ]);
            }

            // Generic deal_updated only for non-tracked field changes.
            $remainingChangedFields = array_values(array_diff(
                array_keys($deal->getDirty()),
                array_unique($trackedDirtyFields)
            ));

            if (! empty($remainingChangedFields)) {
                $this->recordCrmEvent('deal_updated', $deal, [
                    'metadata' => [
                        'comment' => 'Deal details updated',
                        'changed_fields' => $remainingChangedFields,
                    ],
                ]);
            }
        }
        // deal automation trigger
        if (! $deal->is_locked) {
            $this->dealAutomation->process($deal, 'deal_updated');
        }

    }

    public function created(Deal $deal)
    {
        HasDynamicTranslations::dispatchDynamicTranslation($deal, false);

        if (! isRunningInConsoleOrSeeding()) {
            if (user()) {
                self::createEmployeeActivity(user()->id, 'deal-created', $deal->id, 'deal');
            }

            if (! session()->has('is_deal')) {

                if (! session()->has('is_imported') && ! session()->has('create_deal_with_lead')) {

                    if (request('agent_id') != '') {

                        event(new DealEvent($deal, $deal->leadAgent, 'LeadAgentAssigned'));
                        self::createDealHistory($deal->id, 'agent-assigned', agentId: $deal->agent_id);

                    } else {

                        Notification::send(User::allAdmins($deal->company->id), new LeadAgentAssigned($deal));
                    }
                } elseif (session()->has('is_imported')) {

                    if (session('leads_count') == session('total_leads')) {

                        $admins = User::allAdmins(company()->id);
                        $importedLeads = session('leads', []);
                        Notification::send($admins, new LeadImported([
                            'importedByName' => user()?->name ?? '',
                            'importCount' => count($importedLeads),
                            'failedCount' => max(0, (int) session('total_leads', 0) - count($importedLeads)),
                            'sourceName' => 'CSV Import',
                            'importedAt' => now()->format(company()->date_format),
                        ]));
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
        // deal automation trigger
        $this->dealAutomation->process($deal, 'deal_created');

        // ── CRM Event: deal_created ──
        $this->recordCrmEvent('deal_created', $deal, [
            'metadata' => [
                'comment' => 'Deal created'.($deal->agent_id ? ' with agent assigned' : ''),
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

        if (! isRunningInConsoleOrSeeding()) {
            $deal->loadMissing(['leadAgent.user', 'dealWatchers', 'company']);
            $this->notificationService->notifyDealDeleted($deal, user());
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

    private function createClient($deal)
    {

        $stage = PipelineStage::where('company_id', company()->id)->where('slug', 'win')->first();

        if ($deal->create_client == 1 && $deal->pipeline_stage_id == $stage?->id) {

            $lead = Lead::where('id', $deal->lead_id)->first();
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

            if (! $agent) {
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

    private function resolveAgentName(?int $agentId): ?string
    {
        if (! $agentId) {
            return null;
        }

        $agent = LeadAgent::with('user')->find($agentId);

        return $agent?->user?->name;
    }

    private function resolveStatusName(?int $statusId): ?string
    {
        if (! $statusId) {
            return null;
        }

        return LeadStatus::find($statusId)?->type;
    }

    private function resolveSourceName(?int $sourceId): ?string
    {
        if (! $sourceId) {
            return null;
        }

        return LeadSource::find($sourceId)?->type;
    }

    private function resolveClientName(?int $clientId): ?string
    {
        if (! $clientId) {
            return null;
        }

        return User::find($clientId)?->name;
    }
}
