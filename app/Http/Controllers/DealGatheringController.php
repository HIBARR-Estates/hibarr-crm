<?php

namespace App\Http\Controllers;

use App\Enums\DealUpdateType;
use App\Enums\Salutation;
use App\Helper\Files;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadSource;
use App\Services\DealGatheringService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Enum;

class DealGatheringController extends AccountBaseController
{
    protected $service;

    public function __construct(DealGatheringService $service)
    {
        parent::__construct();
        $this->service = $service;
    }

    /**
     * Step 1: Initialize Deal (Search/Create Lead & Create Deal)
     * Also handles updating existing deal's lead association
     */
    public function init(Request $request)
    {
        $request->validate([
            'deal_id' => 'nullable|exists:deals,id',
            'lead_id' => 'nullable|exists:leads,id',
            'lead_data' => 'nullable|array',
            'lead_type' => 'nullable|in:agent,client',
            'pipeline_id' => [
                Rule::requiredIf(! $request->filled('deal_id')),
                'exists:lead_pipelines,id',
            ],
        ]);

        // Get the pipeline ID from the request (for new deal creation)
        $pipelineId = $request->filled('pipeline_id') ? (int) $request->pipeline_id : null;

        // Determine if we're updating an existing deal or creating new
        $existingDeal = $request->filled('deal_id')
            ? Deal::findOrFail($request->deal_id)
            : null;

        // Prevent modifications to locked deals
        if ($existingDeal && $existingDeal->isLocked()) {
            return response()->json([
                'status' => 'error',
                'message' => __('messages.dealLocked'),
            ], 403);
        }

        // Get or create the lead
        if ($request->filled('lead_id')) {
            // Using an existing lead (either same or different from current)
            $lead = Lead::findOrFail($request->lead_id);

            // If updating an existing deal with a different lead
            if ($existingDeal && $existingDeal->lead_id !== $lead->id) {
                $existingDeal = $this->service->updateDealLead($existingDeal, $lead);
            }
        } elseif ($request->filled('lead_data')) {
            // Creating new lead or updating existing lead's info
            $salutationValues = array_column(Salutation::cases(), 'value');

            $rules = [
                'lead_data.name' => 'required|string',
                'lead_data.email' => 'nullable|email',
                'lead_data.phone' => 'nullable|string',
                'lead_data.salutation' => ['nullable', 'string', Rule::in($salutationValues)],
                'lead_data.gender' => 'nullable|in:male,female',
                'lead_data.lead_source_id' => 'nullable|integer',
                'lead_data.address' => 'nullable|string',
                'lead_data.postal_code' => 'nullable|string',
                'lead_data.city' => 'nullable|string',
                'lead_data.state' => 'nullable|string',
                'lead_data.country' => 'nullable|string',
            ];

            if ($request->lead_type === 'agent') {
                $rules['lead_data.company_name'] = 'required|string';
            }

            $request->validate($rules);

            if ($request->filled('lead_data.lead_source_id')) {
                $sourceExists = LeadSource::query()
                    ->where('id', $request->input('lead_data.lead_source_id'))
                    ->where('company_id', company()->id)
                    ->exists();

                if (! $sourceExists) {
                    return response()->json([
                        'status' => 'error',
                        'message' => 'Lead source not found.',
                        'errors' => [
                            'lead_data.lead_source_id' => ['The selected lead source does not exist.'],
                        ],
                    ], 404);
                }
            }

            // If we have an existing deal, update its lead; otherwise create new
            if ($existingDeal) {
                $lead = $this->service->updateLead($existingDeal->lead_id, $request->lead_data);
                // Update deal name to match updated lead info
                $existingDeal->update(['name' => 'New Deal - '.$lead->client_name]);
            } else {
                $lead = $this->service->createLead($request->lead_data);
            }
        } else {
            // No lead_id and no lead_data - this shouldn't happen for new deals
            if (! $existingDeal) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'Lead information is required',
                ], 422);
            }
            // For existing deals with no changes, just return current state
            $lead = Lead::findOrFail($existingDeal->lead_id);
        }

        // Create or return existing deal (passing pipeline_id for new deals)
        $deal = $existingDeal ?? $this->service->initializeDeal($lead, $pipelineId);

        return response()->json([
            'status' => 'success',
            'deal' => $deal->fresh(),
            'lead' => $lead->fresh(),
        ]);
    }

    /**
     * Get Steps configuration. Optional query param: pipeline_id (filters steps to that pipeline's categories).
     */
    public function getSteps(Request $request)
    {
        $pipelineId = $request->filled('pipeline_id')
            ? (int) $request->input('pipeline_id')
            : null;
        $stageId = $request->filled('pipeline_stage_id')
            ? (int) $request->input('pipeline_stage_id')
            : null;
        $steps = $this->service->getSteps($pipelineId, $stageId);

        return response()->json([
            'steps' => $steps,
        ]);
    }

    /**
     * Search Leads
     */
    public function searchLeads(Request $request)
    {
        $query = $request->get('query');
        $leads = $this->service->searchLeads($query);

        return response()->json($leads);
    }

    /**
     * Update Deal Step (Custom fields)
     */
    public function updateStep(Request $request, $id)
    {
        $deal = Deal::findOrFail($id);

        if ($deal->isLocked()) {
            return response()->json([
                'status' => 'error',
                'message' => __('messages.dealLocked'),
            ], 403);
        }

        // This relies on CustomFieldsTrait
        if ($request->has('custom_fields_data')) {
            $deal->updateCustomFieldData($request->input('custom_fields_data'));
        }

        return response()->json(['status' => 'success']);
    }

    /**
     * Get Deal's Custom Fields Data.
     *
     * Also used by SaveDealModal edit-from-Index (Task M4).
     * S3 must not land before that fetch path is verified.
     */
    public function getDealCustomFields($id)
    {
        $deal = Deal::findOrFail($id);
        $customFieldsData = $deal->getCustomFieldsData();

        return response()->json([
            'status' => 'success',
            'custom_fields_data' => $customFieldsData,
        ]);
    }

    /**
     * Inline update for deal fields
     */
    public function updateInline(Request $request, $id)
    {
        try {
            // Check if type is present
            $type = $request->input('type');

            if (! $type) {
                return response()->json([
                    'status' => 'error',
                    'message' => 'The type field is required.',
                ], 422);
            }

            // Validate type
            $request->merge(['type' => $type]);
            $request->validate([
                'type' => ['required', new Enum(DealUpdateType::class)],
            ]);

            $deal = Deal::findOrFail($id);

            if ($deal->isLocked()) {
                return response()->json([
                    'status' => 'error',
                    'message' => __('messages.dealLocked'),
                ], 403);
            }

            // Write gate: agent/participant only, matching DealController::patch().
            // Watchers stay view-only — see Deal::hasTeamMemberAccess().
            $editPermission = user()->permission('edit_deals');
            $canEditDeal = $editPermission == 'all'
                || ($editPermission == 'added' && $deal->added_by == user()->id)
                || ($editPermission == 'owned' && $deal->hasTeamMemberAccess(user()->id))
                || ($editPermission == 'both' && ($deal->added_by == user()->id || $deal->hasTeamMemberAccess(user()->id)));

            if (! $canEditDeal) {
                return response()->json([
                    'status' => 'error',
                    'message' => __('messages.permissionDenied'),
                ], 403);
            }

            // Process data to handle file uploads
            $data = $request->input('data', []);
            if (! is_array($data)) {
                $data = [];
            }

            // Files from data.fieldName (FormData) — Laravel may normalize dots to underscores
            foreach ($request->allFiles() as $key => $file) {
                if (str_starts_with($key, 'data.')) {
                    $data[substr($key, 5)] = $file;
                } elseif (str_starts_with($key, 'data_')) {
                    $data[substr($key, 5)] = $file;
                }
            }

            // Files uploaded as data[field_X] or data[field_X][0], [1], etc.
            if ($request->hasFile('data')) {
                $dataFiles = $request->file('data');
                if (is_array($dataFiles)) {
                    foreach ($dataFiles as $fieldKey => $fileOrFiles) {
                        if ($fileOrFiles instanceof \Illuminate\Http\UploadedFile) {
                            $data[$fieldKey] = $fileOrFiles;
                        } elseif (is_array($fileOrFiles)) {
                            $uploadedFiles = [];
                            foreach ($fileOrFiles as $file) {
                                if ($file instanceof \Illuminate\Http\UploadedFile) {
                                    $uploadedFiles[] = $file;
                                }
                            }
                            if (! empty($uploadedFiles)) {
                                $data[$fieldKey] = $uploadedFiles;
                            }
                        }
                    }
                }
            }

            // Flat form keys: data[fieldName]
            foreach ($request->all() as $key => $value) {
                if ($value instanceof \Illuminate\Http\UploadedFile) {
                    continue;
                }

                if (preg_match('/^data\[(.+)\]$/', $key, $matches)) {
                    $data[$matches[1]] = $value;
                }
            }

            if (array_key_exists('package_id', $data) && ($data['package_id'] === null || $data['package_id'] === '')) {
                $data['package_id'] = [];
            }

            if (array_key_exists('name', $data)) {
                if (is_string($data['name'])) {
                    $data['name'] = trim($data['name']);
                }
                validator(['name' => $data['name']], [
                    'name' => 'required|string|min:1|max:255',
                ], [], [
                    'name' => 'deal name',
                ])->validate();
            }

            // Validate that we have some data, except explicit recalculate actions
            if (empty($data) && $type !== DealUpdateType::RECALCULATE_VALUE->value) {
                Log::error('DealGatheringController: No data extracted', [
                    'type' => $type,
                    'has_files' => ! empty($request->allFiles()),
                ]);

                return response()->json([
                    'status' => 'error',
                    'message' => 'No data provided. Please check the request format.',
                ], 422);
            }

            // A commission was already calculated against this deal's value —
            // a narrower block than isLocked() above: everything else stays
            // editable inline, only what feeds the value is refused. Each
            // inline update targets one field at a time (unlike a full-form
            // resubmit), so presence in $data reliably means "the caller is
            // trying to change this" — see Deal::touchesValueFields().
            // recalculate_value has nothing else to do once locked, so it's
            // refused outright rather than special-cased.
            if ($deal->isCommissionLocked() && ($type === DealUpdateType::RECALCULATE_VALUE->value || Deal::touchesValueFields($data))) {
                return response()->json([
                    'status' => 'error',
                    'message' => __('messages.dealValueLockedByCommission'),
                ], 403);
            }

            $updatedDeal = $this->service->updateDealInline(
                $deal,
                DealUpdateType::from($request->type),
                $data
            );

            // Lean path: analysis modal fire-and-forget saves skip the expensive 13-relation
            // refresh and return a minimal acknowledgement so the UI stays snappy.
            if ($request->header('X-Analysis-Lean')) {
                return response()->json(['status' => 'success']);
            }

            // Refresh deal with all relationships and custom fields data.
            // Include leadFlightItineraries so redesign setDeal() patches do not
            // wipe the itinerary tab (same relation set as DealController::loadFullDeal).
            $freshDeal = $updatedDeal->fresh([
                'currency',
                'contact',
                'hibarrFields',
                'leadAgent.user',
                'addedBy',
                'leadSource',
                'category',
                'leadStage',
                'pipeline.stages',
                'packages',
                'products.property',
                'dealWatchers',
                'dealParticipants',
                'leadFlightItineraries',
            ]);
            $freshDeal->withCustomFields();
            $freshDeal->setAttribute('value_breakdown', app(\App\Services\DealValueResolver::class)->getBreakdown($freshDeal));

            return response()->json([
                'status' => 'success',
                'data' => $freshDeal,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'status' => 'error',
                'message' => 'Validation failed',
                'errors' => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::error('DealGatheringController: Exception', [
                'message' => $e->getMessage(),
                'type' => $request->input('type'),
            ]);

            $payload = ['status' => 'error'];
            if (config('app.debug')) {
                $payload['message'] = $e->getMessage();
                $payload['exception'] = get_class($e);
                $payload['file'] = $e->getFile().':'.$e->getLine();
                $payload['trace'] = collect($e->getTrace())->take(10)->toArray();
            }

            return response()->json($payload, 500);
        }
    }

    /**
     * Mark deal analysis as complete.
     *
     * Accepts { completion_type: 'auto'|'manual', unfilled_count: int }.
     * 'manual' marks complete even when fields remain unfilled (caller already confirmed).
     */
    public function completeAnalysis(Request $request, int $id)
    {
        $request->validate([
            'completion_type' => 'required|in:auto,manual',
            'unfilled_count' => 'nullable|integer|min:0',
        ]);

        $deal = Deal::findOrFail($id);

        if ($deal->isLocked()) {
            return response()->json(['status' => 'error', 'message' => __('messages.dealLocked')], 403);
        }

        $editPermission = user()->permission('edit_deals');
        $canEdit = $editPermission === 'all'
            || ($editPermission === 'added' && $deal->added_by === user()->id)
            || ($editPermission === 'owned' && $deal->hasTeamMemberAccess(user()->id))
            || ($editPermission === 'both' && ($deal->added_by === user()->id || $deal->hasTeamMemberAccess(user()->id)));

        if (! $canEdit) {
            return response()->json(['status' => 'error', 'message' => __('messages.permissionDenied')], 403);
        }

        $deal->update([
            'analysis_status' => 'completed',
            'analysis_completed_at' => now(),
            'analysis_completed_by' => user()->id,
        ]);

        app(\App\Services\DealActivityEventService::class)->recordAnalysisCompleted(
            $deal,
            $request->completion_type,
            (int) ($request->unfilled_count ?? 0),
        );

        return response()->json([
            'status' => 'success',
            'analysis_status' => 'completed',
            'analysis_completed_at' => $deal->analysis_completed_at?->toIso8601String(),
            'analysis_completed_by' => $deal->analysis_completed_by,
        ]);
    }

    /**
     * Helper function to convert human-readable size to bytes
     */
    private function returnBytes($val)
    {
        return Files::returnBytes($val);
    }
}
