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
        $dealOrLead = $this->findDealById($activity?->deal_id) ?? $this->findLeadById($activity?->lead_id);
        if($dealOrLead){
            Log::info('Activity already linked to ' . ( $dealOrLead instanceof Deal ? 'Deal' : 'Lead') . ' ID: ' . $dealOrLead->id);
            ProcessCommunicationActivityJob::dispatch($activity);
            
            return $activity; // Already linked
        }

        // Try to find deal or lead by channel type
        $dealOrLead = $this->findDealOrLeadByChannelType($activity);

        if ($dealOrLead) {
            Log::info('Resolved activity to ' . ( $dealOrLead instanceof Deal ? 'Deal' : 'Lead') . ' ID: ' . $dealOrLead->id);
            if ($dealOrLead instanceof Deal) {
                $activity->deal_id = $dealOrLead->id;
            } elseif ($dealOrLead instanceof Lead) {
                $activity->lead_id = $dealOrLead->id;
            }

            $activity->save();

        }
        if ($dealOrLead) {
            Log::info('Resolved activity to ' . ( $dealOrLead instanceof Deal ? 'Deal' : 'Lead') . ' ID: ' . $dealOrLead->id);
            if ($dealOrLead instanceof Deal) {
                $activity->deal_id = $dealOrLead->id;
            } elseif ($dealOrLead instanceof Lead) {
                $activity->lead_id = $dealOrLead->id;
            }

            $activity->save();

            // Dispatch job to process the activity (send notifications, etc.)
            ProcessCommunicationActivityJob::dispatch($activity);
            
        }else{
            Log::info('No matching Deal or Lead found for activity ID: ' . $activity->id);
            $company = $activity->company;
            // If no deal or lead found, consider creating a new Lead if sufficient info is available
            $newLeadData = [
                'client_name' => trim(($activity->first_name ?? '') . ' ' . ($activity->last_name ?? '')),
                'client_email' => $activity->email,
                'client_instagram' => $activity->instagram_username,
                'client_telegram' => $activity->telegram_username,
                'client_whatsapp' => $activity->whatsapp_username,
                'chat_id' => $activity->chat_id,
                'cell' => $activity->phone_number,
                'company_id' => $activity->company_id,
                'mobile' => null, //TODO: TThis is a json so it ought to have a helper function to ensure that json format is maintained
                'added_by' => $company?->default_lead_creator_id,
                'lead_owner' => $company?->default_lead_creator_id, // Optionally assign to a default owner
            ];
            $newLead = $this->createLead($newLeadData);
            Log::info('Created new Lead with ID: ' . ($newLead ? $newLead->id : 'null'));
        
            if ($newLead) {
                $activity->lead_id = $newLead->id;
                $activity->save();

                // Dispatch job to process the activity (send notifications, etc.)
                ProcessCommunicationActivityJob::dispatch($activity);
            }
        }

        return $activity;
    }

      /**
     * Find Deal or Lead by activity channel type and contact info
     */
    private function findDealOrLeadByChannelType(CommunicationActivity $activity): ?object
    {
        $dealOrLead = null;
        switch ($activity->channel_type) {
            case 'email':
                Log::info('Resolving email activity for email: ' . $activity->email);
                if (empty($activity->email)) {
                    return null; // Cannot resolve without email
                }
                $dealOrLead = $this->findDealByEmail($activity->email) ?? $this->findLeadByEmail($activity->email);
                break;
            case 'telegram':
                Log::info('Resolving telegram activity for username: ' . $activity->telegram_username);
                if (empty($activity->telegram_username)) {
                    return null; // Cannot resolve without telegram username
                }
                $dealOrLead = $this->findDealByTelegram($activity->telegram_username) ?? $this->findLeadByTelegram($activity->telegram_username);
                break;
            case 'whatsapp':
                Log::info('Resolving whatsapp activity for username: ' . $activity->whatsapp_username);
                if (empty($activity->whatsapp_username)) {
                    return null; // Cannot resolve without whatsapp username
                }
                $dealOrLead = $this->findDealByWhatsapp($activity->whatsapp_username)
                    ?? $this->findLeadByWhatsapp($activity->whatsapp_username);
                break;
            case 'instagram':
                Log::info('Resolving instagram activity for username: ' . $activity->instagram_username);
                if (empty($activity->instagram_username)) {
                    return null; // Cannot resolve without instagram username
                }
                $dealOrLead = $this->findDealByInstagram($activity->instagram_username)
                    ?? $this->findLeadByInstagram($activity->instagram_username);
                break;
            default:
                return null; // Unsupported channel type
        }
        return $dealOrLead;
    }

    // get user by contact details
    private function getUserByContactDetails(array $contactDetails, string $channelType): ?User
    {
        switch ($channelType) {
            case 'email':
                return User::query()
                    ->where('email', $contactDetails['email'])
                    ->first();
            case 'phone':
                return User::query()
                    ->where('phone', $contactDetails['phone'])
                    ->first();
            case 'whatsapp':
                return UserContactDetails::query()
                    ->where('whatsapp_username', $contactDetails['whatsapp_username'])
                    ->first();
            case 'instagram':
                return UserContactDetails::query()
                    ->where('instagram_username', $contactDetails['instagram_username'])
                    ->first();
            case 'telegram':
                return UserContactDetails::query()
                    ->where('telegram_chat_id', $contactDetails['telegram_chat_id'])
                    ->first()
                    ?? UserContactDetails::query()
                    ->where('telegram_username', $contactDetails['telegram_username'])
                    ->first();
            default:
                # code...
                break;
        }
        return User::query()
            ->where('email', $contactDetails['email'])
            ->orWhere('phone', $contactDetails['phone'])
            ->orWhere('whatsapp', $contactDetails['whatsapp'])
            ->orWhere('instagram', $contactDetails['instagram'])
            ->orWhere('telegram', $contactDetails['telegram'])
            ->first();
    }

    /**
     * Create a new Lead with the provided data.
     * @return Lead|null
     * @param array $data
     *
     */
    private function createLead(array $data): ?Lead
    {
        Log::info('Creating new lead with data: ' . json_encode($data));
        $lead = new Lead();
        $lead->company_id = $data['company_id'];
        $lead->client_name = $data['client_name'] ?? null;
        $lead->client_email = $data['client_email'] ?? null;
        $lead->client_whatsapp = $data['client_whatsapp'] ?? null;
        $lead->client_instagram = $data['client_instagram'] ?? null;
        $lead->client_telegram = $data['client_telegram'] ?? null;
        $lead->telegram_chat_id = $data['chat_id'] ?? null;
        // populate {channel_type}_chat_id if there is ever a need, similar to what is being done for telegram above
        $lead->mobile = $data['mobile'];
        $lead->cell = $data['cell'];
     

        
        $lead->save();

        return $lead;
    }

    // TODO: Adjust all methods to check for the right columns in table for deals or leads, also ensure you check the customer fields also as they could contain data such as email or phone number or instagram_username , e.t.c

    // phone
    private function findDealByPhone(string $phone): ?Deal
    {
        $lead  = $this->findLeadByPhone($phone);
        if(!$lead){
            return null;
        }
        return $this->findDealByLeadId($lead->id);
    }

    private function findLeadByPhone(string $phone): ?Lead
    {

        return Lead::query()
            ->whereRaw('LOWER(cell) = ?', [strtolower($phone)])
            ->orderByDesc('updated_at')
            ->first();

    }

    // email
    private function findDealByEmail(string $email): ?Deal
    {
        $lead  = $this->findLeadByEmail($email);
        if(!$lead){
            return null;
        }
        return $this->findDealByLeadId($lead->id);
    }
    private function findLeadByEmail(string $email): ?Lead
    {
        // TODO: Leads should have unique emails ....
        // Try direct match on lead email
        $lead = Lead::query()
            ->whereRaw('LOWER(client_email) = ?', [strtolower($email)])
            ->orderByDesc('updated_at')
            ->first();

        if ($lead) {
            return $lead;
        }

        // Try matching via related client (User) email
        $lead =  Lead::query()
            ->whereHas('client', function ($q) use ($email) {
                $q->whereRaw('LOWER(email) = ?', [strtolower($email)]);
            })
            ->orderByDesc('updated_at')
            ->first();
        
        // create a lead if not found
        return $lead;
    }

    // whatsapp
    private function findDealByWhatsapp(string $username): ?Deal
    {
        $lead  = $this->findLeadByWhatsapp($username);
        if(!$lead){
            return null;
        }
        return $this->findDealByLeadId($lead->id);

    }
    private function findLeadByWhatsapp(string $username): ?Lead
    {
        return Lead::query()
            ->whereRaw('LOWER(client_whatsapp) = ?', [strtolower($username)])
            ->orderByDesc('updated_at')
            ->first();

    }

    // telegram
    private function findLeadByTelegram(string $username): ?Lead
    {
        return Lead::query()
            ->whereRaw('LOWER(client_telegram) = ?', [strtolower($username)])
            ->orderByDesc('updated_at')
            ->first();

    }
    private function findDealByTelegram(string $username): ?Lead
    {
        $lead  = $this->findLeadByTelegram($username);
        if(!$lead){
            return null;
        }
        return $this->findDealByLeadId($lead->id);
    
    }

    // get Deal by leadId
    private function findDealByLeadId(int $leadId): ?Deal
    {
        // return the most recent deal for the lead that is still open
        // TODO: Discuss the use case where a client has multiple open deals
        return Deal::query()
            ->where('lead_id', $leadId)
            ->where('close_date', null) // Open deals only//TODO: Confirm this is the way open deals are identified
            ->orderByDesc('updated_at')
            ->first();
          
    }
    // get deal by Id
    private function findDealById(int $dealId): ?Deal
    {
        return Deal::query()
            ->where('id', $dealId)
            ->first();
    }
    private function findLeadById(int $leadId): ?Lead
    {
        return Lead::query()
            ->where('id', $leadId)
            ->first();
    }


}
