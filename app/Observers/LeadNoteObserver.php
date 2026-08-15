<?php

namespace App\Observers;

use App\Models\Lead;
use App\Models\LeadNote;
use App\Services\LeadNotificationService;

class LeadNoteObserver
{
    protected LeadNotificationService $notificationService;

    public function __construct(LeadNotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    public function saving(LeadNote $leadNote)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            $leadNote->last_updated_by = user()->id;
        }
    }

    public function creating(LeadNote $leadNote)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            $leadNote->added_by = user()->id;
        }
    }

    public function created(LeadNote $leadNote)
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        if (app()->bound('skip_lead_note_created_notification')) {
            return;
        }

        $this->dispatchNoteNotification('notifyNoteAdded', $leadNote);
    }

    public function updated(LeadNote $leadNote)
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $this->dispatchNoteNotification('notifyNoteUpdated', $leadNote);
    }

    public function deleted(LeadNote $leadNote)
    {
        if (isRunningInConsoleOrSeeding() || ! user()) {
            return;
        }

        $this->dispatchNoteNotification('notifyNoteDeleted', $leadNote);
    }

    protected function dispatchNoteNotification(string $method, LeadNote $leadNote): void
    {
        $lead = Lead::find($leadNote->lead_id);
        if (! $lead) {
            return;
        }

        $leadNote->loadMissing('members');

        $this->notificationService->{$method}(
            $lead,
            $leadNote->title ?? 'Untitled Note',
            $leadNote->id,
            $leadNote,
        );
    }
}
