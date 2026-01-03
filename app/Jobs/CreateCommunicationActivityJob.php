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
    protected bool $can_create_deal;

    /**
     * Create a new job instance.
     */
    public function __construct(array $normalizedData, bool $can_create_deal = false)
    {
        $this->normalizedData = $normalizedData;
        $this->can_create_deal = $can_create_deal;

        $this->onQueue('communication_activities');

    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        // Handle reply logic for email subjects
        if (isset($this->normalizedData['parent_activity_id'])) {
            $parentActivity = CommunicationActivity::find($this->normalizedData['parent_activity_id']);
            
            if ($parentActivity && $this->normalizedData['channel_type'] === 'email') {
                $originalSubject = $parentActivity->subject ?? '';
                
                // Add Re: prefix if not already present
                if (!empty($originalSubject) && !str_starts_with($originalSubject, 'Re: ')) {
                    $this->normalizedData['subject'] = 'Re: ' . $originalSubject;
                } else if (!empty($originalSubject)) {
                    $this->normalizedData['subject'] = $originalSubject;
                }
            }
        }

        // Normalize email content (strip HTML only for inbound emails)
        // Preserve HTML for outbound emails from the rich text editor
        $direction = $this->normalizedData['direction'] ?? 'inbound';
        if ($this->normalizedData['channel_type'] === 'email' && $direction === 'inbound') {
            $this->normalizedData['message_content'] = strip_tags($this->normalizedData['message_content']);
        }
        
        // Always store direction in metadata (use provided direction or default to 'inbound')
        // This ensures ResolveCommunicationActivityJob can check direction correctly
        $metadata = $this->normalizedData['metadata'] ?? [];
        $metadata['direction'] = $direction; // Always set direction, even if it's the default
        
        // Remove direction from normalizedData as it's not a database field
        $dataForCreation = $this->normalizedData;
        unset($dataForCreation['direction']);
        
        // Always save as "pending" unresolved log
        $activity = CommunicationActivity::create(array_merge($dataForCreation, [
            'resolution_status'   => ResolutionStatus::Pending->value,
            'resolution_attempts' => 0,
            'metadata' => $metadata,
        ]));
        
        // Log activity creation with direction for debugging
        \Illuminate\Support\Facades\Log::info('CreateCommunicationActivityJob: Activity created', [
            'activity_id' => $activity->id,
            'direction' => $direction,
            'metadata_direction' => $activity->metadata['direction'] ?? null,
            'channel_type' => $activity->channel_type,
        ]);

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
        ResolveCommunicationActivityJob::dispatch($activity->id, $this->can_create_deal);
    }
}
