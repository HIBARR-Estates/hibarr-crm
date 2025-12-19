<?php

namespace App\Jobs;

use App\Http\Controllers\Api\DealContactApiController;
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
     * @param DealContactApiController $controller
     * @return void
     */
    public function handle(DealContactApiController $controller)
    {
        try {
            $controller->processDealInQueue(
                $this->contactId,
                $this->companyId,
                $this->requestData
            );
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

