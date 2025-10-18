<?php

namespace App\Jobs;

use App\Models\Property;
use App\Services\PropertyAssetService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class ProcessPropertyAssetsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected $property;
    protected $assets;

    /**
     * Create a new job instance.
     */
    public function __construct(Property $property, array $assets)
    {
        $this->property = $property;
        $this->assets = $assets;
    }

    /**
     * Execute the job.
     */
    public function handle(PropertyAssetService $assetService): void
    {
        try {
            Log::info("Processing assets for property {$this->property->id}");

            $updatedAssets = [];

            // Process photos
            if (isset($this->assets['photos']) && !empty($this->assets['photos'])) {
                $uploadedPhotos = $assetService->uploadPhotos($this->property, $this->assets['photos']);
                $updatedAssets['photos'] = array_merge($this->property->photos ?? [], $uploadedPhotos);
            }

            // Process video
            if (isset($this->assets['video']) && !empty($this->assets['video'])) {
                if (is_string($this->assets['video'])) {
                    // External URL
                    $updatedAssets['video_url'] = $this->assets['video'];
                } else {
                    // File upload
                    $updatedAssets['video_url'] = $assetService->uploadVideo($this->property, $this->assets['video']);
                }
            }

            // Process 360 tour
            if (isset($this->assets['tour_360']) && !empty($this->assets['tour_360'])) {
                if (is_string($this->assets['tour_360'])) {
                    // External URL
                    $updatedAssets['tour_360_url'] = $this->assets['tour_360'];
                } else {
                    // File upload
                    $updatedAssets['tour_360_url'] = $assetService->upload360Tour($this->property, $this->assets['tour_360']);
                }
            }

            // Update property with new asset URLs
            if (!empty($updatedAssets)) {
                $this->property->update($updatedAssets);
                Log::info("Assets processed successfully for property {$this->property->id}", $updatedAssets);
            }

        } catch (\Exception $e) {
            Log::error("Error processing assets for property {$this->property->id}: " . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error("Failed to process assets for property {$this->property->id}: " . $exception->getMessage());
    }
}