<?php

namespace App\Services;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use App\Models\User;
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

        $senderInfo = $activity->sender_info;
        $leadAgentLocated = $this->resolveLinkedLeadAgent($activity);


        // General rule of thumb:
        // 1. Try to find a Lead or Deal based on the channel type and associated
        // 2. The fields to match are probably located as columns prefixed with client_ in the leads or deals table, or can be located in the related client_details table or client_contacts table

        // TODO: Still does require a bit of fine-tuning and testing with real data
        $dealOrLead = $this->findDealById($activity?->deal_id) ?? $this->findLeadById($activity?->lead_id);
        if($dealOrLead){
            // If linked to a Deal, also set the lead_id from the deal
            if ($dealOrLead instanceof Deal) {
                // Refresh the deal to ensure we have the latest lead_id
                $dealOrLead->refresh();
                
                if ($dealOrLead->lead_id && !$activity->lead_id) {
                    $activity->lead_id = $dealOrLead->lead_id;
                    $activity->save();
                }
            }
            
            ProcessCommunicationActivityJob::dispatch($activity);
            
            return $activity; // Already linked
        }

        // Try to find deal or lead by channel type
        $dealOrLead = $this->findDealOrLeadByChannelType($activity);

    
        if ($dealOrLead) {
            if ($dealOrLead instanceof Deal) {
                $activity->deal_id = $dealOrLead->id;
                
                // Also set lead_id from the deal if it exists and activity doesn't already have one
                // This mirrors the logic at lines 45-47 to prevent overwriting an existing lead_id
                if ($dealOrLead->lead_id && !$activity->lead_id) {
                    $activity->lead_id = $dealOrLead->lead_id;
                }
                
                $this->assignLinkedAgent($dealOrLead, $leadAgentLocated);
            } elseif ($dealOrLead instanceof Lead) {
                $activity->lead_id = $dealOrLead->id;
                $this->assignLinkedAgent($dealOrLead, $leadAgentLocated);
            }

            $activity->save();

            // Dispatch job to process the activity (send notifications, etc.)
            ProcessCommunicationActivityJob::dispatch($activity);
            
        }else{
            $company = $activity->company;
            $clientName = trim(($activity->first_name ?? '') . ' ' . ($activity->last_name ?? ''));
            
            // If the client name is empty, try to get it from the sender_info column
            // Note: sender_info is already cast as an array in the model, no need to json_decode
            if (empty($clientName) && !empty($activity->sender_info)) {
                
                
                if (is_array($senderInfo) && isset($senderInfo['name']) && !empty($senderInfo['name'])) {
                    $clientName = trim($senderInfo['name']);
                }
            }
            // If no deal or lead found, consider creating a new Lead if sufficient info is available
            $newLeadData = [
                'client_name' => $clientName,
                'client_email' => $activity->email,
                'client_instagram' => $activity->instagram_username,
                'client_telegram' => $activity->telegram_username,
                'client_whatsapp' => $activity->whatsapp_username,
                'chat_id' => $activity->chat_id,
                'cell' => $activity->phone_number,
                'company_id' => $activity->company_id,
                'mobile' => null, //TODO: TThis is a json so it ought to have a helper function to ensure that json format is maintained
                'added_by' => $leadAgentLocated?->user_id ?? $company?->default_lead_creator_id,
                'lead_owner' => $leadAgentLocated?->user_id ?? $company?->default_lead_creator_id,
                'agent_id' => $leadAgentLocated?->id,
            ];
            $newLead = $this->createLead($newLeadData);

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
                Log::info('Resolving email activity');
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
        $lead->added_by = $data['added_by'] ?? null;
        $lead->lead_owner = $data['lead_owner'] ?? null;
        $lead->agent_id = $data['agent_id'] ?? null;

        $lead->save();

        return $lead;
    }

  

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
    private function findDealByTelegram(string $username): ?Deal
    {
        $lead  = $this->findLeadByTelegram($username);
        if(!$lead){
            return null;
        }
        return $this->findDealByLeadId($lead->id);
    
    }

    // instagram
    private function findLeadByInstagram(string $username): ?Lead
    {
        return Lead::query()
            ->whereRaw('LOWER(client_instagram) = ?', [strtolower($username)])
            ->orderByDesc('updated_at')
            ->first();

    }
    private function findDealByInstagram(string $username): ?Deal
    {
        $lead  = $this->findLeadByInstagram($username);
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
            ->where('close_date', null) // Open deals only
            ->orderByDesc('updated_at')
            ->first();
          
    }
    // get deal by Id
    private function findDealById(?int $dealId): ?Deal
    {
        return Deal::query()
            ->where('id', $dealId)
            ->first();
    }
    private function findLeadById(?int $leadId): ?Lead
    {
        return Lead::query()
            ->where('id', $leadId)
            ->first();
    }

    public function createDealIfNeeded(CommunicationActivity $activity, ?LeadAgent $leadAgent = null): ?Deal
    {
        // Only create a deal if there is a lead associated with the activity
        if (empty($activity->lead_id)) {
            Log::info('Cannot create deal: No lead associated with activity ID ' . $activity->id);
            return null;
        }

        $lead = Lead::find($activity->lead_id);
        if (!$lead) {
            Log::info('Cannot create deal: Lead not found for lead ID ' . $activity->lead_id);
            return null;
        }

        // Check if there is already an open deal for this lead
        $existingDeal = $this->findDealByLeadId($lead->id);
        if ($existingDeal) {
            $activity->deal_id = $existingDeal->id;
            $activity->save();
            $this->assignLinkedAgent($existingDeal, $leadAgent);
            Log::info('No new deal created: Existing open deal found for lead ID ' . $lead->id);
            return $existingDeal; // Return existing open deal
        }

        $leadPipeline = LeadPipeline::where('default', '1')->where('company_id', $lead->company_id)->first();
        $leadStage = PipelineStage::where('default', '1')->where('lead_pipeline_id', $leadPipeline->id)->where('company_id', $lead->company_id)->first();



        // Create a new deal
        $deal = new Deal();
        $deal->name = 'New Deal for ' . $lead->client_name;
        $deal->lead_id = $lead->id;
        $deal->lead_pipeline_id = $leadPipeline->id;
        $deal->pipeline_stage_id = $leadStage->id;
        $deal->close_date =  null;
        $deal->value =  0;
        $deal->company_id = $lead->company_id;
        $deal->currency_id = $lead->company?->currency_id;
        
        // Attach the agent if provided
        if ($leadAgent) {
            $deal->agent_id = $leadAgent->id;
            Log::info('Assigned LeadAgent ID: ' . $leadAgent->id . ' to new Deal for lead ID: ' . $lead->id);
        }
        
        $deal->save();

        // Link the activity to the newly created deal
        $activity->deal_id = $deal->id;
        $activity->save();

        Log::info('Created new deal with ID ' . $deal->id . ' for lead ID ' . $lead->id);

        return $deal;
    }

    /**
     * Resolve the lead agent linked to the employee mailbox/account on this activity.
     */
    public function resolveLinkedLeadAgent(CommunicationActivity $activity): ?LeadAgent
    {
        $senderInfo = $activity->sender_info ?? [];
        $contactInfo = $senderInfo['contact'] ?? null;

        if (empty($contactInfo)) {
            Log::info('No contact information found in sender_info for agent lookup', [
                'activity_id' => $activity->id,
            ]);
            return null;
        }

        Log::info('Searching for LeadAgent with contact for email listener', [
            'activity_id' => $activity->id,
            'contact' => $contactInfo,
            'channel_type' => $activity->channel_type,
            'company_id' => $activity->company_id,
        ]);

        try {
            $user = $this->findUserBySenderContact($contactInfo, $activity->channel_type, $activity->company_id);

            if (!$user) {
                Log::info('No active user found for linked mailbox contact', [
                    'activity_id' => $activity->id,
                    'contact' => $contactInfo,
                    'company_id' => $activity->company_id,
                ]);
                return null;
            }

            $leadAgentQuery = LeadAgent::withoutGlobalScopes()
                ->where('user_id', $user->id)
                ->where('status', 'enabled');

            if ($activity->company_id) {
                $leadAgentQuery->where('company_id', $activity->company_id);
            }

            $leadAgent = $leadAgentQuery->first();

            if ($leadAgent) {
                Log::info('Resolved LeadAgent for email listener activity', [
                    'activity_id' => $activity->id,
                    'lead_agent_id' => $leadAgent->id,
                    'user_id' => $user->id,
                ]);
            } else {
                Log::info('User found but no enabled LeadAgent for linked mailbox contact', [
                    'activity_id' => $activity->id,
                    'user_id' => $user->id,
                    'contact' => $contactInfo,
                ]);
            }

            return $leadAgent;
        } catch (\Exception $e) {
            Log::error('Error resolving linked LeadAgent: ' . $e->getMessage(), [
                'activity_id' => $activity->id,
            ]);
            return null;
        }
    }

    private function findUserBySenderContact(string $contactInfo, string $channelType, ?int $companyId): ?User
    {
        $userQuery = User::query()
            ->without(['session', 'clientContact'])
            ->where('status', 'active');

        if ($companyId) {
            $userQuery->where('company_id', $companyId);
        }

        switch ($channelType) {
            case 'email':
                if (!filter_var($contactInfo, FILTER_VALIDATE_EMAIL)) {
                    Log::info('Invalid email format for sender_info contact');
                    return null;
                }
                return $userQuery->where('email', $contactInfo)->first();

            case 'whatsapp':
                return $userQuery->where(function ($query) use ($contactInfo) {
                    $query->where('mobile', $contactInfo)
                        ->orWhere('phone', $contactInfo);
                })->first();

            case 'telegram':
            case 'instagram':
                return $userQuery->where('email', $contactInfo)->first();

            default:
                if (filter_var($contactInfo, FILTER_VALIDATE_EMAIL)) {
                    return $userQuery->where('email', $contactInfo)->first();
                }

                return $userQuery->where(function ($query) use ($contactInfo) {
                    $query->where('mobile', $contactInfo)
                        ->orWhere('phone', $contactInfo);
                })->first();
        }
    }

    private function assignLinkedAgent(Lead|Deal $record, ?LeadAgent $leadAgent): void
    {
        if (!$leadAgent) {
            return;
        }

        if ($record instanceof Lead) {
            if (!$record->lead_owner) {
                $record->lead_owner = $leadAgent->user_id;
            }
            if (!$record->agent_id) {
                $record->agent_id = $leadAgent->id;
            }
        }

        if ($record instanceof Deal && !$record->agent_id) {
            $record->agent_id = $leadAgent->id;
        }

        if ($record->isDirty()) {
            $record->save();
        }
    }
}
