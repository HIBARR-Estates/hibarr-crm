<?php

namespace App\Services;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Support\Facades\Log;
use App\Jobs\ProcessCommunicationActivityJob;

class CommunicationActivityResolverService
{
    /**
     * Attempt to resolve a Communication Activity
     * by linking it to the most relevant Deal or Lead.
     */
    public function resolve(CommunicationActivity $activity): ?CommunicationActivity
    {
        $dealOrLead = null;

        // General rule of thumb:
        // 1. Try to find a Lead or Deal based on the channel type and associated
        // 2. The fields to match are probably located as columns prefixed with client_ in the leads or deals table, or can be located in the related client_details table or client_contacts table

        // TODO: Still does require a bit of fine-tuning and testing with real data

        switch ($activity->channel_type) {
            case 'email':
                Log::info('Resolving email activity for email: ' . $activity->email);
                if (empty($activity->email)) {
                    return null; // Cannot resolve without email
                }
                $dealOrLead = $this->findLeadByEmail($activity->email) ?? $this->findDealByEmail($activity->email);
                break;
            case 'telegram':
                if (empty($activity->telegram_username)) {
                    return null; // Cannot resolve without telegram username
                }
                $dealOrLead = $this->findDealByTelegram($activity->telegram_username)
                    ?? $this->findLeadByTelegram($activity->telegram_username);
                break;
            case 'phone':
                if (empty($activity->phone_number)) {
                    return null; // Cannot resolve without phone number
                }
                $dealOrLead = $this->findDealByPhone($activity->phone_number)
                    ?? $this->findLeadByPhone($activity->phone_number);
                break;
            case 'instagram':
                if (empty($activity->instagram_username)) {
                    return null; // Cannot resolve without instagram username
                }
                $dealOrLead = $this->findDealByInstagram($activity->instagram_username)
                    ?? $this->findLeadByInstagram($activity->instagram_username);
                break;
            default:
                return null; // Unsupported channel type
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
        // return Deal::query()
        //     ->where('phone_number', $phone)
        //     ->where('status', 'open')
        //     ->orderByDesc('last_contact_at')
        //     ->orderByDesc('updated_at')
        //     ->first();

        return null;
    }

    private function findLeadByPhone(string $phone): ?Lead
    {
        // return Lead::query()
        //     ->where('phone_number', $phone)
        //     ->where('status', 'open')
        //     ->orderByDesc('last_contact_at')
        //     ->orderByDesc('updated_at')
        //     ->first();

        return null;
    }

    private function findDealByEmail(string $email): ?Deal
    {
        // return Deal::query()
        //     ->whereRaw('LOWER(email) = ?', [strtolower($email)])
        //     ->where('status', 'open')
        //     ->orderByDesc('last_contact_at')
        //     ->orderByDesc('updated_at')
        //     ->first();

        return null;
    }

    private function findLeadByEmail(string $email): ?Lead
    {
        // Try direct match on lead email
        $lead = Lead::query()
            ->whereRaw('LOWER(client_email) = ?', [strtolower($email)])
            // ->where('status_id', 'open') //TODO: Check to see the proper status value to be used here
            ->orderByDesc('updated_at')
            ->first();

        if ($lead) {
            return $lead;
        }

        // Try matching via related client (User) email
        return Lead::query()
            ->whereHas('client', function ($q) use ($email) {
                $q->whereRaw('LOWER(email) = ?', [strtolower($email)]);
            })
            // ->where('status_id', 'open') //TODO: Check to see the proper status value to be used here
            ->orderByDesc('updated_at')
            ->first();
    }

    private function findLeadByTelegram(string $username): ?Lead
    {
        // return Lead::query()
        //     ->where('telegram_username', $username)
        //     ->where('status', 'open')
        //     ->orderByDesc('updated_at')
        //     ->first();

        return null;
    }

    private function findLeadByInstagram(string $username): ?Lead
    {
        // return Lead::query()
        //     ->where('instagram_username', $username)
        //     ->where('status', 'open')
        //     ->orderByDesc('updated_at')
        //     ->first();
        return null;
    }
}
