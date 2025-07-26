<?php

namespace App\Jobs;

use App\Models\Deal;
use App\Traits\DealAutomationTrait;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class DealAutomationJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels, DealAutomationTrait;

    public $tries = 3;
    public $timeout = 30;

    protected $type;
    protected $dealId;
    protected $requestData;

    /**
     * Create a new job instance.
     *
     * @param string $type
     * @param int $dealId
     * @param array $requestData
     */
    public function __construct(string $type, int $dealId, array $requestData = [])
    {
        $this->type = $type;
        $this->dealId = $dealId;
        $this->requestData = $requestData;
    }

    /**
     * Execute the job.
     *
     * @return void
     */
    public function handle()
    {
        try {
            $deal = Deal::findOrFail($this->dealId);
            
            // Create a mock request object for the trait methods
            $request = new Request($this->requestData);

            if ($this->type === 'create') {
                $this->triggerDealCreationAutomation($request);
            } else {
                $this->triggerDealUpdateAutomation($request, $deal);
            }

        } catch (\Throwable $e) {
            Log::error("Deal automation job failed", [
                'type' => $this->type,
                'deal_id' => $this->dealId,
                'exception' => $e,
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     *
     * @param \Throwable $exception
     * @return void
     */
    public function failed(\Throwable $exception)
    {
        Log::error("Deal automation job failed permanently", [
            'type' => $this->type,
            'deal_id' => $this->dealId,
            'exception' => $exception,
        ]);
    }
}