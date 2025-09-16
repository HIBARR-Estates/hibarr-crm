<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use App\Enums\ResolutionStatus;
use App\Models\CommunicationActivity;
use App\Jobs\ResolveCommunicationActivityJob;

class CreateCommunicationActivityJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected array $normalizedData;

    /**
     * Create a new job instance.
     */
    public function __construct(array $normalizedData)
    {
        $this->normalizedData = $normalizedData;
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Normalize email content (strip HTML if email)
        if ($this->normalizedData['channel_type'] === 'email') {
            $this->normalizedData['message_content'] = strip_tags($this->normalizedData['message_content']);
        }
        // Always save as "pending" unresolved log
        $activity = CommunicationActivity::create(array_merge($this->normalizedData, [
            'resolution_status'   => ResolutionStatus::Pending->value,
            'resolution_attempts' => 0,
            // 'company_id' => companyId(), //TODO: This might not be present because this job can be dispatched from outside a company context, so confirm from business rules [either derive and account for it via the api_token or make it nullable and handle accordingly]//TODO: Verify this helper does not exist and if so create it
        ]));

        // Save files if attached
        if (isset($this->normalizedData['files']) && is_array($this->normalizedData['files'])) {
            foreach ($this->normalizedData['files'] as $file) {
                $activity->files()->create([
                    'file_url'  => $file['file_url'],
                    'file_type' => $file['file_type'],
                    'file_size' => $file['file_size'],
                ]);
            }
        }

        

        // Immediately attempt resolution (fast path)
        ResolveCommunicationActivityJob::dispatch($activity->id)->onQueue('resolvers');
    }
}
