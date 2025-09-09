<?php

namespace Modules\Sms\Listeners;

use App\Events\NewInvoiceRecurringEvent;
use App\Models\User;
use App\Scopes\ActiveScope;
use Illuminate\Support\Facades\Notification;
use Modules\Sms\Notifications\InvoiceRecurringStatus;
use Modules\Sms\Notifications\NewRecurringInvoice;

class NewInvoiceRecurringListener
{
    public function handle(NewInvoiceRecurringEvent $event)
    {
        try {
            if (request()->type && request()->type == 'send') {
                if (($event->invoice->project && $event->invoice->project->client_id != null) || $event->invoice->client_id != null) {
                    $clientId = ($event->invoice->project && $event->invoice->project->client_id != null) ? $event->invoice->project->client_id : $event->invoice->client_id;
                    // Notify client
                    $notifyUser = User::withoutGlobalScope(ActiveScope::class)->findOrFail($clientId);

                    if ($event->status == 'status') {
                        Notification::send($notifyUser, new InvoiceRecurringStatus($event->invoice));
                    }
                    else {
                        Notification::send($notifyUser, new NewRecurringInvoice($event->invoice));
                    }
                }
            }
        } catch (\Exception $e) { // @codingStandardsIgnoreLine
        }
    }

}
