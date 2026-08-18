<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Http\Requests\Contact\CreateOrUpdateContactRequest;
use App\Http\Requests\Deal\CreateDealRequest;
use App\Jobs\ProcessDealRequestJob;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\DealHistory;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadSource;
use App\Models\PipelineStage;
use App\Notifications\LeadOwnerAssigned;
use App\Services\LeadCoreFieldsService;
use Illuminate\Http\Request;
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
            if (! $deal) {
                return Reply::error("Deal with ID {$dealId} not found.");
            }

            // Check if stage exists
            $newStage = PipelineStage::find($newStageId);
            if (! $newStage) {
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
            // Update the deal stage directly without triggering observers.
            //
            // stage_entered_at is normally stamped by DealObserver; set it here
            // because the bypass skips it, and without it the deal reports the
            // dwell time of whatever stage it was in before this one.
            //
            // ponytail: this path still emits no deal_stage_changed crm_event,
            // so its transitions are invisible to the funnel's closed-dwell
            // half (the DealHistory row below is a separate, barely-read
            // trail). Add the event here if this endpoint sees real traffic.
            DB::table('deals')
                ->where('id', $dealId)
                ->update([
                    'pipeline_stage_id' => $newStageId,
                    'stage_entered_at' => now(),
                ]);

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
                'responsible_user_name' => $deal->leadAgent && $deal->leadAgent->user ? $deal->leadAgent->user->name : 'Unknown',
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
     * @return \Illuminate\Http\JsonResponse
     */
    public function createDeal(CreateDealRequest $request)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');

            if (! $companyId) {
                return Reply::error(__('messages.missingCompanyId'));
            }

            // Validate that company ID is a valid positive integer
            if (! is_numeric($companyId) || (int) $companyId <= 0) {
                return Reply::error(__('messages.invalidCompanyId'));
            }

            $companyId = (int) $companyId;

            // Resolve contact ID (this is fast and doesn't need to be queued)
            $contactId = $request->input('lead_id') ?? null;
            if (! $contactId) {
                $contactId = $this->resolveContact($request, $companyId);
            } else {
                // lead_id bypasses resolveContact — still apply optional lead fields / CFs
                $existingLead = Lead::where('company_id', $companyId)->find($contactId);
                if ($existingLead) {
                    if ($this->applyLeadOptionalFields($existingLead, $request)) {
                        $existingLead->saveQuietly();
                    }
                    $this->applyLeadCustomFields($existingLead, $request);
                }
            }

            // Save UTM information if provided (also fast)
            $this->saveUtmInfo($contactId, $request);

            // Process synchronously in the web request so assignment uses current app code.
            // Async queue workers can run stale code until restarted, which skipped
            // lead owner and participant assignment even after service fixes.
            ProcessDealRequestJob::dispatchSync($contactId, $companyId, $request->all());

            Log::info('Deal creation request processed synchronously', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'email' => $request->input('email'),
            ]);

            // Return 200 OK - request accepted for processing
            return response()->json([
                'status' => 'accepted',
                'message' => 'Deal creation request is being processed.',
                'contact_id' => $contactId,
                'company_id' => $companyId,
            ], 200);

        } catch (\Exception $e) {
            Log::error('Failed to process deal creation request', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'email' => $request->input('email'),
                'name' => $request->input('name'),
            ]);

            // Return generic error message to avoid exposing sensitive information
            // Exception details are logged above for debugging
            return Reply::error('Failed to process deal creation request');
        }
    }

    /**
     * Create or update a contact.
     * If a contact exists by email, updates it. Otherwise, creates a new contact.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function createOrUpdateContact(CreateOrUpdateContactRequest $request)
    {
        try {
            return DB::transaction(function () use ($request) {
                $companyId = $request->header('X-COMPANY-ID');

                if (! $companyId) {
                    return Reply::error(__('messages.missingCompanyId'));
                }

                $companyId = (int) $companyId;
                $updateAgentIfExists = $request->boolean('update_agent_if_exists', false);
                $notify = $request->boolean('notify', false);

                // Check if contact already exists by email (most reliable identifier)
                $existingContact = null;
                if ($request->has('email') && ! empty($request->email)) {
                    $existingContact = Lead::where('company_id', $companyId)
                        ->where('client_email', $request->email)
                        ->first();
                }

                // If not found by email, check by name and email combination
                if (! $existingContact && $request->has('name') && $request->has('email') && ! empty($request->name) && ! empty($request->email)) {
                    $existingContact = Lead::where('company_id', $companyId)
                        ->where('client_name', $request->name)
                        ->where('client_email', $request->email)
                        ->first();
                }

                $isNewContact = ! $existingContact;

                if ($isNewContact) {
                    // Create new contact
                    $contact = new Lead;
                    $contact->company_id = $companyId;
                    $contact->added_by = 1;
                    $contact->client_name = $request->name;
                    $contact->client_email = $request->email;
                    $contact->mobile = $request->phone;
                    $contact->gender = ($request->has('gender') && in_array($request->gender, ['male', 'female'])) ? $request->gender : null;

                    // Set source_id if provided (must be valid lead_source_id)
                    if ($request->has('lead_source_id') && ! empty($request->lead_source_id)) {
                        $contact->source_id = $request->lead_source_id;
                    }

                    // Set lead_owner if provided (user_id directly, not agent_id)
                    if ($request->has('lead_owner_id') && ! empty($request->lead_owner_id)) {
                        $contact->lead_owner = $request->lead_owner_id;
                    }

                    $this->applyAddressAndDobToLead($contact, $request);
                    $this->applyLeadOptionalFields($contact, $request);
                    $this->applyReferralAgentToNewLead($contact, $request);
                    $this->saveContact($contact, $request, $notify);
                    $this->applyLeadCategories($contact, $request, true);
                    $this->applyLeadCustomFields($contact, $request);
                    $contactId = $contact->id;
                } else {
                    // Update existing contact
                    $updated = false;
                    if ($request->has('name') && ! empty($request->name) && $existingContact->client_name !== $request->name) {
                        $existingContact->client_name = $request->name;
                        $updated = true;
                    }
                    if ($request->has('phone') && ! empty($request->phone) && $existingContact->mobile !== $request->phone) {
                        $existingContact->mobile = $request->phone;
                        $updated = true;
                    }
                    if ($request->has('gender') && $existingContact->gender?->value !== $request->gender) {
                        $existingContact->gender = $request->gender;
                        $updated = true;
                    }
                    // Update source_id if provided (must be valid lead_source_id)
                    if ($request->has('lead_source_id') && ! empty($request->lead_source_id)) {
                        if ($existingContact->source_id != $request->lead_source_id) {
                            $existingContact->source_id = $request->lead_source_id;
                            $updated = true;
                        }
                    }
                    // Update lead_owner if provided (user_id directly, not agent_id)
                    if ($request->has('lead_owner_id') && ! empty($request->lead_owner_id)) {
                        if (! $existingContact->lead_owner && $updateAgentIfExists) {
                            $existingContact->lead_owner = $request->lead_owner_id;
                            $updated = true;
                        }
                    }
                    if ($this->applyLeadCategories($existingContact, $request, false)) {
                        $updated = true;
                    }
                    if ($this->applyAddressAndDobToLead($existingContact, $request)) {
                        $updated = true;
                    }
                    if ($this->applyLeadOptionalFields($existingContact, $request)) {
                        $updated = true;
                    }
                    if ($updated) {
                        $this->saveContact($existingContact, $request, $notify);
                    }
                    $this->applyLeadCustomFields($existingContact, $request);
                    $contactId = $existingContact->id;
                }

                // Save UTM information if provided
                $this->saveUtmInfo($contactId, $request);

                $savedContact = Lead::query()->find($contactId);
                $preferredContactTimes = $savedContact?->resolvedPreferredContactTimes() ?? [];

                return Reply::successWithData($isNewContact ? 'Contact created successfully' : 'Contact updated successfully', [
                    'contact_id' => $contactId,
                    'is_new' => $isNewContact,
                    'preferred_contact_times' => $preferredContactTimes,
                    'preferred_contact_time' => $preferredContactTimes[0] ?? null,
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
     */
    private function resolveContact(Request $request, int $companyId): int
    {
        // Check if contact already exists by email (most reliable identifier)
        if ($request->has('email') && ! empty($request->email)) {
            $existingContact = Lead::where('company_id', $companyId)
                ->where('client_email', $request->email)
                ->first();

            if ($existingContact) {
                // Update contact info if provided
                $updated = false;
                if ($request->has('name') && ! empty($request->name) && $existingContact->client_name !== $request->name) {
                    $existingContact->client_name = $request->name;
                    $updated = true;
                }
                if ($request->has('phone') && ! empty($request->phone) && $existingContact->mobile !== $request->phone) {
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
                if ($this->applyLeadOptionalFields($existingContact, $request)) {
                    $updated = true;
                }
                if ($updated) {
                    $existingContact->saveQuietly();
                }
                $this->applyLeadCustomFields($existingContact, $request);

                return $existingContact->id;
            }
        }

        // Check by name and email combination as fallback
        if ($request->has('name') && $request->has('email') && ! empty($request->name) && ! empty($request->email)) {
            $existingContact = Lead::where('company_id', $companyId)
                ->where('client_name', $request->name)
                ->where('client_email', $request->email)
                ->first();

            if ($existingContact) {
                // Update phone if provided and different
                $updated = false;
                if ($request->has('phone') && ! empty($request->phone) && $existingContact->mobile !== $request->phone) {
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
                if ($this->applyLeadOptionalFields($existingContact, $request)) {
                    $updated = true;
                }
                if ($updated) {
                    $existingContact->saveQuietly();
                }
                $this->applyLeadCustomFields($existingContact, $request);

                return $existingContact->id;
            }
        }

        // Create new contact if not found
        $contact = new Lead;
        $contact->company_id = $companyId;
        $contact->added_by = 1;
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
        $this->applyLeadOptionalFields($contact, $request);
        $this->applyReferralAgentToNewLead($contact, $request);
        $contact->saveQuietly();
        $this->applyLeadCustomFields($contact, $request);

        return $contact->id;
    }

    /**
     * Save a lead contact, optionally firing model observers for notifications.
     */
    private function saveContact(Lead $contact, Request $request, bool $notify): void
    {
        if (! $notify) {
            $contact->saveQuietly();

            return;
        }

        // LeadObserver::creating overwrites added_by when no authenticated user is present.
        if ($contact->added_by) {
            $request->merge(['added_by' => $contact->added_by]);
        }

        $contact->save();

        if ($contact->wasRecentlyCreated && $contact->lead_owner) {
            $this->notifyLeadOwnerOnCreate($contact);
        }
    }

    /**
     * Notify the assigned owner when a new lead is created via the API.
     */
    private function notifyLeadOwnerOnCreate(Lead $contact): void
    {
        $owner = $contact->leadOwner;
        if (! $owner) {
            return;
        }

        DB::afterCommit(function () use ($owner, $contact) {
            try {
                Notification::send($owner, new LeadOwnerAssigned($contact));
            } catch (\Throwable $e) {
                Log::error('Failed to notify lead owner after contact creation', [
                    'lead_id' => $contact->id,
                    'owner_id' => $owner->id,
                    'error' => $e->getMessage(),
                ]);
            }
        });
    }

    /**
     * Apply address fields and date_of_birth from request to a lead.
     * Returns true if any attribute was changed.
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

        $coreFieldsService = app(LeadCoreFieldsService::class);
        $corePayload = [];

        if ($request->has('date_of_birth')) {
            $corePayload['date_of_birth'] = $request->input('date_of_birth');
        }
        if ($request->has('languages')) {
            $corePayload['languages'] = $request->input('languages');
        }
        if ($request->has('nationality')) {
            $corePayload['nationality'] = $request->input('nationality');
        }
        if ($request->has('occupation')) {
            $corePayload['occupation'] = $request->input('occupation');
        }

        if ($corePayload !== [] && $coreFieldsService->useCoreFields()) {
            $before = $coreFieldsService->read($lead);
            $coreFieldsService->write($lead, $corePayload);
            $after = $coreFieldsService->read($lead);

            if ($before !== $after) {
                $updated = true;
            }
        }

        return $updated;
    }

    /**
     * Apply optional lead classification fields (temperature, preferred contact time, lifecycle status).
     * Returns true if any attribute was changed.
     * WhatsApp group membership is applied via saveUtmInfo (marketing record).
     */
    private function applyLeadOptionalFields(Lead $lead, Request $request): bool
    {
        $updated = false;

        if ($request->filled('temperature')) {
            $temperature = $request->input('temperature');
            $current = $lead->temperature?->value ?? $lead->temperature;
            if ((string) $current !== (string) $temperature) {
                $lead->temperature = $temperature;
                $updated = true;
            }
        }

        if (Lead::applyPreferredContactTimesFromRequest($lead, $request)) {
            $updated = true;
        }

        if ($request->filled('lead_lifecycle_status_id')) {
            $statusId = (int) $request->input('lead_lifecycle_status_id');
            if ((int) $lead->lead_lifecycle_status_id !== $statusId) {
                $lead->lead_lifecycle_status_id = $statusId;
                $updated = true;
            }
        }

        return $updated;
    }

    /**
     * Set referred_by_agent_id when the ID is a LeadAgent in the lead's company.
     * Invalid, missing, or cross-company IDs are ignored.
     */
    private function applyReferralAgentToNewLead(Lead $lead, Request $request): void
    {
        $referralAgentId = $request->input('referral_agent_id', $request->input('referal_agent_id'));
        if ($referralAgentId === null || $referralAgentId === '') {
            return;
        }

        if (! is_numeric($referralAgentId) || ! $lead->company_id) {
            return;
        }

        $agent = LeadAgent::query()
            ->where('company_id', $lead->company_id)
            ->whereKey((int) $referralAgentId)
            ->first();

        if ($agent === null) {
            return;
        }

        $lead->referred_by_agent_id = $agent->id;
    }

    /**
     * Upsert lead custom fields from lead_custom_fields (and custom_fields alias on contact create).
     * Format: {"131": "value", "132": ["a","b"]} — keys are custom field IDs.
     * Only Lead-group fields for the contact's company are accepted.
     */
    private function applyLeadCustomFields(Lead $lead, Request $request): void
    {
        if (! $lead->id) {
            return;
        }

        $payload = [];

        if ($request->has('lead_custom_fields') && is_array($request->input('lead_custom_fields'))) {
            $payload = $request->input('lead_custom_fields');
        }

        // Contact-only alias — deal create keeps custom_fields for deal CFs
        if ($request instanceof CreateOrUpdateContactRequest
            && $request->has('custom_fields')
            && is_array($request->input('custom_fields'))
        ) {
            $payload = array_replace($payload, $request->input('custom_fields'));
        }

        if ($payload === []) {
            return;
        }

        $leadGroup = CustomFieldGroup::where('company_id', $lead->company_id)
            ->where('model', Lead::CUSTOM_FIELD_MODEL)
            ->first();

        if (! $leadGroup) {
            return;
        }

        $allowedIds = CustomField::where('custom_field_group_id', $leadGroup->id)
            ->pluck('id')
            ->map(fn ($id) => (string) $id)
            ->all();

        $customFieldsData = [];
        foreach ($payload as $fieldId => $value) {
            $fieldId = (string) $fieldId;
            if ($value === null || ! in_array($fieldId, $allowedIds, true)) {
                continue;
            }
            $customFieldsData['field_'.$fieldId] = $value;
        }

        if ($customFieldsData === []) {
            return;
        }

        try {
            $lead->updateCustomFieldData($customFieldsData, $lead->company_id);
        } catch (\Exception $e) {
            Log::error('DealContactApi: Error updating lead custom fields', [
                'lead_id' => $lead->id,
                'error' => $e->getMessage(),
            ]);
        }
    }

    /**
     * Save UTM information and marketing data to the contact's marketing record.
     */
    private function saveUtmInfo(int $contactId, Request $request): void
    {
        $contact = Lead::find($contactId);

        if (! $contact) {
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
            'has_joined_the_whatsapp_group' => $request->input('has_joined_the_whatsapp_group'),
            'registered_for_zoom_meeting' => $request->input('registered_for_zoom_meeting'),
            'last_webinar_date' => $request->input('last_webinar_date'),
            'contact_score' => $request->input('contact_score'),
        ];

        // Merge engagement fields into marketing payload
        foreach ($engagementFields as $key => $value) {
            if ($value !== null) {
                // Convert boolean strings to actual booleans
                if (in_array($key, [
                    'has_registered_for_the_webinar',
                    'has_joined_the_facebook_group',
                    'has_downloaded_the_ebook',
                    'has_attended_the_webinar',
                    'has_joined_the_whatsapp_group',
                    'registered_for_zoom_meeting',
                ], true)) {
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
        $marketingPayload = array_filter($marketingPayload, function ($value) {
            return $value !== null;
        });

        if (! empty($marketingPayload)) {
            $contact->marketing()->updateOrCreate(
                ['lead_id' => $contactId],
                $marketingPayload
            );
        }
    }

    /**
     * Resolve source_id from source_name, source_id, or lead_source_id.
     */
    private function resolveSourceId(Request $request, int $companyId): ?int
    {
        // Check for lead_source_id first (most explicit)
        if ($request->has('lead_source_id') && ! empty($request->lead_source_id)) {
            $source = LeadSource::where('company_id', $companyId)
                ->where('id', $request->lead_source_id)
                ->first();

            if ($source) {
                return $source->id;
            }
        }

        // If source_id is provided directly, validate and return it
        if ($request->has('source_id') && ! empty($request->source_id)) {
            $source = LeadSource::where('company_id', $companyId)
                ->where('id', $request->source_id)
                ->first();

            if ($source) {
                return $source->id;
            }
        }

        // If source_name is provided, find or create by name (type field)
        if ($request->has('source_name') && ! empty($request->source_name)) {
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
        if ($request->has('source') && ! empty($request->source)) {
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
     * Sync taxonomy categories onto a saved lead.
     * `lead_category_ids` replaces the full set; legacy `lead_category_id` only
     * applies when the contact has no primary category yet.
     */
    private function applyLeadCategories(Lead $contact, Request $request, bool $isNewContact): bool
    {
        if (! $contact->id) {
            return false;
        }

        if ($request->has('lead_category_ids')) {
            $contact->syncCategories($this->normalizeLeadCategoryIdsFromRequest($request) ?? []);

            return true;
        }

        if (! $request->has('lead_category_id') || empty($request->lead_category_id)) {
            return false;
        }

        if ($isNewContact || ! $contact->category_id) {
            $contact->syncCategories([(int) $request->lead_category_id]);

            return true;
        }

        return false;
    }

    /**
     * @return list<int>|null
     */
    private function normalizeLeadCategoryIdsFromRequest(Request $request): ?array
    {
        if ($request->has('lead_category_ids')) {
            $raw = $request->input('lead_category_ids', []);
            if (! is_array($raw)) {
                $raw = $raw === null || $raw === '' ? [] : [$raw];
            }

            return array_values(array_unique(array_filter(
                array_map(static fn ($id) => $id === null || $id === '' ? null : (int) $id, $raw),
                static fn ($id) => $id !== null && $id > 0
            )));
        }

        if ($request->has('lead_category_id')) {
            $id = $request->input('lead_category_id');

            return $id === null || $id === '' ? [] : [(int) $id];
        }

        return null;
    }
}
