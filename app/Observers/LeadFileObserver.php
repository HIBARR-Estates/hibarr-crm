<?php

namespace App\Observers;

use App\Helper\Files;
use App\Models\Deal;
use App\Models\DealFile;
use App\Services\DealNotificationService;
use App\Traits\DealHistoryTrait;

class LeadFileObserver
{
    use DealHistoryTrait;

    protected DealNotificationService $notificationService;

    public function __construct(DealNotificationService $notificationService)
    {
        $this->notificationService = $notificationService;
    }

    public function saving(DealFile $leadFile)
    {
        if (! isRunningInConsoleOrSeeding()) {
            $leadFile->last_updated_by = user()->id;
        }
    }

    public function created(DealFile $leadFile)
    {

        if (! isRunningInConsoleOrSeeding()) {
            self::createDealHistory($leadFile->deal_id, 'file-added', fileId: $leadFile->id);

            // Send notification for file upload
            if (user()) {
                $deal = Deal::find($leadFile->deal_id);
                if ($deal) {
                    $this->notificationService->notifyFileUploaded(
                        $deal,
                        $leadFile->id,
                    );
                }
            }
        }

    }

    public function creating(DealFile $leadFile)
    {
        if (! isRunningInConsoleOrSeeding()) {
            $leadFile->added_by = user()->id;
        }
    }

    public function updated(DealFile $leadFile)
    {
        if (isRunningInConsoleOrSeeding() || ! user() || ! $leadFile->wasChanged('description')) {
            return;
        }

        $deal = Deal::find($leadFile->deal_id);
        if ($deal) {
            $this->notificationService->notifyFileUpdated(
                $deal,
                $leadFile->id,
            );
        }
    }

    public function deleting(DealFile $leadFile)
    {
        if (! empty($leadFile->hashname) && ! empty($leadFile->deal_id)) {
            Files::deleteFile($leadFile->hashname, DealFile::FILE_PATH.'/'.$leadFile->deal_id);
        }
    }

    public function deleted(DealFile $leadFile)
    {
        if (user()) {
            self::createDealHistory($leadFile->deal_id, 'file-deleted');

            // Send notification for file deletion
            $deal = Deal::find($leadFile->deal_id);
            if ($deal) {
                $this->notificationService->notifyFileDeleted(
                    $deal,
                    $leadFile->id,
                );
            }
        }
    }
}
