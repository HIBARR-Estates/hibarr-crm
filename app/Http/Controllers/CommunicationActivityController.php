<?php

namespace App\Http\Controllers;

use Illuminate\Support\Facades\Log;
use App\Helper\Reply;
use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use App\Http\Requests\CommunicationActivity\StoreRequest;
use App\Http\Requests\CommunicationActivity\SendEmailRequest;
use App\Jobs\CreateCommunicationActivityJob;
use App\Mail\CustomerCommunicationEmail;

class CommunicationActivityController extends Controller
{
    private $defaultPageSize = 20;

    /**
     * Store a new communication activity, typically called by the automation trigger.
     */
    public function store(StoreRequest $request)
    {
        // get the company id from the header and attach it to the request
        $companyId = $request->header('X-COMPANY-ID');

        if (!$companyId) {
            return Reply::error(__('messages.missingCompanyId'));
        }

        // Validate and create a new communication activity

        // The automation trigger calls this endpoint to create a communication activity
        // we will dispatch a job to process the activity asynchronously, and send the appropriate notifications
        CreateCommunicationActivityJob::dispatch(array_merge($request->validated(), [
            'company_id' => $companyId
        ]), $request->get('can_create_deal', false));

        return Reply::successWithData(__('messages.processingCommunicationActivity'), [
            'data' => null
        ]);
    }

    /**
     * Get communication activities for a specific deal.
     */
    public function getDealActivities(Request $request, $dealId)
    {
        $perPage = $request->get('per_page', $this->defaultPageSize);
        $activities = CommunicationActivity::where('deal_id', $dealId)
            ->with(['replies', 'parentActivity'])
            ->orderByDesc('timestamp')
            ->paginate($perPage);

        return Reply::successWithData(__('messages.dealCommunicationActities'), [
            'data' => $activities
        ]);
    }

    /**
     * Get communication activities for a specific lead.
     */
    public function getLeadActivities(Request $request, $leadId)
    {
        $perPage = $request->get('per_page', $this->defaultPageSize);
        $activities = CommunicationActivity::where('lead_id', $leadId)
            ->with(['replies', 'parentActivity'])
            ->orderByDesc('timestamp')
            ->paginate($perPage);

        return Reply::successWithData(__('messages.leadCommunicationActities'), [
            'data' => $activities
        ]);
    }

    /**
     * Get communication activities filtered by channel type.
     */
    public function getActivitiesByChannel(Request $request, $channelType)
    {
        $perPage = $request->get('per_page', $this->defaultPageSize);
        $activities = CommunicationActivity::where('channel_type', $channelType)
            ->orderByDesc('timestamp')
            ->paginate($perPage);

        return Reply::successWithData(__('messages.communicationActivitiesByChannel'), [
            'data' => $activities
        ]);
    }

    /**
     * Send a templated email to a customer from the authenticated user.
     * 
     * @param SendEmailRequest $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function sendEmailToCustomer(SendEmailRequest $request)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');
            
            if (!$companyId) {
                return Reply::error(__('messages.missingCompanyId'));
            }
            
            // PRIORITY 1: Check if there's an existing activity with sender_info
            // The resolver may have found a LeadAgent based on the activity's sender_info contact email
            $sender = null;
            $activity = null;
            
            if ($request->has('activity_id')) {
                $activity = CommunicationActivity::find($request->activity_id);
                
                // If activity exists, ensure it has direction set to 'outbound' for email sending
                if ($activity) {
                    $metadata = $activity->metadata ?? [];
                    if (!isset($metadata['direction']) || $metadata['direction'] !== 'outbound') {
                        $metadata['direction'] = 'outbound';
                        $activity->metadata = $metadata;
                        $activity->save();
                        $activity->refresh(); // Refresh to ensure metadata is saved
                        
                        Log::info('Updated existing activity metadata to set direction to outbound', [
                            'activity_id' => $activity->id,
                        ]);
                    }
                }
                
                // If activity exists, check if it has sender_info with a contact email
                // The resolver may have found a LeadAgent based on this contact email
                if ($activity && $activity->sender_info) {
                    $activitySenderInfo = $activity->sender_info;
                    $activityContactEmail = $activitySenderInfo['contact'] ?? $activitySenderInfo['email'] ?? null;
                    
                    if ($activityContactEmail) {
                        // Find the User by the contact email
                        $userFromContact = User::where('email', $activityContactEmail)
                            ->where('company_id', $companyId)
                            ->first();
                        
                        if ($userFromContact) {
                            // Find the LeadAgent for this user
                            $leadAgentFromContact = \App\Models\LeadAgent::where('user_id', $userFromContact->id)->first();
                            
                            if ($leadAgentFromContact && $leadAgentFromContact->user) {
                                $sender = User::with('employeeDetail.designation')
                                    ->where('id', $leadAgentFromContact->user->id)
                                    ->first();
                            }
                        }
                    }
                }
            }
            
            // Get the sender (the person clicking send)
            // For internal API routes, check if sender_id or sender_email is provided in the request
            // This allows the frontend to specify who is actually sending the email
            // Only do this if we haven't already found a sender from the activity
            
            // Check multiple possible field names for sender information
            $senderId = $request->get('sender_id') 
                ?? $request->get('user_id') 
                ?? $request->get('from_user_id')
                ?? null;
                
            $senderEmail = $request->get('sender_email')
                ?? $request->get('user_email')
                ?? $request->get('from_email')
                ?? $request->get('from')
                ?? null;
            
            if ($senderId) {
                // Get sender by ID
                $sender = User::with('employeeDetail.designation')
                    ->where('id', $senderId)
                    ->where('company_id', $companyId)
                    ->first();
            } elseif ($senderEmail) {
                // Get sender by email
                $sender = User::with('employeeDetail.designation')
                    ->where('email', $senderEmail)
                    ->where('company_id', $companyId)
                    ->first();
                    
            }
            
            // Fallback to authenticated user if sender not provided in request
            if (!$sender) {
                // Get authenticated user (try auth()->user() first, fallback to user() helper)
                $authenticatedUser = auth()->user() ?? user();
                
                // Validate it's a User instance
                if (!$authenticatedUser || !($authenticatedUser instanceof \App\Models\User)) {
                    return Reply::error('User not authenticated. Please provide sender_id or sender_email in the request.');
                }
                
                // Eager-load the relationship on the existing model instead of re-querying
                if (!$authenticatedUser->relationLoaded('employeeDetail')) {
                    $authenticatedUser->load('employeeDetail.designation');
                }
                
                $sender = $authenticatedUser;
            }
            
            if (!$sender) {
                return Reply::error('Sender user not found.');
            }
            
            // Ensure we have the name attribute - check both name and email
            if (empty($sender->name) && empty($sender->email)) {
                return Reply::error('User name and email are missing.');
            }

            // Get deal or lead
            $dealOrLead = null;

            if ($request->has('deal_id')) {
                $dealOrLead = Deal::with('contact', 'leadAgent.user.employeeDetail.designation')->where('company_id', $companyId)
                    ->findOrFail($request->deal_id);
                
                // Refresh deal to get latest agent_id if resolver just set it
                $dealOrLead->refresh();
                
                if (!$dealOrLead->contact || !$dealOrLead->contact->client_email) {
                    return Reply::error('Deal does not have a contact email address.');
                }
                
                // PRIORITY: If deal has a LeadAgent that was found by the resolver, use that as the sender
                // This overrides the authenticated user or request sender
                if ($dealOrLead->agent_id) {
                    // Try to get LeadAgent - first check if relationship is loaded
                    $leadAgent = $dealOrLead->leadAgent;
                    
                    // If relationship not loaded or null, load it explicitly
                    if (!$leadAgent) {
                        $leadAgent = \App\Models\LeadAgent::with('user.employeeDetail.designation')->find($dealOrLead->agent_id);
                    }
                    
                    if ($leadAgent && $leadAgent->user) {
                        $sender = User::with('employeeDetail.designation')
                            ->where('id', $leadAgent->user->id)
                            ->first();
                    }
                }
            } elseif ($request->has('lead_id')) {
                $dealOrLead = Lead::with('leadAgent.user.employeeDetail.designation')->where('company_id', $companyId)
                    ->findOrFail($request->lead_id);
                
                if (!$dealOrLead->client_email) {
                    return Reply::error('Lead does not have an email address.');
                }
                
                // If lead has a LeadAgent, use that as the sender
                if ($dealOrLead->agent_id) {
                    $leadAgent = \App\Models\LeadAgent::with('user.employeeDetail.designation')->find($dealOrLead->agent_id);
                    if ($leadAgent && $leadAgent->user) {
                        $sender = User::with('employeeDetail.designation')
                            ->where('id', $leadAgent->user->id)
                            ->first();
                    }
                }
            } else {
                return Reply::error('Either deal_id or lead_id is required.');
            }


            // Create a new communication activity record for this outgoing email
            if (!$activity) {
                $senderInfo = [
                    'name' => $sender->name,
                    'email' => $sender->email,
                    'contact' => $sender->email,
                ];
                
                $activity = CommunicationActivity::create([
                    'deal_id' => $dealOrLead instanceof Deal ? $dealOrLead->id : null,
                    'lead_id' => $dealOrLead instanceof Lead ? $dealOrLead->id : null,
                    'channel_type' => 'email',
                    'message_content' => $request->message,
                    'subject' => $request->subject,
                    'sender_info' => $senderInfo,
                    'metadata' => [
                        'direction' => 'outbound',
                    ],
                    'timestamp' => now(),
                    'company_id' => $companyId,
                    'resolution_status' => 'resolved',
                ]);
            } else {
                // Ensure existing activity has direction set to 'outbound' for email sending
                // This handles cases where the activity was created earlier without direction
                $metadata = $activity->metadata ?? [];
                if (!isset($metadata['direction']) || $metadata['direction'] !== 'outbound') {
                    $metadata['direction'] = 'outbound';
                    $activity->metadata = $metadata;
                    $activity->save();
                    
                    Log::info('Updated existing activity metadata to set direction to outbound', [
                        'activity_id' => $activity->id,
                    ]);
                }
            }

            // Get customer email
            $customerEmail = $dealOrLead instanceof Deal 
                ? $dealOrLead->contact->client_email 
                : $dealOrLead->client_email;

            // Log email sending attempt (no sensitive info)
            Log::info('Attempting to send email', [
                'subject' => $request->subject,
                'activity_id' => $activity->id,
            ]);

            // Send the email using Mail facade
            Mail::to($customerEmail)->send(
                new CustomerCommunicationEmail(
                    $activity,
                    $dealOrLead,
                    $sender,
                    $request->subject,
                    $request->message,
                    $request->get('template_data', [])
                )
            );

            Log::info('Email sent successfully', [
                'activity_id' => $activity->id,
            ]);

            return Reply::successWithData('Email sent successfully to customer.', [
                'activity_id' => $activity->id,
                'customer_email' => $customerEmail,
            ]);

        } catch (\Exception $e) {
            // Log detailed error information for debugging (includes full stack trace)
            Log::error('Failed to send email to customer', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'activity_id' => $activity->id ?? null,
                'exception' => get_class($e),
            ]);

            // Return generic error message to client (no sensitive details)
            $errorMessage = 'Failed to send email. Please try again later.';
            $errorData = [];
            
            // Include safe context like activity_id if available
            if (isset($activity) && $activity->id) {
                $errorData['activity_id'] = $activity->id;
            }
            
            return Reply::error($errorMessage, null, $errorData);
        }
    }
}