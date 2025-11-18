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
        // Attach Deal Agent based on sender_info contact details
        // Check for a LeadAgent that is a user matching the email of the sender_info
        // This can be found in $senderInfo['contact'] if available
        // once found we attach the agent to the deal
        $leadAgentLocated = $this->findLeadAgentByContactDetails($senderInfo, $activity->channel_type);
        if ($leadAgentLocated) {
            Log::info('Located LeadAgent with ID: ' . $leadAgentLocated->id . ' for user: ' . $leadAgentLocated->user->name);
        } 


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
                
                // Attach the located agent to the deal if found and deal doesn't have an agent
                if ($leadAgentLocated && !$dealOrLead->agent_id) {
                    $dealOrLead->agent_id = $leadAgentLocated->id;
                    $dealOrLead->save();
                    Log::info('Attached LeadAgent ID: ' . $leadAgentLocated->id . ' to Deal ID: ' . $dealOrLead->id);
                }
            } elseif ($dealOrLead instanceof Lead) {
                $activity->lead_id = $dealOrLead->id;
            }

            $activity->save();

            // Dispatch job to process the activity (send notifications, etc.)
            ProcessCommunicationActivityJob::dispatch($activity);
            
        }else{
            Log::info('No matching Deal or Lead found for activity ID: ' . $activity->id);
            $company = $activity->company;
            $clientName = trim(($activity->first_name ?? '') . ' ' . ($activity->last_name ?? ''));
            
            // If the client name is empty, try to get it from the sender_info column
            // Note: sender_info is already cast as an array in the model, no need to json_decode
            if (empty($clientName) && !empty($activity->sender_info)) {
                
                
                if (is_array($senderInfo) && isset($senderInfo['name']) && !empty($senderInfo['name'])) {
                    $clientName = trim($senderInfo['name']);
                    Log::info('Extracted client name from sender_info: ' . $clientName);
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
     * Find a LeadAgent based on sender contact details
     * 
     * @param array $senderInfo
     * @param string $channelType
     * @return LeadAgent|null
     */
    private function findLeadAgentByContactDetails(array $senderInfo, string $channelType): ?LeadAgent
    {
        if (empty($senderInfo)) {
            Log::info('No sender_info provided for agent lookup');
            return null;
        }

        $contactInfo = $senderInfo['contact'] ?? null;
        
        if (empty($contactInfo)) {
            Log::info('No contact information found in sender_info: ' . json_encode($senderInfo));
            return null;
        }

        Log::info('Searching for LeadAgent with contact: ' . $contactInfo . ' for channel: ' . $channelType);

        $user = null;

        try {
            // Try to find user based on channel type and contact info
            switch ($channelType) {
                case 'email':
                    // For email, the contact should be an email address
                    if (filter_var($contactInfo, FILTER_VALIDATE_EMAIL)) {
                        $user = User::where('email', $contactInfo)->first();
                    } else {
                        Log::info('Invalid email format for contact: ' . $contactInfo);
                    }
                    break;
                    
                case 'whatsapp':
                    // For WhatsApp, contact might be phone number or username
                    $user = User::where('mobile', $contactInfo)
                        ->orWhere('phone', $contactInfo)
                        ->first();
                    break;
                    
                case 'telegram':
                case 'instagram':
                    // For social platforms, we might need to check custom fields or additional tables
                    // This could be extended based on how contact details are stored
                    $user = User::where('email', $contactInfo)->first();
                    break;
                    
                default:
                    // Fallback: try email format first, then phone
                    if (filter_var($contactInfo, FILTER_VALIDATE_EMAIL)) {
                        $user = User::where('email', $contactInfo)->first();
                    } else {
                        $user = User::where('mobile', $contactInfo)
                            ->orWhere('phone', $contactInfo)
                            ->first();
                    }
            }

            if (!$user) {
                Log::info('No user found with contact: ' . $contactInfo . ' for channel: ' . $channelType);
                return null;
            }

            // Find LeadAgent for this user
            $leadAgent = LeadAgent::where('user_id', $user->id)->first();

            if ($leadAgent) {
                Log::info('Found LeadAgent ID: ' . $leadAgent->id . ' for user: ' . $user->name . ' (email: ' . $user->email . ')');
            } else {
                Log::info('No active LeadAgent found for user: ' . $user->name . ' (ID: ' . $user->id . ')');
            }

            return $leadAgent;

        } catch (\Exception $e) {
            Log::error('Error finding LeadAgent by contact details: ' . $e->getMessage());
            return null;
        }
    }


}
