<?php

namespace Modules\Sms\Listeners;

use App\Events\NewProposalEvent;
use App\Models\User;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\NewProposal;
use Modules\Sms\Notifications\ProposalApproved;
use Modules\Sms\Notifications\ProposalRejected;

class NewProposalListener
{
    public function handle(NewProposalEvent $event)
    {
        try {
            if ($event->type == 'signed') {
                $allAdmins = User::allAdmins($event->proposal->company->id);
                // Notify admins
                if ($event->proposal->status == 'accepted') {
                    Notification::send($allAdmins, new ProposalApproved($event->proposal));
                }
                else {
                    Notification::send($allAdmins, new ProposalRejected($event->proposal));
                }
            } else {
                // Notify client
                Notification::send($event->proposal->lead, new NewProposal($event->proposal));
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
