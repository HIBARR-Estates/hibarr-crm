<?php

namespace App\Observers;

use App\Events\LeadEvent;
use App\Models\Lead;
use App\Models\UniversalSearch;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use App\Notifications\LeadImported;
use App\Notifications\LeadOwnerAssigned;


class LeadObserver
{

    public function saving(Lead $lead)
    {
        if (!isRunningInConsoleOrSeeding()) {
            $userID = (!is_null(user())) ? user()->id : null;
            $lead->last_updated_by = $userID;
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
    }

    public function created(Lead $leadContact)
    {
        if (!isRunningInConsoleOrSeeding()) {

            if (!session()->has('is_imported')) {

                event(new LeadEvent($leadContact, 'NewLeadCreated'));
            }else{



                if (session('leads_count') == (session('total_leads'))) {

                    info('check');
                    $admins = User::allAdmins(company()->id);
                    Notification::send($admins, new LeadImported());
                }

            }
        }
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
        if (isRunningInConsoleOrSeeding()) {
            return;
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

        Notification::send($newOwner, new LeadOwnerAssigned($leadContact, $oldOwnerId));
    }

}
