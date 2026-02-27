<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Jobs\ProcessDealRequestJob;
use App\Models\Deal;
use App\Models\DealHistory;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Http\Requests\Deal\CreateDealRequest;
use App\Http\Requests\Contact\CreateOrUpdateContactRequest;
use App\Services\DealCreationService;
use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;


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
            $companyId = $request->header('X-COMPANY-ID');
            
            if (!$companyId) {
                return Reply::error(__('messages.missingCompanyId'));
            }
            
            // Validate that company ID is a valid positive integer
            if (!is_numeric($companyId) || (int) $companyId <= 0) {
                return Reply::error(__('messages.invalidCompanyId'));
            }
            
            $companyId = (int) $companyId;
            
            // Resolve contact ID (this is fast and doesn't need to be queued)
            $contactId = $request->input('lead_id') ?? null;
            if (!$contactId) {
                $contactId = $this->resolveContact($request, $companyId);
            }
            
            // Save UTM information if provided (also fast)
            $this->saveUtmInfo($contactId, $request);

            // Process deal asynchronously via queued job to avoid blocking HTTP workers
            // The job will handle transaction management and cache locks
            ProcessDealRequestJob::dispatch($contactId, $companyId, $request->all());
            
            Log::info('Deal creation request enqueued for async processing', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'email' => $request->input('email'),
            ]);
            
            // Return 202 Accepted - request accepted for processing
            return response()->json([
                'status' => 'accepted',
                'message' => 'Deal creation request has been queued for processing.',
                'contact_id' => $contactId,
                'company_id' => $companyId,
            ], 202);
            
        } catch (\Exception $e) {
            // Catch exceptions from validation or job dispatch
            // Note: Deal processing happens asynchronously in the job, so exceptions
            // from processDeal() will be handled by the job's retry mechanism
            Log::error('Failed to enqueue deal creation request', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'email' => $request->input('email'),
                'name' => $request->input('name'),
            ]);
            
            // Return generic error message to avoid exposing sensitive information
            // Exception details are logged above for debugging
            return Reply::error('Failed to enqueue deal creation request');
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
                    $contact->gender = ($request->has('gender') && in_array($request->gender, ['male', 'female'])) ? $request->gender : null;
                    
                    // Set source_id if provided (must be valid lead_source_id)
                    if ($request->has('lead_source_id') && !empty($request->lead_source_id)) {
                        $contact->source_id = $request->lead_source_id;
                    }
                    
                    // Set lead_owner if provided (user_id directly, not agent_id)
                    if ($request->has('lead_owner_id') && !empty($request->lead_owner_id)) {
                        $contact->lead_owner = $request->lead_owner_id;
                    }
                    $this->applyAddressAndDobToLead($contact, $request);
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
                    if ($request->has('gender') && $existingContact->gender?->value !== $request->gender) {
                        $existingContact->gender = $request->gender;
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
                    if ($this->applyAddressAndDobToLead($existingContact, $request)) {
                        $updated = true;
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
                if ($request->has('gender') && $existingContact->gender?->value !== $request->gender) {
                    $existingContact->gender = $request->gender;
                    $updated = true;
                }
                // Update source_id if provided
                $sourceId = $this->resolveSourceId($request, $companyId);
                if ($sourceId && $existingContact->source_id !== $sourceId) {
                    $existingContact->source_id = $sourceId;
                    $updated = true;
                }
                if ($this->applyAddressAndDobToLead($existingContact, $request)) {
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
                if ($request->has('gender') && $existingContact->gender?->value !== $request->gender) {
                    $existingContact->gender = $request->gender;
                    $updated = true;
                }
                // Update source_id if provided
                $sourceId = $this->resolveSourceId($request, $companyId);
                if ($sourceId && $existingContact->source_id !== $sourceId) {
                    $existingContact->source_id = $sourceId;
                    $updated = true;
                }
                if ($this->applyAddressAndDobToLead($existingContact, $request)) {
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
        $contact->gender = ($request->has('gender') && in_array($request->gender, ['male', 'female'])) ? $request->gender : null;
        
        // Resolve and set source_id if provided
        $sourceId = $this->resolveSourceId($request, $companyId);
        if ($sourceId) {
            $contact->source_id = $sourceId;
        }
        $this->applyAddressAndDobToLead($contact, $request);
        $contact->saveQuietly();

        return $contact->id;
    }

    /**
     * Apply address fields and date_of_birth from request to a lead.
     * Returns true if any attribute was changed.
     *
     * @param \App\Models\Lead $lead
     * @param Request $request
     * @return bool
     */
    private function applyAddressAndDobToLead(Lead $lead, Request $request): bool
    {
        $updated = false;
        $fields = [
            'address' => 'address',
            'city' => 'city',
            'state' => 'state',
            'country' => 'country',
            'postal_code' => 'postal_code',
        ];
        foreach ($fields as $requestKey => $attribute) {
            if ($request->has($requestKey)) {
                $value = $request->input($requestKey);
                if ((string) $lead->getAttribute($attribute) !== (string) $value) {
                    $lead->setAttribute($attribute, $value);
                    $updated = true;
                }
            }
        }
        if ($request->has('date_of_birth')) {
            $value = $request->input('date_of_birth');
            $parsed = $value ? \Carbon\Carbon::parse($value)->startOfDay() : null;
            $current = $lead->date_of_birth?->startOfDay();
            if ($parsed?->format('Y-m-d') !== $current?->format('Y-m-d')) {
                $lead->date_of_birth = $parsed;
                $updated = true;
            }
        }
        return $updated;
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

        // Get Facebook and lead source tracking fields from root level only
        $rootLevelFields = [
            'facebook_click_id' => $request->input('facebook_click_id') ?? $request->input('facebookClickId'),
            'facebook_lead_id' => $request->input('facebook_lead_id') ?? $request->input('facebookLeadId'),
            'facebook_browser_id' => $request->input('facebook_browser_id') ?? $request->input('facebookBrowserId'),
            'user_agent' => $request->input('user_agent'),
            'ip_address' => $request->input('ip_address'),
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
                } 
                // Parse date fields properly
                elseif ($key === 'last_webinar_date') {
                    try {
                        $marketingPayload[$key] = \Carbon\Carbon::parse($value);
                    } catch (\Exception $e) {
                        Log::warning('DealContactApi: Invalid last_webinar_date format', [
                            'value' => $value,
                            'error' => $e->getMessage(),
                        ]);
                        // Skip invalid date instead of adding it
                    }
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
}
