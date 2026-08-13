<?php

namespace App\Observers;

use App\Events\LeadEvent;
use App\Models\Lead;
use App\Models\LeadLifecycleStatus;
use App\Models\UniversalSearch;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\DB;
use App\Notifications\LeadImported;
use App\Notifications\LeadOwnerAssigned;
use App\Traits\HasDynamicTranslations;
use App\Traits\RecordsCrmEvents;
use App\Services\LeadLifecycleStatusService;


class LeadObserver
{
    use RecordsCrmEvents;

    public function saving(Lead $lead)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $userID = (!is_null(user())) ? user()->id : null;
            $lead->last_updated_by = $userID;
        }

        // Stamp the assignment clock whenever the lead lands on an owner. Set in
        // saving() (not updated()) so it persists in the same write.
        if ($lead->isDirty('lead_owner') && $lead->lead_owner) {
            $lead->assigned_at = now();
        }

    }

    public function creating(Lead $leadContact)
    {
        $leadContact->hash = md5(microtime());

        if (!isRunningInConsoleOrSeeding()) {
            if (request()->has('added_by')) {
                $leadContact->added_by = request('added_by');

            }
            else {
                $userID = (!is_null(user())) ? user()->id : null;
                $leadContact->added_by = $userID;
            }
        }

        if (company()) {
            $leadContact->company_id = company()->id;
        }

        if (!$leadContact->lead_lifecycle_status_id && $leadContact->company_id) {
            $defaultStatus = app(LeadLifecycleStatusService::class)
                ->resolveDefaultForCompany((int) $leadContact->company_id);

            if ($defaultStatus) {
                $leadContact->lead_lifecycle_status_id = $defaultStatus->id;
            }
        }
    }

    public function created(Lead $leadContact)
    {
        HasDynamicTranslations::dispatchDynamicTranslation($leadContact, false);

        if (!isRunningInConsoleOrSeeding()) {

            if (!session()->has('is_imported')) {

                DB::afterCommit(function () use ($leadContact) {
                    try {
                        event(new LeadEvent($leadContact, 'NewLeadCreated'));
                    } catch (\Throwable $e) {
                        \Log::error('Failed to notify admins of new lead after commit', [
                            'lead_id' => $leadContact->id,
                            'error' => $e->getMessage(),
                        ]);
                    }
                });
            }else{



                if (session('leads_count') == (session('total_leads'))) {

                    info('check');
                    $admins = User::allAdmins(company()->id);
                    $importedLeads = session('leads', []);
                    Notification::send($admins, new LeadImported([
                        'importedByName' => user()?->name ?? '',
                        'importCount'    => count($importedLeads),
                        'failedCount'    => max(0, (int) session('total_leads', 0) - count($importedLeads)),
                        'sourceName'     => 'CSV Import',
                        'importedAt'     => now()->format(company()->date_format),
                    ]));
                }

            }
        }

        // ── CRM Event: lead_created ──
        $this->recordCrmEvent('lead_created', $leadContact, [
            'metadata' => [
                'comment' => 'New lead created' . (session()->has('is_imported') ? ' (imported)' : ''),
                'client_name' => $leadContact->client_name,
                'company_name' => $leadContact->company_name,
            ],
        ]);
    }

    public function deleting(Lead $leadContact)
    {
        $notifyData = ['App\Notifications\LeadAgentAssigned', 'App\Notifications\NewDealCreated', 'App\Notifications\NewLeadCreated', 'App\Notifications\LeadImported'];
        \App\Models\Notification::deleteNotification($notifyData, $leadContact->id);
    }

    public function deleted(Lead $leadContact)
    {
        try {
            UniversalSearch::where('searchable_id', $leadContact->id)
                ->where('module_type', 'lead')
                ->delete();
        } catch (\Illuminate\Database\QueryException $e) {
            // Log the error but don't let it block the deletion
            \Log::warning('Failed to clean up universal_search for lead ID ' . $leadContact->id . ': ' . $e->getMessage());
        }
    }

    public function updated(Lead $leadContact)
    {
        HasDynamicTranslations::dispatchDynamicTranslation($leadContact, true);

        if (isRunningInConsoleOrSeeding()) {
            return;
        }

        if ($leadContact->wasChanged('temperature')) {
            $from = $leadContact->getOriginal('temperature');
            $to = $leadContact->temperature;

            // ── CRM Event: lead_updated (manual temperature change) ──
            $this->recordCrmEvent('lead_updated', $leadContact, [
                'metadata' => [
                    'comment' => 'Lead temperature changed',
                    'from_temperature' => $from instanceof \App\Enums\LeadTemperature ? $from->value : $from,
                    'to_temperature' => $to instanceof \App\Enums\LeadTemperature ? $to->value : $to,
                ],
            ]);
        }

        if ($leadContact->wasChanged('lead_lifecycle_status_id')) {
            $fromId = $leadContact->getOriginal('lead_lifecycle_status_id');
            $toId = $leadContact->lead_lifecycle_status_id;

            $statuses = LeadLifecycleStatus::whereIn('id', array_filter([$fromId, $toId]))
                ->get()
                ->keyBy('id');

            // ── CRM Event: lead_lifecycle_status_changed ──
            $this->recordCrmEvent('lead_lifecycle_status_changed', $leadContact, [
                'metadata' => [
                    'comment' => 'Lifecycle status changed from '
                        . ($statuses->get($fromId)?->label ?? 'none')
                        . ' to ' . ($statuses->get($toId)?->label ?? 'none'),
                    'from_status_id' => $fromId,
                    'to_status_id' => $toId,
                    'from_status_key' => $statuses->get($fromId)?->key,
                    'to_status_key' => $statuses->get($toId)?->key,
                ],
            ]);
        }

        if (!$leadContact->wasChanged('lead_owner')) {
            return;
        }

        $newOwnerId = $leadContact->lead_owner;
        if (!$newOwnerId) {
            return;
        }

        $oldOwnerId = $leadContact->getOriginal('lead_owner');
        if ($oldOwnerId === $newOwnerId) {
            return;
        }

        $newOwner = User::find($newOwnerId);
        if (!$newOwner) {
            return;
        }

        $actorId = user()?->id;
        DB::afterCommit(function () use ($newOwner, $leadContact, $oldOwnerId, $actorId) {
            try {
                // Skip when the assignee is the one who made the change (incl. admins).
                if ($actorId !== null && (int) $actorId === (int) $newOwner->id) {
                    return;
                }

                Notification::send($newOwner, new LeadOwnerAssigned($leadContact, $oldOwnerId));
            } catch (\Throwable $e) {
                \Log::error('Failed to notify lead owner after assignment', [
                    'lead_id' => $leadContact->id,
                    'owner_id' => $newOwner->id,
                    'error' => $e->getMessage(),
                ]);
            }
        });

        // ── CRM Event: lead_owner_changed ──
        $this->recordCrmEvent('lead_owner_changed', $leadContact, [
            'metadata' => [
                'comment' => 'Lead owner changed',
                'from_owner_id' => $oldOwnerId,
                'to_owner_id' => $newOwnerId,
                'new_owner_name' => $newOwner->name,
            ],
        ]);
    }

}
