<?php

namespace App\Services;

use App\Models\Property;
use App\Jobs\ProcessPropertyAssetsJob;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PropertyAssetService
{
    protected $disk = 'public';
    protected $basePath = 'properties';

    /**
     * Process and store property assets
     */
    public function processAssets(Property $property, array $assets): void
    {
        // Dispatch job to process assets in the background
        ProcessPropertyAssetsJob::dispatch($property, $assets);
    }

    /**
     * Upload property photos
     */
    public function uploadPhotos(Property $property, array $photos): array
    {
        $uploadedPhotos = [];
        
        foreach ($photos as $photo) {
            if ($photo instanceof UploadedFile) {
                $filename = $this->generateFilename($photo);
                $path = "{$this->basePath}/{$property->id}/photos/{$filename}";
                
                Storage::disk($this->disk)->put($path, file_get_contents($photo));
                $uploadedPhotos[] = Storage::disk($this->disk)->url($path);
            }
        }

        return $uploadedPhotos;
    }

    /**
     * Upload video file
     */
    public function uploadVideo(Property $property, UploadedFile $video): string
    {
        $filename = $this->generateFilename($video);
        $path = "{$this->basePath}/{$property->id}/videos/{$filename}";
        
        Storage::disk($this->disk)->put($path, file_get_contents($video));
        
        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Upload 360 tour assets
     */
    public function upload360Tour(Property $property, UploadedFile $tour): string
    {
        $filename = $this->generateFilename($tour);
        $path = "{$this->basePath}/{$property->id}/tours/{$filename}";
        
        Storage::disk($this->disk)->put($path, file_get_contents($tour));
        
        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Update property photos
     */
    public function updatePhotos(Property $property, array $newPhotos): void
    {
        // Delete old photos
        $this->deleteAssets($property, 'photos');
        
        // Upload new photos
        $uploadedPhotos = $this->uploadPhotos($property, $newPhotos);
        
        // Update property
        $property->update(['photos' => $uploadedPhotos]);
    }

    /**
     * Delete a single photo from property
     */
    public function deleteSinglePhoto(Property $property, string $photoUrl): bool
    {
        $currentPhotos = $property->photos ?? [];
        
        // Remove the photo URL from the array
        $updatedPhotos = array_filter($currentPhotos, function($photo) use ($photoUrl) {
            return $photo !== $photoUrl;
        });
        
        // Re-index the array to maintain proper indexing
        $updatedPhotos = array_values($updatedPhotos);
        
        // Extract the file path from the URL for deletion
        $parsedUrl = parse_url($photoUrl);
        if (isset($parsedUrl['path'])) {
            // Remove leading slash and storage prefix
            $filePath = ltrim($parsedUrl['path'], '/');
            $filePath = str_replace('storage/', '', $filePath);
            
            // Delete the physical file
            if (Storage::disk($this->disk)->exists($filePath)) {
                Storage::disk($this->disk)->delete($filePath);
            }
        }
        
        // Update the property with the new photos array
        $property->update(['photos' => $updatedPhotos]);
        
        return true;
    }

    /**
     * Update a single photo in property (replace at specific index)
     */
    public function updateSinglePhoto(Property $property, int $photoIndex, UploadedFile $newPhoto): array
    {
        $currentPhotos = $property->photos ?? [];
        
        // Delete the old photo if it exists at the given index
        if (isset($currentPhotos[$photoIndex])) {
            $oldPhotoUrl = $currentPhotos[$photoIndex];
            $parsedUrl = parse_url($oldPhotoUrl);
            if (isset($parsedUrl['path'])) {
                $filePath = ltrim($parsedUrl['path'], '/');
                $filePath = str_replace('storage/', '', $filePath);
                
                if (Storage::disk($this->disk)->exists($filePath)) {
                    Storage::disk($this->disk)->delete($filePath);
                }
            }
        }
        
        // Upload the new photo
        $filename = $this->generateFilename($newPhoto);
        $path = "{$this->basePath}/{$property->id}/photos/{$filename}";
        
        Storage::disk($this->disk)->put($path, file_get_contents($newPhoto));
        $newPhotoUrl = Storage::disk($this->disk)->url($path);
        
        // Update the photos array at the specific index
        $currentPhotos[$photoIndex] = $newPhotoUrl;
        
        // Re-index to ensure proper array structure
        $updatedPhotos = array_values($currentPhotos);
        
        // Update the property
        $property->update(['photos' => $updatedPhotos]);
        
        return $updatedPhotos;
    }

    /**
     * Add a single photo to property
     */
    public function addSinglePhoto(Property $property, UploadedFile $photo): array
    {
        $currentPhotos = $property->photos ?? [];
        
        // Upload the new photo
        $filename = $this->generateFilename($photo);
        $path = "{$this->basePath}/{$property->id}/photos/{$filename}";
        
        Storage::disk($this->disk)->put($path, file_get_contents($photo));
        $newPhotoUrl = Storage::disk($this->disk)->url($path);
        
        // Add to the current photos array
        $currentPhotos[] = $newPhotoUrl;
        
        // Update the property
        $property->update(['photos' => $currentPhotos]);
        
        return $currentPhotos;
    }

    /**
     * Update video URL
     */
    public function updateVideo(Property $property, $video): void
    {
        $videoUrl = null;
        
        if ($video instanceof UploadedFile) {
            // Delete old video
            $this->deleteAssets($property, 'videos');
            $videoUrl = $this->uploadVideo($property, $video);
        } elseif (is_string($video)) {
            $videoUrl = $video; // External URL
        }
        
        $property->update(['video_url' => $videoUrl]);
    }

    /**
     * Update 360 tour
     */
    public function update360Tour(Property $property, $tour): void
    {
        $tourUrl = null;
        
        if ($tour instanceof UploadedFile) {
            // Delete old tour
            $this->deleteAssets($property, 'tours');
            $tourUrl = $this->upload360Tour($property, $tour);
        } elseif (is_string($tour)) {
            $tourUrl = $tour; // External URL
        }
        
        $property->update(['tour_360_url' => $tourUrl]);
    }

    /**
     * Delete property assets
     */
    public function deleteAssets(Property $property, string $type): void
    {
        $directory = "{$this->basePath}/{$property->id}/{$type}";
        
        if (Storage::disk($this->disk)->exists($directory)) {
            Storage::disk($this->disk)->deleteDirectory($directory);
        }
    }

    /**
     * Delete all property assets
     */
    public function deleteAllAssets(Property $property): void
    {
        $directory = "{$this->basePath}/{$property->id}";
        
        if (Storage::disk($this->disk)->exists($directory)) {
            Storage::disk($this->disk)->deleteDirectory($directory);
        }
    }

    /**
     * Generate unique filename
     */
    protected function generateFilename(UploadedFile $file): string
    {
        $extension = $file->getClientOriginalExtension();
        $name = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
        $slug = Str::slug($name);
        
        return $slug . '_' . time() . '_' . Str::random(8) . '.' . $extension;
    }

    /**
     * Validate file type
     */
    public function validateFileType(UploadedFile $file, string $type): bool
    {
        $allowedTypes = [
            'photo' => ['jpg', 'jpeg', 'png', 'webp'],
            'video' => ['mp4', 'mov', 'avi', 'mkv'],
            'tour' => ['zip', 'html', 'json'],
        ];

        $extension = strtolower($file->getClientOriginalExtension());
        
        return in_array($extension, $allowedTypes[$type] ?? []);
    }

    /**
     * Get asset URL
     */
    public function getAssetUrl(string $path): string
    {
        return Storage::disk($this->disk)->url($path);
    }

    /**
     * Check if asset exists
     */
    public function assetExists(string $path): bool
    {
        return Storage::disk($this->disk)->exists($path);
    }
}