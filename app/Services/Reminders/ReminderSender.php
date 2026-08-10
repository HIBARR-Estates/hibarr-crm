<?php

namespace App\Services\Reminders;

use App\Models\Lead;
use App\Models\Reminder;
use App\Models\User;
use App\Notifications\ReminderNotification;
use App\Support\ReminderFeature;
use Illuminate\Support\Facades\Notification;

class ReminderSender
{
    public function send(Reminder $reminder): void
    {
        if (!ReminderFeature::enabledForCompany((int) $reminder->company_id)) {
            return;
        }

        if (!$reminder->claimForSending()) {
            return;
        }

        try {
            $notification = new ReminderNotification($reminder);

            if ($reminder->recipient_type === Reminder::RECIPIENT_USER && $reminder->recipient_id) {
                $user = User::query()->find($reminder->recipient_id);
                if (!$user) {
                    $reminder->markFailed('Recipient user not found');

                    return;
                }

                $via = $notification->via($user);
                if ($via === []) {
                    $reminder->markFailed('No notification channels enabled for recipient/company settings');

                    return;
                }

                // Send inline: SendReminderJob is already queued; avoid a second queue hop
                // that can fail on unserialize and mark the reminder sent prematurely.
                Notification::sendNow($user, $notification);
            } else {
                $email = $reminder->recipient_email;
                if (!is_string($email) || $email === '') {
                    $reminder->markFailed('Missing recipient email');

                    return;
                }

                $name = 'there';
                if ($reminder->recipient_type === Reminder::RECIPIENT_LEAD && $reminder->recipient_id) {
                    $lead = Lead::query()->find($reminder->recipient_id);
                    $name = $lead?->client_name ?? $name;
                }

                $mailNotification = $notification->forAnonymousMail($name);
                if ($mailNotification->via(null) === []) {
                    $reminder->markFailed('Email channel disabled for company');

                    return;
                }

                Notification::route('mail', $email)->notifyNow($mailNotification);
            }

            $reminder->markSent();
        } catch (\Throwable $exception) {
            report($exception);
            $reminder->markFailed($exception->getMessage());
        }
    }
}
