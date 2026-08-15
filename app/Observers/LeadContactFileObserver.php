<?php

namespace App\Observers;

use App\Models\Lead;
use App\Models\LeadContactFile;
use App\Services\LeadNotificationService;

class LeadContactFileObserver
{
    protected LeadNotificationService $notificationService;

    public function __construct(LeadNotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    public function saving(LeadContactFile $file)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            $file->last_updated_by = user()->id;
        }
    }

    public function creating(LeadContactFile $file)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            $file->added_by = user()->id;
        }
    }

    public function created(LeadContactFile $file)
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $lead = Lead::find($file->lead_id);
        if (! $lead) {
            return;
        }

        $this->notificationService->notifyFileUploaded(
            $lead,
            $file->filename ?? 'Unknown file',
            $file->id,
        );
    }

    public function updated(LeadContactFile $file)
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        if (! $file->wasChanged('description')) {
            return;
        }

        $lead = Lead::find($file->lead_id);
        if (! $lead) {
            return;
        }

        $this->notificationService->notifyFileUpdated(
            $lead,
            $file->filename ?? 'Unknown file',
            $file->id,
        );
    }

    public function deleted(LeadContactFile $file)
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $lead = Lead::find($file->lead_id);
        if (! $lead) {
            return;
        }

        $this->notificationService->notifyFileDeleted(
            $lead,
            $file->filename ?? 'Unknown file',
            $file->id,
        );
    }
}
