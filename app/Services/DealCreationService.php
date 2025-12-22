<?php

namespace App\Services;

use App\Models\Deal;
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
use Illuminate\Http\Request;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

class DealCreationService
{
    /**
     * Cache TTL for duplicate prevention (5 minutes)
     */
    private const CACHE_TTL = 300;

    /**
     * Process deal creation/update with cache-based duplicate prevention.
     *
     * @param int $contactId
     * @param int $companyId
     * @param array $requestData
     * @return Deal
     * @throws \Exception
     */
    public function processDeal(int $contactId, int $companyId, array $requestData): Deal
    {
        // Convert array to Request object for compatibility with existing methods
        $request = Request::create('/', 'POST', $requestData);
        
        $dealName = $request->input('deal_name') ?? $request->input('name') ?? 'Untitled Deal';
        
        // Generate deterministic hash for duplicate prevention
        $dealHash = $this->generateDealHash($contactId, $dealName, $companyId);
        
        // Cache key for duplicate prevention
        $cacheKey = "deal_processing:{$dealHash}";
        
        // Check cache BEFORE starting transaction to prevent duplicates
        // This is the first line of defense
        if (Cache::has($cacheKey)) {
            Log::info('DealCreationService: Duplicate request detected, skipping', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'deal_name' => $dealName,
                'hash' => $dealHash,
            ]);
            
            // Return existing deal if found, otherwise throw exception
            $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
            if ($existingDeal) {
                return $existingDeal;
            }
            
            throw new \Exception('Duplicate deal request detected and no existing deal found');
        }
        
        // Set cache lock BEFORE transaction to prevent concurrent processing
        Cache::put($cacheKey, true, self::CACHE_TTL);
        
        try {
            return DB::transaction(function () use ($contactId, $companyId, $request, $dealName, $dealHash, $cacheKey) {
                // Find or create deal with lock to prevent duplicates (second line of defense)
                $result = $this->findOrCreateDeal($contactId, $companyId, $dealName, $dealHash);
                $deal = $result['deal'];
                $isNewDeal = $result['is_new'];
                
                if ($isNewDeal) {
                    $deal->created_at = now();
                }

                // Default pipeline_id to 1 if not provided
                $pipelineId = $request->pipeline_id ?? 1;
                
                // Get first stage ID for the pipeline
                $firstStageId = $this->getFirstStageInPipeline($pipelineId, $companyId);

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

                // Check if deal name has changed and update hash accordingly
                $nameChanged = $deal->name !== $dealName;
                if ($nameChanged) {
                    // Recalculate hash for the new deal name
                    $newHash = $this->generateDealHash($contactId, $dealName, $companyId);
                    $deal->hash = $newHash;
                }

                // Update deal fields
                $deal->name = $dealName;
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

                // Manually trigger notifications for agent or admins (only for new deals)
                if ($isNewDeal) {
                    $this->sendDealCreatedNotifications($deal);
                }

                // Remove cache lock after successful processing
                Cache::forget($cacheKey);
                
                return $deal;
            });
        } catch (\Exception $e) {
            // Remove cache lock on error to allow retry
            Cache::forget($cacheKey);
            throw $e;
        }
    }

    /**
     * Generate a deterministic hash for a deal based on contact, name, and company.
     *
     * @param int $contactId
     * @param string $dealName
     * @param int $companyId
     * @return string
     */
    public function generateDealHash(int $contactId, string $dealName, int $companyId): string
    {
        // Normalize deal name (lowercase, remove extra spaces)
        $normalizedName = trim(strtolower($dealName));
        
        // Create hash from contact + normalized deal name + company
        return hash('sha256', "{$contactId}|{$normalizedName}|{$companyId}");
    }

    /**
     * Find existing deal by hash (for duplicate detection).
     *
     * @param int $contactId
     * @param int $companyId
     * @param string $dealHash
     * @return Deal|null
     */
    private function findExistingDealByHash(int $contactId, int $companyId, string $dealHash): ?Deal
    {
        return Deal::where('lead_id', $contactId)
            ->where('company_id', $companyId)
            ->where('hash', $dealHash)
            ->whereNull('close_date') // Only open deals
            ->first();
    }

    /**
     * Find or create a deal with database lock to prevent duplicates.
     *
     * @param int $contactId
     * @param int $companyId
     * @param string $dealName
     * @param string $dealHash
     * @return array{deal: Deal, is_new: bool}
     */
    private function findOrCreateDeal(int $contactId, int $companyId, string $dealName, string $dealHash): array
    {
        // First, try to find deal by hash (most reliable for exact duplicates)
        $existingDeal = Deal::where('lead_id', $contactId)
            ->where('company_id', $companyId)
            ->where('hash', $dealHash)
            ->whereNull('close_date') // Only open deals
            ->lockForUpdate() // Lock the row to prevent concurrent creation
            ->first();
        
        if ($existingDeal) {
            return ['deal' => $existingDeal, 'is_new' => false];
        }
        
        // Fallback: Find any open deal for this contact (for backwards compatibility)
        $existingDeal = Deal::where('lead_id', $contactId)
            ->where('company_id', $companyId)
            ->whereNull('close_date') // Only open deals
            ->orderByDesc('updated_at')
            ->lockForUpdate() // Lock the row to prevent concurrent creation
            ->first();
        
        if ($existingDeal) {
            // Update the hash for future requests
            $existingDeal->hash = $dealHash;
            $existingDeal->saveQuietly();
            return ['deal' => $existingDeal, 'is_new' => false];
        }
        
        // Create new deal with hash
        $deal = new Deal();
        $deal->company_id = $companyId;
        $deal->lead_id = $contactId;
        $deal->hash = $dealHash;
        $deal->name = $dealName;
        
        return ['deal' => $deal, 'is_new' => true];
    }

    /**
     * Get the first stage ID in a pipeline (lowest priority).
     *
     * @param int $pipelineId
     * @param int $companyId
     * @return int
     * @throws \Exception
     */
    private function getFirstStageInPipeline(int $pipelineId, int $companyId): int
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
     * Resolve package_id from package_id or package_name.
     *
     * @param Request $request
     * @param int $companyId
     * @return int|null
     */
    private function resolvePackageId(Request $request, int $companyId): ?int
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

        return null;
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
            'motivation' => $request->input('motivation') ?? '',
            'message' => $request->input('message') ?? '',
        ];

        HibarrDealFields::updateOrCreate(
            ['deal_id' => $deal->id],
            $hibarrFields
        );
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
        // Skip notifications if disabled via environment variable (useful for testing)
        if (env('DISABLE_DEAL_NOTIFICATIONS', false)) {
            Log::info('Deal notifications disabled via DISABLE_DEAL_NOTIFICATIONS env variable', [
                'deal_id' => $deal->id,
            ]);
            return;
        }

        // Reload deal with relationships
        $deal->load('leadAgent.user', 'company', 'dealWatchers');

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

        // Always notify deal watchers if they exist
        if ($deal->dealWatchers->isNotEmpty()) {
            Notification::send($deal->dealWatchers, new LeadAgentAssigned($deal));
        }
    }
}

