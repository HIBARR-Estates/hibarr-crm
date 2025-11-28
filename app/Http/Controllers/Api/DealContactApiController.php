<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Models\Deal;
use App\Models\DealHistory;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadPipeline;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Models\HibarrDealFields;
use App\Models\Package;
use App\Models\DealFollowUp;
use App\Models\MeetingType;
use App\Models\User;
use App\Events\DealEvent;
use App\Notifications\LeadAgentAssigned;
use App\Http\Requests\Deal\CreateDealRequest;
use App\Http\Requests\Contact\CreateOrUpdateContactRequest;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class DealContactApiController extends Controller
{
    /**
     * Create a new controller instance.
     */
    public function __construct()
    {
        // $this->middleware('api.token.auth');
    }

 
    /**
     * Change the stage of a deal.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function changeStage(Request $request)
    {
        try {
            $dealId = $request->input('deal_id');
            $newStageId = $request->input('new_stage_id');

            // Debug logging
            Log::info('API Request Data:', [
                'deal_id' => $dealId,
                'new_stage_id' => $newStageId,
            ]);

            // Check if deal exists
            $deal = Deal::find($dealId);
            if (!$deal) {
                return Reply::error("Deal with ID {$dealId} not found.");
            }

            // Check if stage exists
            $newStage = PipelineStage::find($newStageId);
            if (!$newStage) {
                return Reply::error("Pipeline stage with ID {$newStageId} not found.");
            }

            // Check if the stage is 'win' or 'lost' - don't allow changes
            if (in_array($newStage->slug, ['win', 'lost'])) {
                return Reply::error('Cannot change to win or lost stage directly. Use the proper win/lost process.');
            }

            // Store the old stage for comparison
            $oldStageId = $deal->pipeline_stage_id;

            // Get the responsible agent's user ID for proper tracking
            $responsibleUserId = null;
            if ($deal->agent_id) {
                $leadAgent = \App\Models\LeadAgent::find($deal->agent_id);
                if ($leadAgent && $leadAgent->user) {
                    $responsibleUserId = $leadAgent->user->id;
                }
            }

            // Use the same approach as the existing changeStage method
            // Update the deal stage directly without triggering observers
            DB::table('deals')
                ->where('id', $dealId)
                ->update(['pipeline_stage_id' => $newStageId]);

            // Create deal history manually with the responsible agent's user ID (if available)
            \App\Models\DealHistory::create([
                'deal_id' => $dealId,
                'event_type' => 'stage-updated',
                'created_by' => $responsibleUserId, // Can be null if no responsible user
                'deal_stage_from_id' => $oldStageId,
                'deal_stage_to_id' => $newStageId,
            ]);

            // Reload the deal
            $deal = Deal::find($dealId);
            $deal->load(['leadStage', 'pipeline', 'contact', 'leadAgent.user']);

            // Get stage and pipeline names safely
            $stageName = 'Unknown';
            $pipelineName = 'Unknown';
            
            if ($deal->leadStage) {
                $stageName = $deal->leadStage->name;
            }
            
            if ($deal->pipeline) {
                $pipelineName = $deal->pipeline->name;
            }

            return Reply::successWithData('Deal stage changed successfully', [
                'deal' => $deal,
                'old_stage_id' => $oldStageId,
                'new_stage_id' => $newStageId,
                'stage_name' => $stageName,
                'pipeline_name' => $pipelineName,
                'responsible_user_id' => $responsibleUserId,
                'responsible_user_name' => $deal->leadAgent && $deal->leadAgent->user ? $deal->leadAgent->user->name : 'Unknown'
            ]);

        } catch (\Exception $e) {
            Log::error('Deal Stage Change Error:', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'deal_id' => $request->input('deal_id'),
                'new_stage_id' => $request->input('new_stage_id'),
            ]);
            return Reply::error('An error occurred while changing deal stage: ');
        }
    }

    /**
     * Create or update the most recent deal for a contact.
     * If a deal exists for the contact, updates the most recent one.
     * Otherwise, creates a new deal.
     *
     * @param CreateDealRequest $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createDeal(CreateDealRequest $request)
    {
        try {
            return DB::transaction(function () use ($request) {
                $companyId = $request->header('X-COMPANY-ID');
 
                if (!$companyId) {
                    return Reply::error(__('messages.missingCompanyId'));
                }
                $companyId = (int) $companyId;
                $contactId = $this->resolveContact($request, $companyId);
                
                // Save UTM information if provided
                $this->saveUtmInfo($contactId, $request);
                
                // Find the most recent deal for this contact
                $deal = Deal::where('lead_id', $contactId)
                    ->where('company_id', $companyId)
                    ->orderByDesc('updated_at')
                    ->orderByDesc('created_at')
                    ->first();

                $isNewDeal = !$deal;

                if ($isNewDeal) {
                    // Create new deal
                    $deal = new Deal();
                    $deal->company_id = $companyId;
                    $deal->lead_id = $contactId;
                    $deal->hash = md5(microtime());
                    $deal->created_at = now();
                }

                // Default pipeline_id to 1 if not provided
                $pipelineId = $request->pipeline_id ?? 1;
                
                // Get first stage ID for the pipeline
                $firstStageId = $this->getFirstStageinpipeline($pipelineId, $companyId);

                // Resolve agent_id from deal_owner_id (user_id)
                $agentId = null;
                if ($request->has('deal_owner_id') && !empty($request->deal_owner_id)) {
                    $agentId = $this->resolveAgentId($request->deal_owner_id, $companyId);
                    
                    // If deal_owner_id was provided but couldn't be resolved, log warning
                    if ($agentId === null) {
                        Log::warning('Invalid deal_owner_id provided in createDeal API', [
                            'deal_owner_id' => $request->deal_owner_id,
                            'company_id' => $companyId,
                            'contact_email' => $request->email ?? 'unknown'
                        ]);
                    }
                }

                $packageId = $this->resolvePackageId($request, $companyId);

                // Update deal fields
                $deal->name = $request->name;
                $deal->lead_pipeline_id = $pipelineId;
                $deal->pipeline_stage_id = $request->pipeline_stage_id ?? $firstStageId ?? $deal->pipeline_stage_id;
                $deal->agent_id = $agentId ?? $deal->agent_id;
                $deal->package_id = $packageId;
                $deal->next_follow_up = 'yes';
                $deal->create_client = 0;
                
                // Save quietly to bypass observers
                $deal->saveQuietly();

                // Update lead's lead_owner if deal_owner_id is provided and lead doesn't have an owner
                if ($request->has('deal_owner_id') && !empty($request->deal_owner_id)) {
                    $lead = Lead::where('company_id', $companyId)->where('id', $contactId)->first();
                    if ($lead && !$lead->lead_owner) {
                        $lead->lead_owner = $request->deal_owner_id;
                        $lead->saveQuietly();
                    }
                }

                // Upsert Hibarr fields after deal is saved
                $this->upsertHibarrFields($deal, $request);
                
                // Manually trigger notifications for agent or admins (only for new deals)
                if ($isNewDeal) {
                    $this->sendDealCreatedNotifications($deal);
                }

                // Sync deal watchers after deal is saved
                $dealWatchers = $request->input('deal_watcher', []);
                if (is_array($dealWatchers) && !empty($dealWatchers)) {
                    $validUserIds = User::whereIn('id', $dealWatchers)
                        ->pluck('id')
                        ->toArray();
                    
                    if (!empty($validUserIds)) {
                        $deal->dealWatchers()->sync($validUserIds);
                    }
                }

                // Handle meeting if provided
                if ($request->has('meeting') && is_array($request->meeting)) {
                    $this->createMeeting($deal, $request->meeting, $companyId);
                }

                return Reply::successWithData($isNewDeal ? 'Deal created successfully' : 'Deal updated successfully', [
                    'deal_id' => $deal->id,
                    'is_new' => $isNewDeal
                ]);
            });
        } catch (\Exception $e) {
            Log::error('Error creating/updating deal via API', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'email' => $request->input('email'),
                'name' => $request->input('name'),
            ]);
            
            return Reply::error('Failed to create/update deal: ');
        }
    }

    /**
     * Create or update a contact.
     * If a contact exists by email, updates it. Otherwise, creates a new contact.
     *
     * @param CreateOrUpdateContactRequest $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function createOrUpdateContact(CreateOrUpdateContactRequest $request)
    {
        try {
            return DB::transaction(function () use ($request) {
                $companyId = $request->header('X-COMPANY-ID');
 
                if (!$companyId) {
                    return Reply::error(__('messages.missingCompanyId'));
                }
                
                $companyId = (int) $companyId;
                
                // Check if contact already exists by email (most reliable identifier)
                $existingContact = null;
                if ($request->has('email') && !empty($request->email)) {
                    $existingContact = Lead::where('company_id', $companyId)
                        ->where('client_email', $request->email)
                        ->first();
                }

                // If not found by email, check by name and email combination
                if (!$existingContact && $request->has('name') && $request->has('email') && !empty($request->name) && !empty($request->email)) {
                    $existingContact = Lead::where('company_id', $companyId)
                        ->where('client_name', $request->name)
                        ->where('client_email', $request->email)
                        ->first();
                }

                $isNewContact = !$existingContact;

                if ($isNewContact) {
                    // Create new contact
                    $contact = new Lead();
                    $contact->company_id = $companyId;
                    $contact->client_name = $request->name;
                    $contact->client_email = $request->email;
                    $contact->mobile = $request->phone;
                    
                    // Set source_id if provided (must be valid lead_source_id)
                    if ($request->has('lead_source_id') && !empty($request->lead_source_id)) {
                        $contact->source_id = $request->lead_source_id;
                    }
                    
                    // Set lead_owner if provided (user_id directly, not agent_id)
                    if ($request->has('lead_owner_id') && !empty($request->lead_owner_id)) {
                        $contact->lead_owner = $request->lead_owner_id;
                    }
                    
                    $contact->saveQuietly();
                    $contactId = $contact->id;
                } else {
                    // Update existing contact
                    $updated = false;
                    if ($request->has('name') && !empty($request->name) && $existingContact->client_name !== $request->name) {
                        $existingContact->client_name = $request->name;
                        $updated = true;
                    }
                    if ($request->has('phone') && !empty($request->phone) && $existingContact->mobile !== $request->phone) {
                        $existingContact->mobile = $request->phone;
                        $updated = true;
                    }
                    // Update source_id if provided (must be valid lead_source_id)
                    if ($request->has('lead_source_id') && !empty($request->lead_source_id)) {
                        if ($existingContact->source_id != $request->lead_source_id) {
                            $existingContact->source_id = $request->lead_source_id;
                            $updated = true;
                        }
                    }
                    // Update lead_owner if provided (user_id directly, not agent_id)
                    if ($request->has('lead_owner_id') && !empty($request->lead_owner_id)) {
                        if ($existingContact->lead_owner != $request->lead_owner_id) {
                            $existingContact->lead_owner = $request->lead_owner_id;
                            $updated = true;
                        }
                    }
                    if ($updated) {
                        $existingContact->saveQuietly();
                    }
                    $contactId = $existingContact->id;
                }

                // Save UTM information if provided
                $this->saveUtmInfo($contactId, $request);

                return Reply::successWithData($isNewContact ? 'Contact created successfully' : 'Contact updated successfully', [
                    'contact_id' => $contactId,
                    'is_new' => $isNewContact
                ]);
            });
        } catch (\Exception $e) {
            Log::error('Error creating/updating contact via API', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'email' => $request->input('email'),
            ]);
            
            return Reply::error('Failed to create/update contact: ');
        }
    }

    /**
     * Checks if contact already exists by email, otherwise creates a new contact.
     *
     * @param Request $request
     * @param int $companyId
     * @return int
     */
    private function resolveContact(Request $request, int $companyId): int
    {
        // Check if contact already exists by email (most reliable identifier)
        if ($request->has('email') && !empty($request->email)) {
            $existingContact = Lead::where('company_id', $companyId)
                ->where('client_email', $request->email)
                ->first();
            
            if ($existingContact) {
                // Update contact info if provided
                $updated = false;
                if ($request->has('name') && !empty($request->name) && $existingContact->client_name !== $request->name) {
                    $existingContact->client_name = $request->name;
                    $updated = true;
                }
                if ($request->has('phone') && !empty($request->phone) && $existingContact->mobile !== $request->phone) {
                    $existingContact->mobile = $request->phone;
                    $updated = true;
                }
                // Update source_id if provided
                $sourceId = $this->resolveSourceId($request, $companyId);
                if ($sourceId && $existingContact->source_id !== $sourceId) {
                    $existingContact->source_id = $sourceId;
                    $updated = true;
                }
                if ($updated) {
                    $existingContact->saveQuietly();
                }
                return $existingContact->id;
            }
        }

        // Check by name and email combination as fallback
        if ($request->has('name') && $request->has('email') && !empty($request->name) && !empty($request->email)) {
            $existingContact = Lead::where('company_id', $companyId)
                ->where('client_name', $request->name)
                ->where('client_email', $request->email)
                ->first();
            
            if ($existingContact) {
                // Update phone if provided and different
                $updated = false;
                if ($request->has('phone') && !empty($request->phone) && $existingContact->mobile !== $request->phone) {
                    $existingContact->mobile = $request->phone;
                    $updated = true;
                }
                // Update source_id if provided
                $sourceId = $this->resolveSourceId($request, $companyId);
                if ($sourceId && $existingContact->source_id !== $sourceId) {
                    $existingContact->source_id = $sourceId;
                    $updated = true;
                }
                if ($updated) {
                    $existingContact->saveQuietly();
                }
                return $existingContact->id;
            }
        }

        // Create new contact if not found
        $contact = new Lead();
        $contact->company_id = $companyId;
        $contact->client_name = $request->name;
        $contact->client_email = $request->email;
        $contact->mobile = $request->phone;
        
        // Resolve and set source_id if provided
        $sourceId = $this->resolveSourceId($request, $companyId);
        if ($sourceId) {
            $contact->source_id = $sourceId;
        }
        
        $contact->saveQuietly();

        return $contact->id;
    }

    /**
     * Get the first stage ID in a pipeline (lowest priority).
     *
     * @param int $pipelineId
     * @param int $companyId
     * @return int
     */
    private function getFirstStageinpipeline(int $pipelineId, int $companyId): int
    {
        $pipeline = LeadPipeline::where('company_id', $companyId)->where('id', $pipelineId)->first();
        
        if (!$pipeline) {
            throw new \Exception("Pipeline with ID {$pipelineId} not found for company {$companyId}");
        }

        // Get the first stage (lowest priority)
        $firstStage = $pipeline->stages()->orderBy('priority', 'asc')->first();
        
        if (!$firstStage) {
            throw new \Exception("No stages found for pipeline {$pipelineId}");
        }

        return $firstStage->id;
    }

    /**
     * Save UTM information and marketing data to the contact's marketing record.
     *
     * @param int $contactId
     * @param Request $request
     * @return void
     */
    private function saveUtmInfo(int $contactId, Request $request): void
    {
        $contact = Lead::find($contactId);
        
        if (!$contact) {
            return;
        }

        $marketingPayload = [];

        // Extract UTM data from utmInfo object if present
        if ($request->has('utmInfo') && is_array($request->utmInfo)) {
            $utmInfo = $request->utmInfo;
            $marketingPayload = [
                'utm_source' => Arr::get($utmInfo, 'source'),
                'utm_medium' => Arr::get($utmInfo, 'medium'),
                'utm_campaign' => Arr::get($utmInfo, 'utm_campaign') ?? Arr::get($utmInfo, 'campaign'),
                'utm_term' => Arr::get($utmInfo, 'term'),
                'utm_content' => Arr::get($utmInfo, 'content'),
            ];
        }

        // Get Facebook and traffic source fields from root level only
        $rootLevelFields = [
            'facebook_click_id' => $request->input('facebook_click_id') ?? $request->input('facebookClickId'),
            'facebook_lead_id' => $request->input('facebook_lead_id') ?? $request->input('facebookLeadId'),
        ];

        // Merge root level fields into marketing payload
        foreach ($rootLevelFields as $key => $value) {
            if ($value !== null) {
                $marketingPayload[$key] = $value;
            }
        }

        // Get engagement tracking fields
        $engagementFields = [
            'has_registered_for_the_webinar' => $request->input('has_registered_for_the_webinar'),
            'has_joined_the_facebook_group' => $request->input('has_joined_the_facebook_group'),
            'has_downloaded_the_ebook' => $request->input('has_downloaded_the_ebook'),
            'has_attended_the_webinar' => $request->input('has_attended_the_webinar'),
            'registered_for_zoom_meeting' => $request->input('registered_for_zoom_meeting'),
            'last_webinar_date' => $request->input('last_webinar_date'),
            'contact_score' => $request->input('contact_score'),
        ];

        // Merge engagement fields into marketing payload
        foreach ($engagementFields as $key => $value) {
            if ($value !== null) {
                // Convert boolean strings to actual booleans
                if (in_array($key, ['has_registered_for_the_webinar', 'has_joined_the_facebook_group', 
                    'has_downloaded_the_ebook', 'has_attended_the_webinar', 'registered_for_zoom_meeting'])) {
                    $marketingPayload[$key] = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? false;
                } else {
                    $marketingPayload[$key] = $value;
                }
            }
        }

        // Remove null values to avoid overwriting existing data with null
        $marketingPayload = array_filter($marketingPayload, function($value) {
            return $value !== null;
        });

        if (!empty($marketingPayload)) {
            $contact->marketing()->updateOrCreate(
                ['lead_id' => $contactId],
                $marketingPayload
            );
        }
    }

    /**
     * Resolve source_id from source_name, source_id, or lead_source_id.
     *
     * @param Request $request
     * @param int $companyId
     * @return int|null
     */
    private function resolveSourceId(Request $request, int $companyId): ?int
    {
        // Check for lead_source_id first (most explicit)
        if ($request->has('lead_source_id') && !empty($request->lead_source_id)) {
            $source = LeadSource::where('company_id', $companyId)
                ->where('id', $request->lead_source_id)
                ->first();
            
            if ($source) {
                return $source->id;
            }
        }

        // If source_id is provided directly, validate and return it
        if ($request->has('source_id') && !empty($request->source_id)) {
            $source = LeadSource::where('company_id', $companyId)
                ->where('id', $request->source_id)
                ->first();
            
            if ($source) {
                return $source->id;
            }
        }

        // If source_name is provided, find or create by name (type field)
        if ($request->has('source_name') && !empty($request->source_name)) {
            $source = LeadSource::firstOrCreate(
                [
                    'company_id' => $companyId,
                    'type' => $request->source_name,
                ],
                [
                    'type' => $request->source_name,
                ]
            );

            return $source->id;
        }

        // Also check for 'source' field (alternative name)
        if ($request->has('source') && !empty($request->source)) {
            // Check if it's numeric (ID) or string (name)
            if (is_numeric($request->source)) {
                $source = LeadSource::where('company_id', $companyId)
                    ->where('id', $request->source)
                    ->first();
                
                if ($source) {
                    return $source->id;
                }
            } else {
                // Treat as name
                $source = LeadSource::firstOrCreate(
                    [
                        'company_id' => $companyId,
                        'type' => $request->source,
                    ],
                    [
                        'type' => $request->source,
                    ]
                );

                return $source->id;
            }
        }

        return null;
    }

    /**
     * Resolve agent_id from user_id (deal_owner_id).
     *
     * @param int|null $userId
     * @param int $companyId
     * @return int|null Returns null if user doesn't exist or userId is invalid
     */
    private function resolveAgentId(?int $userId, int $companyId): ?int
    {
        if (!$userId) {
            return null;
        }

        // Check if user exists
        $user = User::find($userId);
        if (!$user) {
            Log::warning('User not found when resolving agent_id', [
                'user_id' => $userId,
                'company_id' => $companyId
            ]);
            return null;
        }

        // Find or create LeadAgent for this user
        $leadAgent = LeadAgent::withoutGlobalScopes()
            ->firstOrCreate(
                [
                    'company_id' => $companyId,
                    'user_id' => $userId,
                ],
                [
                    'status' => 'enabled',
                ]
            );

        return $leadAgent->id;
    }

    /**
     * Upsert Hibarr custom fields for a deal.
     *
     * @param Deal $deal
     * @param Request $request
     * @return void
     */
    private function upsertHibarrFields(Deal $deal, Request $request): void
    {
        $hibarrFields = [
            'budget_range' => $request->input('customerBudget') ?? '',
            'motivation/comment' => $request->input('motivation') ?? '',
        ];

        HibarrDealFields::updateOrCreate(
            ['deal_id' => $deal->id],
            $hibarrFields
        );
    }

    /**
     * Resolve package_id from package_id or package_name.
     *
     * @param Request $request
     * @param int $companyId
     * @return int
     */
    private function resolvePackageId(Request $request, int $companyId): int
    {
        // First check if package_id is provided directly
        if ($request->has('package_id') && is_numeric($request->package_id)) {
            $package = Package::where('company_id', $companyId)->where('id', $request->package_id)->first();
            if ($package) {
                return $package->id;
            }
        }

        // Fallback to package_name if provided
        if ($request->has('package_name')) {
            $package = Package::where('company_id', $companyId)->where('name', $request->input('package_name'))->first();
            if ($package) {
                return $package->id;
            }
        }

        return 1;
    }

    /**
     * Create a meeting (DealFollowUp) for a deal.
     *
     * @param Deal $deal
     * @param array $meetingData
     * @param int $companyId
     * @return void
     */
    private function createMeeting(Deal $deal, array $meetingData, int $companyId): void
    {
        // Only create if meeting_date is provided
        if (empty($meetingData['meeting_date'])) {
            return;
        }

        // Resolve meeting_type_id
        $meetingTypeId = $this->resolveMeetingTypeId($meetingData, $companyId);

        // Parse meeting_date
        $meetingDate = null;
        if (!empty($meetingData['meeting_date'])) {
            try {
                $meetingDate = \Carbon\Carbon::parse($meetingData['meeting_date']);
            } catch (\Exception $e) {
                Log::warning("Invalid meeting_date format: " . $meetingData['meeting_date']);
                return;
            }
        }

        // Create DealFollowUp
        $followUp = new DealFollowUp();
        $followUp->deal_id = $deal->id;
        $followUp->meeting_type_id = $meetingTypeId;
        $followUp->location = $meetingData['meeting_location'] ?? 'office';
        $followUp->meeting_link = $meetingData['meeting_link'] ?? null;
        $followUp->meeting_id = $meetingData['meeting_id'] ?? null;
        $followUp->next_follow_up_date = $meetingDate;
        $followUp->status = 'scheduled';
        $followUp->added_by = $deal->agent_id ? LeadAgent::find($deal->agent_id)?->user_id : null;
        
        // Save quietly to bypass observers
        $followUp->saveQuietly();
    }

    /**
     * Resolve meeting_type_id from meeting_type (name or ID).
     *
     * @param array $meetingData
     * @param int $companyId
     * @return int|null
     */
    private function resolveMeetingTypeId(array $meetingData, int $companyId): ?int
    {
        if (empty($meetingData['meeting_type'])) {
            return null;
        }

        $meetingType = $meetingData['meeting_type'];

        // Check if it's numeric (ID)
        if (is_numeric($meetingType)) {
            $type = MeetingType::where('id', $meetingType)
                ->where('company_id', $companyId)
                ->first();
            
            if ($type) {
                return $type->id;
            }
        }

        // Treat as name
        $type = MeetingType::where('name', $meetingType)
            ->where('company_id', $companyId)
            ->first();

        if ($type) {
            return $type->id;
        }

        return null;
    }

    /**
     * Send notifications for newly created deal.
     *
     * @param Deal $deal
     * @return void
     */
    private function sendDealCreatedNotifications(Deal $deal): void
    {
        // Reload deal with relationships
        $deal->load('leadAgent.user', 'company');

        if ($deal->agent_id && $deal->leadAgent && $deal->leadAgent->user) {
            // Notify the assigned agent
            event(new DealEvent($deal, $deal->leadAgent, 'LeadAgentAssigned'));
        } else {
            // Notify all admins if no agent is assigned
            $admins = User::allAdmins($deal->company_id);
            if ($admins->isNotEmpty()) {
                Notification::send($admins, new LeadAgentAssigned($deal));
            }
        }
    }
}
