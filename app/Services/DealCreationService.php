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
     * Cache TTL for duplicate prevention (60 seconds)
     * Reduced from 300s to minimize lock contention and connection exhaustion
     */
    private const CACHE_TTL = 60;
    
    /**
     * Maximum time to wait for duplicate deal to be committed
     * Set to match CACHE_TTL to handle long-running transactions
     */
    private const DUPLICATE_WAIT_TIMEOUT = 60; // Match CACHE_TTL
    
    /**
     * Initial retry delay in milliseconds for duplicate detection
     */
    private const DUPLICATE_RETRY_DELAY_MS = 50;
    
    /**
     * Maximum retry delay cap in milliseconds
     */
    private const DUPLICATE_MAX_RETRY_DELAY_MS = 200; // Cap at 200ms
    
    /**
     * Cache lock refresh threshold in seconds
     * Refresh locks when within this time of expiration to prevent mid-transaction expiration
     */
    private const CACHE_REFRESH_THRESHOLD = 15; // Refresh when 15s or less remaining
    
    /**
     * Transaction timeout in seconds
     * Maximum time a transaction can run before timing out
     */
    private const TRANSACTION_TIMEOUT = 30; // 30 seconds max transaction time

    /**
     * Process deal creation/update with cache-based duplicate prevention.
     *
     * @param int $contactId
     * @param int $companyId
     * @param array $requestData
     * @return array{deal: Deal, is_new: bool}
     * @throws \Exception
     */
    public function processDeal(int $contactId, int $companyId, array $requestData): array
    {
        // Convert array to Request object for compatibility with existing methods
        $request = Request::create('/', 'POST', $requestData);
        
        $dealName = $request->input('deal_name') ?? $request->input('name') ?? 'Untitled Deal';
        
        // Generate deterministic hash for duplicate prevention
        $dealHash = $this->generateDealHash($contactId, $dealName, $companyId);
        
        // Contact-level lock to prevent concurrent deal creation for the same contact
        // This prevents different deal names from creating multiple deals simultaneously
        // Handle cache failures gracefully - if cache is unavailable, fail fast to avoid long-held locks
        $contactLockKey = "deal_processing_contact:{$contactId}:{$companyId}";
        try {
            $contactLockAcquired = Cache::add($contactLockKey, true, self::CACHE_TTL);
        } catch (\Exception $e) {
            Log::error('DealCreationService: Cache operation failed during lock acquisition', [
                'error' => $e->getMessage(),
                'contact_id' => $contactId,
                'company_id' => $companyId,
            ]);
            throw new \Exception('Cache unavailable - cannot acquire lock for deal processing');
        }
        
        if (!$contactLockAcquired) {
            Log::info('DealCreationService: Contact-level lock already held, checking for existing deal', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'deal_name' => $dealName,
            ]);
            
            // Quick check for existing deal (non-blocking)
            $result = $this->waitForContactLockRelease($contactId, $companyId, $dealHash);
            if ($result['status'] === 'found' && $result['deal']) {
                return ['deal' => $result['deal'], 'is_new' => false];
            }
            
            if ($result['status'] === 'duplicate_in_progress') {
                // Throw exception - the job's retry mechanism will handle retries with backoff
                // Note: No locks to release here since we didn't acquire the contact lock
                Log::info('DealCreationService: Duplicate in progress (contact lock), will retry via job', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'deal_name' => $dealName,
                ]);
                throw new \Exception('DUPLICATE_IN_PROGRESS');
            }
            
            // No locks to release since we didn't acquire the contact lock
            throw new \Exception('Another deal creation is in progress for this contact');
        }
        
        // Hash-based lock for exact duplicate prevention (same contact + same deal name)
        $cacheKey = "deal_processing:{$dealHash}";
        
        // Atomically acquire cache lock to prevent duplicates
        // Cache::add() is atomic - it only sets the value if the key doesn't exist
        // Returns true if lock was acquired, false if another process is already processing
        // Handle cache failures gracefully
        try {
            $lockAcquired = Cache::add($cacheKey, true, self::CACHE_TTL);
        } catch (\Exception $e) {
            // Release contact lock on cache failure
            try {
                Cache::forget($contactLockKey);
            } catch (\Exception $forgetError) {
                Log::warning('DealCreationService: Failed to release contact lock after cache error', [
                    'error' => $forgetError->getMessage(),
                ]);
            }
            Log::error('DealCreationService: Cache operation failed during hash lock acquisition', [
                'error' => $e->getMessage(),
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'hash' => $dealHash,
            ]);
            throw new \Exception('Cache unavailable - cannot acquire lock for deal processing');
        }
        
        if (!$lockAcquired) {
            // Release contact lock since we won't proceed
            Cache::forget($contactLockKey);
            
            Log::info('DealCreationService: Duplicate request detected (same hash), checking for existing deal', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'deal_name' => $dealName,
                'hash' => $dealHash,
            ]);
            
            // Quick check for existing deal (non-blocking)
            $result = $this->waitForExistingDeal($contactId, $companyId, $dealHash);
            if ($result['status'] === 'found' && $result['deal']) {
                return ['deal' => $result['deal'], 'is_new' => false];
            }
            
            if ($result['status'] === 'duplicate_in_progress') {
                // Throw exception - the job's retry mechanism will handle retries with backoff
                // Note: Contact lock already released above, no hash lock acquired
                Log::info('DealCreationService: Duplicate in progress (hash lock), will retry via job', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'deal_name' => $dealName,
                    'hash' => $dealHash,
                ]);
                throw new \Exception('DUPLICATE_IN_PROGRESS');
            }
            
            // Contact lock already released, no hash lock acquired
            throw new \Exception('Duplicate deal request detected and no existing deal found');
        }
        
        // Both locks acquired - prepare data BEFORE transaction to minimize transaction scope
        // Read-only lookups are done outside the transaction to reduce lock contention
        $pipelineId = $request->input('pipeline_id') ?? 1;
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
        
        $packageIds = app(\App\Services\PackagePipelineRouterService::class)->normalizePackageIds(
            $this->resolvePackageId($request, $companyId),
            $companyId,
        );
        
        // Wrap in try-catch to ensure locks are released on any error
        // Note: DB transaction starts inside the try block, so rollbacks only occur
        // if a transaction was actually started. Exceptions before transaction start
        // will still release locks via this catch block.
        try {
            $startTime = microtime(true);
            // Track if hash changes during processing 
            $currentHash = $dealHash;
            $hashChanged = false;
            $isNewDeal = false;
            $newCacheKey = null; // Track new cache key if hash changes
            $newLockAcquired = false; // Track whether new lock was actually acquired
            
            // Set transaction timeout to prevent indefinite blocking
            // Use MySQL's lock_wait_timeout for row-level locks (only if supported)
            try {
                DB::statement("SET SESSION lock_wait_timeout = " . self::TRANSACTION_TIMEOUT);
            } catch (\Exception $e) {
                // Some databases may not support this - log but continue
                Log::debug('DealCreationService: Could not set transaction timeout', [
                    'error' => $e->getMessage(),
                ]);
            }
            
            $result = DB::transaction(function () use ($contactId, $companyId, $request, $dealName, $dealHash, $cacheKey, $contactLockKey, $startTime, $pipelineId, $firstStageId, $agentId, $packageIds, &$currentHash, &$hashChanged, &$isNewDeal, &$newCacheKey, &$newLockAcquired) {
                // Helper function to refresh cache locks if needed 
                // Refresh if we're within threshold of expiration to prevent mid-transaction expiration
                // Note: $newCacheKey and $newLockAcquired are captured by reference so they see updates when hash changes
                // Handles cache failures gracefully to avoid breaking the transaction
                $refreshCacheLocks = function () use ($cacheKey, $contactLockKey, &$newCacheKey, &$newLockAcquired, $startTime) {
                    $elapsed = microtime(true) - $startTime;
                    $timeUntilExpiration = self::CACHE_TTL - $elapsed;
                    
                    // Refresh if we're within threshold of expiration
                    if ($timeUntilExpiration < self::CACHE_REFRESH_THRESHOLD) {
                        try {
                            Cache::put($cacheKey, true, self::CACHE_TTL);
                            Cache::put($contactLockKey, true, self::CACHE_TTL);
                            
                            // Also refresh new hash lock only if we actually acquired it
                            if ($newCacheKey && $newLockAcquired) {
                                Cache::put($newCacheKey, true, self::CACHE_TTL);
                            }
                            
                            Log::debug('DealCreationService: Refreshed cache locks', [
                                'cache_key' => $cacheKey,
                                'contact_lock_key' => $contactLockKey,
                                'new_cache_key' => $newCacheKey,
                                'new_lock_acquired' => $newLockAcquired,
                                'elapsed_seconds' => round($elapsed, 2),
                                'time_until_expiration' => round($timeUntilExpiration, 2),
                            ]);
                        } catch (\Exception $e) {
                            // Log cache failure but don't break the transaction
                            // Locks may expire, but transaction will complete and locks will be released after commit
                            Log::warning('DealCreationService: Failed to refresh cache locks', [
                                'error' => $e->getMessage(),
                                'cache_key' => $cacheKey,
                                'contact_lock_key' => $contactLockKey,
                            ]);
                        }
                    }
                };
                
                // Refresh cache locks at the start
                $refreshCacheLocks();
                
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

                // Check if deal name has changed and update hash accordingly
                $nameChanged = $deal->name !== $dealName;
                if ($nameChanged) {
                    // Recalculate hash for the new deal name
                    $newHash = $this->generateDealHash($contactId, $dealName, $companyId);
                    $deal->hash = $newHash;
                    // Track hash change for cache key management 
                    $currentHash = $newHash;
                    $hashChanged = true;
                    
                    // Acquire lock on the new hash to prevent concurrent requests with the new name
                    // This is critical: without this, concurrent requests with the new deal name
                    // can bypass the cache lock and process the same deal simultaneously
                    // If we cannot acquire the lock, we must abort to prevent duplicate deals
                    $newCacheKey = "deal_processing:{$newHash}";
                    $acquired = false;
                    try {
                        $acquired = Cache::add($newCacheKey, true, self::CACHE_TTL);
                        $newLockAcquired = $acquired; // Track whether we actually acquired the lock
                    } catch (\Exception $e) {
                        // Cache failure - abort to prevent potential duplicates
                        Log::error('DealCreationService: Failed to acquire new hash lock due to cache error', [
                            'error' => $e->getMessage(),
                            'new_hash' => $newHash,
                            'contact_id' => $contactId,
                            'company_id' => $companyId,
                            'deal_name' => $dealName,
                        ]);
                        throw new \Exception("Cannot change deal name: cache unavailable when processing deal with name '{$dealName}'");
                    }
                    
                    if (!$acquired) {
                        // Another request is already processing with the new hash - abort to prevent duplicate
                        Log::warning('DealCreationService: New hash lock already held - aborting to prevent duplicate', [
                            'contact_id' => $contactId,
                            'company_id' => $companyId,
                            'old_hash' => $dealHash,
                            'new_hash' => $newHash,
                            'old_cache_key' => $cacheKey,
                            'new_cache_key' => "deal_processing:{$newHash}",
                            'deal_name' => $dealName,
                        ]);
                        throw new \Exception("Cannot change deal name: another request is already processing a deal with name '{$dealName}'");
                    }
                    
                    Log::debug('DealCreationService: Acquired lock on new hash', [
                        'contact_id' => $contactId,
                        'company_id' => $companyId,
                        'old_hash' => $dealHash,
                        'new_hash' => $newHash,
                        'old_cache_key' => $cacheKey,
                        'new_cache_key' => $newCacheKey,
                    ]);
                }

                // Update deal fields with pre-resolved values (minimize transaction scope)
                $deal->name = $dealName;
                $deal->lead_pipeline_id = $pipelineId;
                $deal->pipeline_stage_id = $request->input('pipeline_stage_id') ?? $firstStageId ?? $deal->pipeline_stage_id;
                if ($isNewDeal) {
                    $deal->agent_id = $agentId ?? $deal->agent_id;
                    Log::info('DealCreationService: Deal agent decision (new deal)', [
                        'contact_id' => $contactId,
                        'company_id' => $companyId,
                        'deal_id' => $deal->id,
                        'deal_hash' => $deal->hash,
                        'deal_owner_id' => $request->input('deal_owner_id'),
                        'resolved_agent_id' => $agentId,
                        'final_agent_id' => $deal->agent_id,
                    ]);
                } elseif ($request->boolean('update_agent_if_exists', false) && !$deal->agent_id && $agentId) {
                    // Only assign agent for existing deals when currently unassigned.
                    // Never overwrite an existing agent assignment, even when the flag is true.
                    $previousAgentId = $deal->agent_id;
                    $deal->agent_id = $agentId;
                    Log::info('DealCreationService: Deal agent decision (existing deal assigned)', [
                        'contact_id' => $contactId,
                        'company_id' => $companyId,
                        'deal_id' => $deal->id,
                        'deal_hash' => $deal->hash,
                        'update_agent_if_exists' => true,
                        'previous_agent_id' => $previousAgentId,
                        'resolved_agent_id' => $agentId,
                        'final_agent_id' => $deal->agent_id,
                    ]);
                } else {
                    Log::info('DealCreationService: Deal agent decision (existing deal skipped)', [
                        'contact_id' => $contactId,
                        'company_id' => $companyId,
                        'deal_id' => $deal->id,
                        'deal_hash' => $deal->hash,
                        'update_agent_if_exists' => $request->boolean('update_agent_if_exists', false),
                        'current_agent_id' => $deal->agent_id,
                        'resolved_agent_id' => $agentId,
                        'reason' => !$request->boolean('update_agent_if_exists', false)
                            ? 'flag_false'
                            : ($deal->agent_id ? 'already_assigned' : (!$agentId ? 'no_resolved_agent' : 'unknown')),
                    ]);
                }
                $deal->next_follow_up = 'yes';
                $deal->create_client = 0;
                
                // Refresh cache lock before saving (long operation)
                $refreshCacheLocks();
                
                // Save quietly to bypass observers
                $deal->saveQuietly();
                
                // Attach packages using pivot table relationship (package_id column was removed in migration 2025_12_26_000002)
                if (!empty($packageIds)) {
                    $deal->packages()->syncWithoutDetaching($packageIds);
                    app(\App\Services\PackagePipelineRouterService::class)
                        ->routeDeal($deal->fresh(['packages']));
                }

                // Update lead's lead_owner if deal_owner_id is provided and lead doesn't have an owner
                // Use lockForUpdate() to prevent race conditions with concurrent requests
                $dealOwnerId = $request->input('deal_owner_id');
                if ($request->has('deal_owner_id') && !empty($dealOwnerId)) {
                    $lead = Lead::where('company_id', $companyId)
                        ->where('id', $contactId)
                        ->lockForUpdate() // Lock the row to serialize concurrent updates
                        ->first();
                    $shouldUpdateLeadOwner = $lead
                        && !$lead->lead_owner
                        && ($isNewDeal || $request->boolean('update_agent_if_exists', false));

                    if ($shouldUpdateLeadOwner) {
                        $previousLeadOwner = $lead->lead_owner;
                        $lead->lead_owner = $dealOwnerId;
                        $lead->saveQuietly();
                        Log::info('DealCreationService: Lead owner set', [
                            'contact_id' => $contactId,
                            'company_id' => $companyId,
                            'lead_id' => $lead->id,
                            'is_new_deal' => $isNewDeal,
                            'update_agent_if_exists' => $request->boolean('update_agent_if_exists', false),
                            'previous_lead_owner' => $previousLeadOwner,
                            'final_lead_owner' => $lead->lead_owner,
                            'deal_owner_id' => $dealOwnerId,
                        ]);
                    } else {
                        Log::info('DealCreationService: Lead owner skipped', [
                            'contact_id' => $contactId,
                            'company_id' => $companyId,
                            'lead_id' => $lead?->id,
                            'is_new_deal' => $isNewDeal,
                            'update_agent_if_exists' => $request->boolean('update_agent_if_exists', false),
                            'current_lead_owner' => $lead?->lead_owner,
                            'deal_owner_id' => $dealOwnerId,
                            'reason' => !$lead
                                ? 'lead_not_found'
                                : ($lead->lead_owner
                                    ? 'already_assigned'
                                    : (!$isNewDeal && !$request->boolean('update_agent_if_exists', false)
                                        ? 'flag_false'
                                        : 'unknown')),
                        ]);
                    }
                }

                // Return deal and is_new flag - cache lock will be released after transaction commits 
                // Note: Heavy/non-critical operations (notifications, meetings, watchers, Hibarr fields)
                // are moved outside the transaction to reduce lock contention and transaction duration
                return ['deal' => $deal, 'is_new' => $isNewDeal];
            }, 5); // 5 attempts for deadlock retry
            
            $deal = $result['deal'];
            $isNewDeal = $result['is_new'];
            $packageExplicitlySelected = !empty($packageIds);
            
            // Release cache locks AFTER transaction commits 
            // This prevents race condition where another process acquires lock before commit
            DB::afterCommit(function () use ($cacheKey, $contactLockKey, $newCacheKey, $hashChanged, $newLockAcquired, &$deal, $isNewDeal, $request, $companyId, $packageExplicitlySelected) {
                // Release locks with error handling
                try {
                    Cache::forget($cacheKey);
                    Cache::forget($contactLockKey);
                    
                    // If hash changed and we actually acquired the new lock, release it
                    if ($hashChanged && $newCacheKey && $newLockAcquired) {
                        Cache::forget($newCacheKey);
                        Log::debug('DealCreationService: Released cache lock for changed hash', [
                            'original_key' => $cacheKey,
                            'new_key' => $newCacheKey,
                        ]);
                    }
                } catch (\Exception $e) {
                    // Log but don't fail - locks will expire naturally
                    Log::warning('DealCreationService: Failed to release cache locks after commit', [
                        'error' => $e->getMessage(),
                    ]);
                }
                
                // Perform heavy/non-critical operations outside transaction to reduce lock contention
                // These operations don't need to be in the transaction and can be done asynchronously
                try {
                    // Upsert Hibarr fields (non-critical, can be retried)
                    $this->upsertHibarrFields($deal, $request);
                    
                    // Handle custom fields (non-critical, can be retried)
                    $this->upsertCustomFields($deal, $request);

                    $deal = $this->attemptFieldTriggeredPackageRouting(
                        $deal,
                        $companyId,
                        $packageExplicitlySelected,
                    );

                    // Sync deal watchers and participants (non-critical)
                    $dealWatchers = $this->extractUserIdList($request, 'deal_watcher');
                    if ($dealWatchers !== null && !empty($dealWatchers)) {
                        $validUserIds = $this->resolveValidUserIds($dealWatchers, $companyId);
                        if (!empty($validUserIds)) {
                            $deal->dealWatchers()->sync($validUserIds);
                        }
                    }

                    $dealParticipants = $this->extractUserIdList(
                        $request,
                        'deal_participant',
                        'deal_participants',
                    );
                    $validParticipantIds = $dealParticipants !== null && !empty($dealParticipants)
                        ? $this->resolveValidUserIds($dealParticipants, $companyId)
                        : [];
                    if (!empty($validParticipantIds)) {
                        $deal->dealParticipants()->sync($validParticipantIds);
                    }
                    
                    // Handle meeting if provided (non-critical)
                    $meeting = $request->input('meeting');
                    if ($request->has('meeting') && is_array($meeting)) {
                        $this->createMeeting($deal, $meeting, $companyId);
                    }
                    
                    // Send notifications (can be slow, moved outside transaction)
                    if ($isNewDeal) {
                        $this->sendDealCreatedNotifications($deal);
                    }

                    // Auto-apply offers based on product properties
                    app(DealOfferService::class)->applyOffersToDeal($deal);
                } catch (\Exception $e) {
                    // Log errors but don't fail the request - these are non-critical operations
                    Log::error('DealCreationService: Error in post-transaction operations', [
                        'deal_id' => $deal->id,
                        'error' => $e->getMessage(),
                        'trace' => $e->getTraceAsString(),
                    ]);
                }
            });
            
            return ['deal' => $deal, 'is_new' => $isNewDeal];
        } catch (\Exception $e) {
            // Remove cache locks on error to allow retry
            // Release locks regardless of whether a transaction was started:
            // - If transaction started: it will rollback automatically
            // - If exception occurred before transaction: no rollback needed, but locks must be released
            // Handle cache failures gracefully - locks will expire naturally if cache is unavailable
            try {
                Cache::forget($cacheKey);
                Cache::forget($contactLockKey);
                
                // Also release new hash lock only if we actually acquired it
                if (isset($newCacheKey) && isset($newLockAcquired) && $newLockAcquired) {
                    Cache::forget($newCacheKey);
                }
            } catch (\Exception $cacheError) {
                // Log but don't fail - locks will expire naturally
                Log::warning('DealCreationService: Failed to release cache locks on error', [
                    'error' => $cacheError->getMessage(),
                    'original_error' => $e->getMessage(),
                ]);
            }
            
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
     * Returns immediately if lock exists to avoid blocking HTTP workers.
     * Implements a quick probe with minimal wait time.
     *
     * @param int $contactId
     * @param int $companyId
     * @param string $dealHash
     * @return array{deal: Deal|null, status: string} Status can be 'found', 'duplicate_in_progress', or 'not_found'
     */
    private function waitForExistingDeal(int $contactId, int $companyId, string $dealHash): array
    {
        $cacheKey = "deal_processing:{$dealHash}";
        
        // Quick initial check: if lock exists, return immediately to avoid blocking
        $lockHeld = Cache::has($cacheKey);
        
        // Try to find the existing deal first (might already be committed)
        $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
        if ($existingDeal) {
            Log::info('DealCreationService: Found existing deal immediately', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'deal_id' => $existingDeal->id,
                'hash' => $dealHash,
            ]);
            return ['deal' => $existingDeal, 'status' => 'found'];
        }
        
        // If lock is held, return immediately to avoid blocking HTTP workers
        if ($lockHeld) {
            Log::info('DealCreationService: Duplicate deal in progress, returning immediately to avoid blocking', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'hash' => $dealHash,
            ]);
            return ['deal' => null, 'status' => 'duplicate_in_progress'];
        }
        
        // Lock not held and deal not found - do one quick probe with minimal wait
        // This handles the edge case where the deal was just committed but we missed it
        $startTime = microtime(true);
        $maxWaitTime = self::DUPLICATE_WAIT_TIMEOUT;
        $retryDelay = self::DUPLICATE_RETRY_DELAY_MS;
        $maxRetries = 3; // Limit to 3 quick retries
        
        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            $elapsed = microtime(true) - $startTime;
            
            // Enforce hard timeout
            if ($elapsed > $maxWaitTime) {
                Log::debug('DealCreationService: Timeout during quick probe for existing deal', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'hash' => $dealHash,
                    'elapsed_seconds' => $elapsed,
                ]);
                break;
            }
            
            // Check if lock appeared (another request started)
            $lockHeld = Cache::has($cacheKey);
            if ($lockHeld) {
                Log::info('DealCreationService: Lock appeared during probe, duplicate in progress', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'hash' => $dealHash,
                    'attempt' => $attempt + 1,
                ]);
                return ['deal' => null, 'status' => 'duplicate_in_progress'];
            }
            
            // Try to find the deal
            $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
            if ($existingDeal) {
                Log::info('DealCreationService: Found existing deal during quick probe', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'deal_id' => $existingDeal->id,
                    'hash' => $dealHash,
                    'attempt' => $attempt + 1,
                    'wait_time_seconds' => $elapsed,
                ]);
                return ['deal' => $existingDeal, 'status' => 'found'];
            }
            
            // Brief wait before next attempt (only if not last attempt)
            if ($attempt < $maxRetries - 1) {
                usleep($retryDelay * 1000); // Convert milliseconds to microseconds
                $retryDelay = min($retryDelay * 2, self::DUPLICATE_MAX_RETRY_DELAY_MS);
            }
        }
        
        // No deal found and no lock held
        Log::debug('DealCreationService: No existing deal found after quick probe', [
            'contact_id' => $contactId,
            'company_id' => $companyId,
            'hash' => $dealHash,
        ]);
        return ['deal' => null, 'status' => 'not_found'];
    }

    /**
     * Wait for contact-level lock to be released and check for existing deal.
     * This handles concurrent requests with different deal names for the same contact.
     * Returns immediately if lock exists to avoid blocking HTTP workers.
     *
     * @param int $contactId
     * @param int $companyId
     * @param string $dealHash
     * @return array{deal: Deal|null, status: string} Status can be 'found', 'duplicate_in_progress', or 'not_found'
     */
    private function waitForContactLockRelease(int $contactId, int $companyId, string $dealHash): array
    {
        $contactLockKey = "deal_processing_contact:{$contactId}:{$companyId}";
        
        // Quick initial check: if lock exists, return immediately to avoid blocking
        $lockHeld = Cache::has($contactLockKey);
        
        // Try to find the existing deal first (might already be committed)
        $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
        if ($existingDeal) {
            Log::info('DealCreationService: Found existing deal by hash immediately (contact lock check)', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'deal_id' => $existingDeal->id,
                'hash' => $dealHash,
            ]);
            return ['deal' => $existingDeal, 'status' => 'found'];
        }
        
        // If lock is held, return immediately to avoid blocking HTTP workers
        if ($lockHeld) {
            Log::info('DealCreationService: Contact lock held, returning immediately to avoid blocking', [
                'contact_id' => $contactId,
                'company_id' => $companyId,
                'hash' => $dealHash,
            ]);
            return ['deal' => null, 'status' => 'duplicate_in_progress'];
        }
        
        // Lock not held and deal not found - do one quick probe with minimal wait
        $startTime = microtime(true);
        $maxWaitTime = self::DUPLICATE_WAIT_TIMEOUT;
        $retryDelay = self::DUPLICATE_RETRY_DELAY_MS;
        $maxRetries = 3; // Limit to 3 quick retries
        
        for ($attempt = 0; $attempt < $maxRetries; $attempt++) {
            $elapsed = microtime(true) - $startTime;
            
            // Enforce hard timeout
            if ($elapsed > $maxWaitTime) {
                Log::debug('DealCreationService: Timeout during quick probe for contact lock release', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'hash' => $dealHash,
                    'elapsed_seconds' => $elapsed,
                ]);
                break;
            }
            
            // Check if lock appeared (another request started)
            $lockHeld = Cache::has($contactLockKey);
            if ($lockHeld) {
                Log::info('DealCreationService: Contact lock appeared during probe, duplicate in progress', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'hash' => $dealHash,
                    'attempt' => $attempt + 1,
                ]);
                return ['deal' => null, 'status' => 'duplicate_in_progress'];
            }
            
            // Try to find the deal with exact hash match
            $existingDeal = $this->findExistingDealByHash($contactId, $companyId, $dealHash);
            if ($existingDeal) {
                Log::info('DealCreationService: Found existing deal by hash during quick probe (contact lock)', [
                    'contact_id' => $contactId,
                    'company_id' => $companyId,
                    'deal_id' => $existingDeal->id,
                    'hash' => $dealHash,
                    'attempt' => $attempt + 1,
                    'wait_time_seconds' => $elapsed,
                ]);
                return ['deal' => $existingDeal, 'status' => 'found'];
            }
            
            // Brief wait before next attempt (only if not last attempt)
            if ($attempt < $maxRetries - 1) {
                usleep($retryDelay * 1000); // Convert milliseconds to microseconds
                $retryDelay = min($retryDelay * 2, self::DUPLICATE_MAX_RETRY_DELAY_MS);
            }
        }
        
        // No deal found and no lock held
        Log::debug('DealCreationService: No existing deal found after quick probe (contact lock)', [
            'contact_id' => $contactId,
            'company_id' => $companyId,
            'hash' => $dealHash,
            'note' => 'Original request may have created a deal with a different name/hash',
        ]);
        return ['deal' => null, 'status' => 'not_found'];
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
            // Only update hash if deal doesn't have one yet (prevents hash flip-flopping)
            // If deal already has a hash, preserve it to maintain consistency
            $hashWasUpdated = false;
            if (empty($existingDeal->hash)) {
                // Deal has no hash - set it to the current request's hash
                $existingDeal->hash = $dealHash;
                $existingDeal->saveQuietly();
                $hashWasUpdated = true;
            }
            // If deal already has a hash, don't overwrite it (prevents flip-flopping)
            
            return ['deal' => $existingDeal, 'is_new' => false, 'hash_updated' => $hashWasUpdated];
        }
        
        // Create new deal with hash
        $deal = new Deal();
        $deal->company_id = $companyId;
        $deal->lead_id = $contactId;
        $deal->added_by = 1;
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
     * Resolve package_ids from package_id (array) or package_name.
     *
     * @param Request $request
     * @param int $companyId
     * @return array
     */
    private function resolvePackageId(Request $request, int $companyId): array
    {
        $packageIds = [];
        
        // First check if package_id is provided as an array
        if ($request->has('package_id')) {
            $packageIdInput = $request->input('package_id');
            
            // Handle array input
            if (is_array($packageIdInput)) {
                $packageIds = array_filter(array_map('intval', $packageIdInput));
                // Validate that all package IDs exist and belong to the company
                if (!empty($packageIds)) {
                    $validPackages = Package::where('company_id', $companyId)
                        ->whereIn('id', $packageIds)
                        ->pluck('id')
                        ->toArray();
                    return $validPackages;
                }
            }
            // Handle single integer (backward compatibility)
            elseif (is_numeric($packageIdInput)) {
                $package = Package::where('company_id', $companyId)->where('id', $packageIdInput)->first();
                if ($package) {
                    return [$package->id];
                }
            }
        }

        // Fallback to package_name if provided (single package by name)
        if ($request->has('package_name')) {
            $package = Package::where('company_id', $companyId)->where('name', $request->input('package_name'))->first();
            if ($package) {
                return [$package->id];
            }
        }

        return [];
    }

    /**
     * Run field-triggered package routing using persisted deal data.
     */
    private function attemptFieldTriggeredPackageRouting(Deal $deal, int $companyId, bool $packageExplicitlySelected = false): Deal
    {
        $deal = $deal->fresh(['packages', 'company', 'hibarrFields', 'products', 'leadStage']);

        app(PackagePipelineRouterService::class)->attemptRoutingFromDealState(
            $deal,
            null,
            $packageExplicitlySelected,
        );

        return $deal->fresh(['packages', 'company', 'products', 'leadStage']);
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
        if (!$deal->id) {
            Log::warning('DealCreationService: Cannot upsert Hibarr fields for unsaved deal', [
                'deal_name' => $deal->name,
                'lead_id' => $deal->lead_id,
            ]);
            return;
        }
        
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
     * Upsert custom fields for a deal.
     * Accepts any key-value pairs in custom_fields format (e.g., {"131": "value", "132": "value", "200": "another value"}).
     * The key is the custom field ID, and the value will be stored for that field.
     * Also handles custom_fields_data format for backward compatibility.
     *
     * @param Deal $deal
     * @param Request $request
     * @return void
     */
    private function upsertCustomFields(Deal $deal, Request $request): void
    {
        if (!$deal->id) {
            Log::warning('DealCreationService: Cannot upsert custom fields for unsaved deal', [
                'deal_name' => $deal->name,
                'lead_id' => $deal->lead_id,
            ]);
            return;
        }
        
        $customFieldsData = [];
        
        // Handle custom_fields format - accepts any field ID and value
        // Format: {"131": "value", "132": "value", "200": "another value", ...}
        // The key is the custom field ID, value can be any type (string, number, array, etc.)
        if ($request->has('custom_fields') && is_array($request->input('custom_fields'))) {
            foreach ($request->input('custom_fields') as $fieldId => $value) {
                // Convert field ID to string and ensure it's a valid key
                $fieldId = (string) $fieldId;
                
                // Skip null values, but allow empty strings, 0, false, etc.
                if ($value !== null) {
                    $customFieldsData['field_' . $fieldId] = $value;
                }
            }
        }
        
        // Handle standard custom_fields_data format if provided (field_131, field_132, etc.)
        // This format uses "field_{id}" as the key directly
        if ($request->has('custom_fields_data') && is_array($request->input('custom_fields_data'))) {
            // Merge with existing custom fields data, with custom_fields_data taking precedence
            $customFieldsData = array_merge($customFieldsData, $request->input('custom_fields_data'));
        }
        
        // Update custom fields if we have any data
        if (!empty($customFieldsData)) {
            try {
                // Pass company_id to ensure correct date formatting for date-type custom fields
                // This prevents issues when company() helper returns a different company
                $deal->updateCustomFieldData($customFieldsData, $deal->company_id);
            } catch (\Exception $e) {
                Log::error('DealCreationService: Error updating custom fields', [
                    'deal_id' => $deal->id,
                    'error' => $e->getMessage(),
                    'trace' => $e->getTraceAsString(),
                    'custom_fields_data' => $customFieldsData,
                ]);
            }
        }
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
        // Normalize empty strings and whitespace-only strings to null to prevent matching records with empty meeting_id
        $meetingId = isset($meetingData['meeting_id']) && trim($meetingData['meeting_id']) !== '' 
            ? trim($meetingData['meeting_id']) 
            : null;

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

        // Use transaction with row-level locking to prevent race conditions
        // This ensures only one request can create/update a follow-up for the same meeting_id/deal_id combination
        DB::transaction(function () use ($meetingId, $deal, $meetingTypeId, $meetingDate, $meetingData) {
            $followUp = null;
            
            if ($meetingId !== null) {
                // Lock the row if it exists to prevent concurrent creation
                // This ensures atomicity: only one request can proceed with create/update
                $followUp = DealFollowUp::where('meeting_id', $meetingId)
                    ->where('deal_id', $deal->id)
                    ->lockForUpdate()
                    ->first();
            }
                    
            if ($followUp) {
                // Update existing follow-up
                $updateData = [];
                
                // Only update meeting_type_id if it's not null
                if ($meetingTypeId !== null) {
                    $updateData['meeting_type_id'] = $meetingTypeId;
                }
                
                // Only update next_follow_up_date if it's not null
                if ($meetingDate !== null) {
                    $updateData['next_follow_up_date'] = $meetingDate;
                }
                
                if (isset($meetingData['meeting_location'])) $updateData['location'] = $meetingData['meeting_location'];
                if (isset($meetingData['meeting_link'])) $updateData['meeting_link'] = $meetingData['meeting_link'];
                
                // Only update status if current status is 'scheduled' or null
                // Preserve 'completed' or 'cancelled' status
                $currentStatus = $followUp->status;
                if ($currentStatus !== 'completed' && $currentStatus !== 'cancelled') {
                    $updateData['status'] = 'scheduled';
                    
                    // If status is explicitly provided in request and current status is not final, use it
                    if (isset($meetingData['status']) && in_array($meetingData['status'], ['scheduled', 'completed', 'cancelled'])) {
                        $updateData['status'] = $meetingData['status'];
                    }
                }
                // Note: Explicit status override is only allowed when current status is not a final state
                // This prevents accidentally rescheduling completed or cancelled meetings
                
                if (!empty($updateData)) {
                    $followUp->update($updateData);
                }
            } else {
                // Double-check pattern: After lock, check again to handle race condition
                // where another concurrent request created the record between our check and now
                if ($meetingId !== null) {
                    $existingFollowUp = DealFollowUp::where('meeting_id', $meetingId)
                        ->where('deal_id', $deal->id)
                        ->first();
                        
                    if ($existingFollowUp) {
                        // Another request created it during our transaction, update it instead
                        $updateData = [];
                        if ($meetingTypeId !== null) {
                            $updateData['meeting_type_id'] = $meetingTypeId;
                        }
                        if ($meetingDate !== null) {
                            $updateData['next_follow_up_date'] = $meetingDate;
                        }
                        if (isset($meetingData['meeting_location'])) $updateData['location'] = $meetingData['meeting_location'];
                        if (isset($meetingData['meeting_link'])) $updateData['meeting_link'] = $meetingData['meeting_link'];
                        
                        $currentStatus = $existingFollowUp->status;
                        if ($currentStatus !== 'completed' && $currentStatus !== 'cancelled') {
                            $updateData['status'] = 'scheduled';
                            if (isset($meetingData['status']) && in_array($meetingData['status'], ['scheduled', 'completed', 'cancelled'])) {
                                $updateData['status'] = $meetingData['status'];
                            }
                        }
                        
                        if (!empty($updateData)) {
                            $existingFollowUp->update($updateData);
                        }
                        return;
                    }
                }

                // Create new DealFollowUp (only if it doesn't exist after all checks)
                $followUp = new DealFollowUp();
                $followUp->deal_id = $deal->id;
                $followUp->meeting_type_id = $meetingTypeId;
                $followUp->location = $meetingData['meeting_location'] ?? 'office';
                $followUp->meeting_link = $meetingData['meeting_link'] ?? null;
                $followUp->meeting_id = $meetingId;
                $followUp->next_follow_up_date = $meetingDate;
                $followUp->status = 'scheduled';
                $followUp->added_by = $deal->agent_id ? LeadAgent::find($deal->agent_id)?->user_id : null;
                
                // Save quietly to bypass observers
                $followUp->saveQuietly();
            }
        });
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
            // Notify all admins if no agent is assigned (except the actor)
            $admins = User::allAdmins($deal->company_id);
            $actorId = user()?->id;
            if ($actorId !== null) {
                $admins = $admins->reject(fn (User $admin) => (int) $admin->id === (int) $actorId);
            }
            if ($admins->isNotEmpty()) {
                Notification::send($admins, new LeadAgentAssigned($deal));
            }
        }

        // Always notify deal watchers if they exist (except the actor)
        if ($deal->dealWatchers->isNotEmpty()) {
            $watchers = $deal->dealWatchers;
            $actorId = user()?->id;
            if ($actorId !== null) {
                $watchers = $watchers->reject(fn (User $watcher) => (int) $watcher->id === (int) $actorId);
            }
            if ($watchers->isNotEmpty()) {
                Notification::send($watchers, new LeadAgentAssigned($deal));
            }
        }
    }

    /**
     * Normalize user ID list from request input (supports scalar or array).
     */
    private function normalizeUserIdList(mixed $value): array
    {
        if ($value === null || $value === '') {
            return [];
        }

        if (is_numeric($value)) {
            return [(int) $value];
        }

        if (!is_array($value)) {
            return [];
        }

        return array_values(array_unique(array_filter(array_map(
            static fn ($id) => is_numeric($id) ? (int) $id : null,
            $value
        ))));
    }

    /**
     * Extract user IDs from request, including optional alternate key.
     * Returns null when the field was omitted; an array when present (empty arrays are no-ops).
     */
    private function extractUserIdList(Request $request, string $key, ?string $alternateKey = null): ?array
    {
        if ($request->has($key)) {
            return $this->normalizeUserIdList($request->input($key));
        }

        if ($alternateKey !== null && $request->has($alternateKey)) {
            return $this->normalizeUserIdList($request->input($alternateKey));
        }

        return null;
    }

    /**
     * Resolve valid active user IDs scoped to company when possible.
     */
    private function resolveValidUserIds(array $userIds, int $companyId): array
    {
        if (empty($userIds)) {
            return [];
        }

        return User::query()
            ->whereIn('id', $userIds)
            ->when($companyId > 0, fn ($query) => $query->where('company_id', $companyId))
            ->pluck('id')
            ->toArray();
    }
}

