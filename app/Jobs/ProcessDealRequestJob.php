<?php

namespace App\Jobs;

use App\Services\DealCreationService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessDealRequestJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds to wait before retrying the job.
     *
     * @var int
     */
    public $backoff = 10;

    /**
     * The number of seconds the job can run before timing out.
     * Set to 90 seconds to cover expected run time of DealCreationService::processDeal()
     * which includes database transactions, lock management, and deal creation/updates.
     *
     * @var int
     */
    public $timeout = 90;

    /**
     * Create a new job instance.
     *
     * @param int $contactId
     * @param int $companyId
     * @param array $requestData
     */
    public function __construct(
        public int $contactId,
        public int $companyId,
        public array $requestData
    ) {}

    /**
     * Execute the job.
     *
     * @param DealCreationService $service
     * @return void
     */
    public function handle(DealCreationService $service)
    {
        // Note: Queue jobs run in CLI context without HTTP session/auth context.
        // No need to clear auth/session as they don't exist in this context.
        // The observer fix (checking if user() exists) handles null user cases.
        
        try {
            Log::info('ProcessDealRequestJob: Starting deal processing', [
                'contact_id' => $this->contactId,
                'company_id' => $this->companyId,
                'has_update_agent_if_exists' => array_key_exists('update_agent_if_exists', $this->requestData),
                'update_agent_if_exists' => $this->requestData['update_agent_if_exists'] ?? null,
                'deal_owner_id' => $this->requestData['deal_owner_id'] ?? null,
                'email' => $this->requestData['email'] ?? null,
            ]);

            $service->processDeal(
                $this->contactId,
                $this->companyId,
                $this->requestData
            );

            Log::info('ProcessDealRequestJob: Completed deal processing', [
                'contact_id' => $this->contactId,
                'company_id' => $this->companyId,
            ]);
        } catch (\Exception $e) {
            Log::error('ProcessDealRequestJob: Failed to process deal', [
                'contact_id' => $this->contactId,
                'company_id' => $this->companyId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            // Re-throw to trigger retry mechanism
            throw $e;
        }
    }
}

