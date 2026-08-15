<?php

namespace App\Observers;

use App\Models\Deal;
use App\Models\DealNote;
use App\Services\DealActivityEventService;
use App\Services\DealNotificationService;
use App\Traits\DealHistoryTrait;

class DealNoteObserver
{
    use DealHistoryTrait;

    protected DealNotificationService $notificationService;

    protected DealActivityEventService $dealActivityEventService;

    public function __construct(DealNotificationService $notificationService, DealActivityEventService $dealActivityEventService)
    {
        $this->notificationService = $notificationService;
        $this->dealActivityEventService = $dealActivityEventService;
    }

    public function saving(DealNote $dealNote)
    {
        if (! isRunningInConsoleOrSeeding()) {
            if (user()) {
                $dealNote->last_updated_by = user()->id;
            }
        }
    }

    public function created(DealNote $dealNote)
    {
        if (! isRunningInConsoleOrSeeding()) {

            if (user()) {
                self::createDealHistory($dealNote->deal_id, 'note-added', noteId: $dealNote->id);

                // Send notification to deal watchers and agent
                $deal = Deal::find($dealNote->deal_id);
                if ($deal) {
                    $this->notificationService->notifyNoteAdded(
                        $deal,
                        $dealNote->title ?? 'Untitled Note',
                        $dealNote->id
                    );

                    $this->dealActivityEventService->recordNoteAdded($deal, $dealNote);
                }
            }
        }
    }

    public function creating(DealNote $dealNote)
    {
        if (! isRunningInConsoleOrSeeding()) {
            if (user()) {
                $dealNote->added_by = user()->id;
            }
        }
    }

    public function updated(DealNote $dealNote)
    {
        if (! isRunningInConsoleOrSeeding() && user()) {
            // Send notification for note update
            $deal = Deal::find($dealNote->deal_id);
            if ($deal) {
                $this->notificationService->notifyNoteUpdated(
                    $deal,
                    $dealNote->title ?? 'Untitled Note',
                    $dealNote->id
                );
            }
        }
    }

    public function deleted(DealNote $dealNote)
    {
        if (user()) {
            self::createDealHistory($dealNote->deal_id, 'note-deleted');
        }

        if (! isRunningInConsoleOrSeeding() && user()) {
            $deal = Deal::find($dealNote->deal_id);
            if ($deal) {
                $this->notificationService->notifyNoteDeleted(
                    $deal,
                    $dealNote->title ?? 'Untitled Note',
                    $dealNote->id,
                );
            }
        }
    }
}
