<?php

namespace App\Services;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;

class CommunicationActivityResolverService
{
    /**
     * Attempt to resolve a Communication Activity
     * by linking it to the most relevant Deal or Lead.
     */
    public function resolve(CommunicationActivity $activity): ?CommunicationActivity
    {
        $dealOrLead = null;

        // Priority 1: Phone Number
        if (!empty($activity->phone_number)) {
            $dealOrLead = $this->findDealByPhone($activity->phone_number)
                ?? $this->findLeadByPhone($activity->phone_number);
        }

        // Priority 2: Email
        if (!$dealOrLead && !empty($activity->email)) {
            $dealOrLead = $this->findDealByEmail($activity->email)
                ?? $this->findLeadByEmail($activity->email);
        }

        // Priority 3: Telegram Username
        if (!$dealOrLead && !empty($activity->telegram_username)) {
            $dealOrLead = $this->findLeadByTelegram($activity->telegram_username);
        }

        // Priority 4: Instagram Username
        if (!$dealOrLead && !empty($activity->instagram_username)) {
            $dealOrLead = $this->findLeadByInstagram($activity->instagram_username);
        }

        // If resolved → update activity
        if ($dealOrLead) {
            if ($dealOrLead instanceof Deal) {
                $activity->deal_id = $dealOrLead->id;
            } elseif ($dealOrLead instanceof Lead) {
                $activity->lead_id = $dealOrLead->id;
            }

            $activity->save();

            // Dispatch job to process the activity (send notifications, etc.)
            ProcessCommunicationActivityJob::dispatch($activity);
            
        }

        return $activity;
    }

    // TODO: Adjust all methods to check for the right columns in table for deals or leads, also ensure you check the customer fields also as they could contain data such as email or phone number or instagram_username , e.t.c

    private function findDealByPhone(string $phone): ?Deal
    {
        return Deal::query()
            ->where('phone_number', $phone)
            ->where('status', 'open')
            ->orderByDesc('last_contact_at')
            ->orderByDesc('updated_at')
            ->first();
    }

    private function findLeadByPhone(string $phone): ?Lead
    {
        return Lead::query()
            ->where('phone_number', $phone)
            ->where('status', 'open')
            ->orderByDesc('last_contact_at')
            ->orderByDesc('updated_at')
            ->first();
    }

    private function findDealByEmail(string $email): ?Deal
    {
        return Deal::query()
            ->whereRaw('LOWER(email) = ?', [strtolower($email)])
            ->where('status', 'open')
            ->orderByDesc('last_contact_at')
            ->orderByDesc('updated_at')
            ->first();
    }

    private function findLeadByEmail(string $email): ?Lead
    {
        return Lead::query()
            ->whereRaw('LOWER(email) = ?', [strtolower($email)])
            ->where('status', 'open')
            ->orderByDesc('last_contact_at')
            ->orderByDesc('updated_at')
            ->first();
    }

    private function findLeadByTelegram(string $username): ?Lead
    {
        return Lead::query()
            ->where('telegram_username', $username)
            ->where('status', 'open')
            ->orderByDesc('updated_at')
            ->first();
    }

    private function findLeadByInstagram(string $username): ?Lead
    {
        return Lead::query()
            ->where('instagram_username', $username)
            ->where('status', 'open')
            ->orderByDesc('updated_at')
            ->first();
    }
}
