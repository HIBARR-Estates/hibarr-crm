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
     * Maximum time to wait for duplicate deal to be committed (30 seconds)
     */
    private const DUPLICATE_WAIT_TIMEOUT = 30;
    
    /**
     * Initial retry delay in milliseconds for duplicate detection
     */
    private const DUPLICATE_RETRY_DELAY_MS = 100;

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
        
        // Atomically acquire cache lock to prevent duplicates
        // Cache::add() is atomic - it only sets the value if the key doesn't exist
        // Returns true if lock was acquired, false if another process is already processing
        $lockAcquired = Cache::add($cacheKey, true, self::CACHE_TTL);
        
        if (!$lockAcquired) {
            Log::info('DealCreationService: Duplicate request detected, waiting for original to complete', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'deal_name' => $dealName,
                'hash' => $dealHash,
            ]);
            
            // Wait for the original request to complete and find the existing deal
            // This handles the case where the original request is still in a transaction
            $existingDeal = $this->waitForExistingDeal($contactId, $companyId, $dealHash);
            if ($existingDeal) {
                return $existingDeal;
            }
            
            throw new \Exception('Duplicate deal request detected and no existing deal found after waiting');
        }
        
        try {
            $startTime = microtime(true);
            // Track if hash changes during processing 
            $currentHash = $dealHash;
            $hashChanged = false;
            
            $deal = DB::transaction(function () use ($contactId, $companyId, $request, $dealName, $dealHash, $cacheKey, $startTime, &$currentHash, &$hashChanged) {
                // Helper function to refresh cache lock if needed 
                // Refresh if we're within 60 seconds of expiration to prevent mid-transaction expiration
                $refreshCacheLock = function () use ($cacheKey, $startTime) {
                    $elapsed = microtime(true) - $startTime;
                    $timeUntilExpiration = self::CACHE_TTL - $elapsed;
                    
                    // Refresh if we're within 60 seconds of expiration
                    if ($timeUntilExpiration < 60) {
                        Cache::put($cacheKey, true, self::CACHE_TTL);
                        Log::debug('DealCreationService: Refreshed cache lock', [
                            'cache_key' => $cacheKey,
                            'elapsed_seconds' => round($elapsed, 2),
                            'time_until_expiration' => round($timeUntilExpiration, 2),
                        ]);
                    }
                };
                
                // Refresh cache lock at the start
                $refreshCacheLock();
                
                // Find or create deal with lock to prevent duplicates (second line of defense)
                $result = $this->findOrCreateDeal($contactId, $companyId, $dealName, $dealHash);
                $deal = $result['deal'];
                $isNewDeal = $result['is_new'];
                $hashWasUpdated = $result['hash_updated'] ?? false;
                
                // Track hash change if it was updated in findOrCreateDeal 
                if ($hashWasUpdated) {
                    $currentHash = $deal->hash;
                    $hashChanged = true;
                }
                
                if ($isNewDeal) {
                    $deal->created_at = now();
                }

                // Default pipeline_id to 1 if not provided
                $pipelineId = $request->input('pipeline_id') ?? 1;
                
                // Get first stage ID for the pipeline
                $firstStageId = $this->getFirstStageInPipeline($pipelineId, $companyId);

                // Resolve agent_id from deal_owner_id (user_id)
                $agentId = null;
                $dealOwnerId = $request->input('deal_owner_id');
                if ($request->has('deal_owner_id') && !empty($dealOwnerId)) {
                    $agentId = $this->resolveAgentId($dealOwnerId, $companyId);
                    
                    // If deal_owner_id was provided but couldn't be resolved, log warning
                    if ($agentId === null) {
                        Log::warning('Invalid deal_owner_id provided in createDeal API', [
                            'deal_owner_id' => $dealOwnerId,
                            'company_id' => $companyId,
                            'contact_email' => $request->input('email') ?? 'unknown'
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
                    // Track hash change for cache key management 
                    $currentHash = $newHash;
                    $hashChanged = true;
                }

                // Update deal fields
                $deal->name = $dealName;
                $deal->lead_pipeline_id = $pipelineId;
                $deal->pipeline_stage_id = $request->input('pipeline_stage_id') ?? $firstStageId ?? $deal->pipeline_stage_id;
                $deal->agent_id = $agentId ?? $deal->agent_id;
                $deal->package_id = $packageId;
                $deal->next_follow_up = 'yes';
                $deal->create_client = 0;
                
                // Refresh cache lock before saving (long operation)
                $refreshCacheLock();
                
                // Save quietly to bypass observers
                $deal->saveQuietly();

                // Update lead's lead_owner if deal_owner_id is provided and lead doesn't have an owner
                $dealOwnerId = $request->input('deal_owner_id');
                if ($request->has('deal_owner_id') && !empty($dealOwnerId)) {
                    $lead = Lead::where('company_id', $companyId)->where('id', $contactId)->first();
                    if ($lead && !$lead->lead_owner) {
                        $lead->lead_owner = $dealOwnerId;
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
                $meeting = $request->input('meeting');
                if ($request->has('meeting') && is_array($meeting)) {
                    $this->createMeeting($deal, $meeting, $companyId);
                }

                // Refresh cache lock before notifications (potentially long operation)
                $refreshCacheLock();
                
                // Manually trigger notifications for agent or admins (only for new deals)
                if ($isNewDeal) {
                    $this->sendDealCreatedNotifications($deal);
                }
                
                // Return deal - cache lock will be released after transaction commits 
                return $deal;
            }, 5); // 5 attempts for deadlock retry
            
            // Release cache lock AFTER transaction commits 
            // This prevents race condition where another process acquires lock before commit
            DB::afterCommit(function () use ($cacheKey, $currentHash, $hashChanged) {
                // Release the original cache lock
                Cache::forget($cacheKey);
                
                // If hash changed, also release any potential lock with the new hash 
                if ($hashChanged) {
                    $newCacheKey = "deal_processing:{$currentHash}";
                    Cache::forget($newCacheKey);
                    Log::debug('DealCreationService: Released cache lock for changed hash', [
                        'original_key' => $cacheKey,
                        'new_key' => $newCacheKey,
                    ]);
                }
            });
            
            return $deal;
        } catch (\Exception $e) {
            // Remove cache lock on error to allow retry
            // Release immediately on error since transaction didn't commit
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
     * Wait for existing deal to be committed (handles Bug 2: transaction isolation).
     * Implements exponential backoff retry mechanism to wait for the original request's
     * transaction to commit before checking for the deal.
     *
     * @param int $contactId
     * @param int $companyId
     * @param string $dealHash
     * @return Deal|null
     */
    private function waitForExistingDeal(int $contactId, int $companyId, string $dealHash): ?Deal
    {
        $startTime = microtime(true);
        $retryDelay = self::DUPLICATE_RETRY_DELAY_MS;
        $maxWaitTime = self::DUPLICATE_WAIT_TIMEOUT;
        
        while (true) {
            // Check if we've exceeded the maximum wait time
            $elapsed = microtime(true) - $startTime;
            if ($elapsed > $maxWaitTime) {
                Log::warning('DealCreationService: Timeout waiting for duplicate deal to be committed', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'hash' => $dealHash,
                    'elapsed_seconds' => $elapsed,
                ]);
                return null;
            }
            
            // Try to find the existing deal
            $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
            if ($existingDeal) {
                Log::info('DealCreationService: Found existing deal after waiting', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'deal_id' => $existingDeal->id,
                    'hash' => $dealHash,
                    'wait_time_seconds' => $elapsed,
                ]);
                return $existingDeal;
            }
            
            // Check if the cache lock is still held (original request still processing)
            $cacheKey = "deal_processing:{$dealHash}";
            if (!Cache::has($cacheKey)) {
                // Lock was released, but deal not found - might have failed or been deleted
                // Do one final check before giving up
                $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
                if ($existingDeal) {
                    return $existingDeal;
                }
                
                Log::warning('DealCreationService: Cache lock released but deal not found', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'hash' => $dealHash,
                ]);
                return null;
            }
            
            // Wait with exponential backoff before retrying
            usleep($retryDelay * 1000); // Convert milliseconds to microseconds
            $retryDelay = min($retryDelay * 2, 1000); // Cap at 1 second
        }
    }

    /**
     * Find or create a deal with database lock to prevent duplicates.
     *
     * @param int $contactId
     * @param int $companyId
     * @param string $dealName
     * @param string $dealHash
     * @return array{deal: Deal, is_new: bool, hash_updated?: bool}
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
            return ['deal' => $existingDeal, 'is_new' => false, 'hash_updated' => false];
        }
        
        // Fallback: Find any open deal for this contact (for backwards compatibility)
        $existingDeal = Deal::where('lead_id', $contactId)
            ->where('company_id', $companyId)
            ->whereNull('close_date') // Only open deals
            ->orderByDesc('updated_at')
            ->lockForUpdate() // Lock the row to prevent concurrent creation
            ->first();
        
        if ($existingDeal) {
            // Check if hash needs to be updated 
            $hashWasUpdated = $existingDeal->hash !== $dealHash;
            
            // Update the hash for future requests
            $existingDeal->hash = $dealHash;
            $existingDeal->saveQuietly();
            return ['deal' => $existingDeal, 'is_new' => false, 'hash_updated' => $hashWasUpdated];
        }
        
        // Create new deal with hash
        $deal = new Deal();
        $deal->company_id = $companyId;
        $deal->lead_id = $contactId;
        $deal->hash = $dealHash;
        $deal->name = $dealName;
        
        return ['deal' => $deal, 'is_new' => true, 'hash_updated' => false];
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
        $packageId = $request->input('package_id');
        if ($request->has('package_id') && is_numeric($packageId)) {
            $package = Package::where('company_id', $companyId)->where('id', $packageId)->first();
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

