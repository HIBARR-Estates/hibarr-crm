<?php

namespace App\Services;

use App\Models\Property;
use App\Models\PropertyAsset;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Support\Collection;

class PropertyAssetManagementService
{
    protected $disk = 'local';
    protected $basePath = 'properties';

    /**
     * Upload multiple assets
     *
     * @param Property $property
     * @param array<UploadedFile> $files
     * @param string $assetType
     * @param array $tags
     * @return Collection<PropertyAsset>
     */
    public function uploadAssets(
        Property $property,
        array $files,
        string $assetType = 'image',
        array $tags = []
    ): Collection {
        $assets = collect();

        foreach ($files as $file) {
            $asset = $this->uploadSingleAsset($property, $file, $assetType, $tags);
            if ($asset) {
                $assets->push($asset);
            }
        }

        return $assets;
    }

    /**
     * Upload a single asset
     */
    public function uploadSingleAsset(
        Property $property,
        UploadedFile $file,
        string $assetType = 'image',
        array $tags = []
    ): PropertyAsset {
        $filename = $this->generateFilename($file);
        $subFolder = $assetType === 'image' ? 'photos' : 'videos';
        $path = "{$this->basePath}/{$property->id}/{$subFolder}/{$filename}";

        // Store the file
        Storage::disk($this->disk)->put($path, file_get_contents($file));

        // Get file metadata
        $metadata = $this->extractMetadata($file);

        // Create asset record
        return PropertyAsset::create([
            'property_id' => $property->id,
            'company_id' => $property->company_id,
            'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            'asset_type' => $assetType,
            'file_path' => $path,
            'mime_type' => $file->getMimeType(),
            'file_size' => $file->getSize(),
            'tags' => $tags,
            'metadata' => $metadata,
        ]);
    }

    /**
     * Create external URL asset (video, 360 tour)
     */
    public function createExternalUrlAsset(
        Property $property,
        string $url,
        string $assetType,
        string $name,
        array $tags = []
    ): PropertyAsset {
        return PropertyAsset::create([
            'property_id' => $property->id,
            'company_id' => $property->company_id,
            'name' => $name,
            'asset_type' => $assetType,
            'external_url' => $url,
            'tags' => $tags,
        ]);
    }

    /**
     * Delete a single asset
     */
    public function deleteAsset(PropertyAsset $asset): bool
    {
        // Delete physical file if exists
        if ($asset->file_path && Storage::disk('local')->exists($asset->file_path)) {
            Storage::disk('local')->delete($asset->file_path);
        }

        return $asset->delete();
    }

    /**
     * Bulk delete assets
     */
    public function bulkDeleteAssets(Property $property, array $assetIds): int
    {
        $assets = PropertyAsset::where('property_id', $property->id)
            ->whereIn('id', $assetIds)
            ->get();

        $deleted = 0;
        foreach ($assets as $asset) {
            if ($this->deleteAsset($asset)) {
                $deleted++;
            }
        }

        return $deleted;
    }

    /**
     * Bulk update tags
     */
    public function bulkUpdateTags(
        Property $property,
        array $assetIds,
        array $tags,
        string $action = 'add'
    ): int {
        $assets = PropertyAsset::where('property_id', $property->id)
            ->whereIn('id', $assetIds)
            ->get();

        $updated = 0;
        foreach ($assets as $asset) {
            $currentTags = $asset->tags ?? [];

            switch ($action) {
                case 'add':
                    // Add new tags without duplicates
                    $newTags = array_unique(array_merge($currentTags, $tags));
                    $asset->update(['tags' => $newTags]);
                    break;

                case 'replace':
                    // Replace all tags
                    $asset->update(['tags' => $tags]);
                    break;

                case 'remove':
                    // Remove specified tags
                    $newTags = array_filter($currentTags, fn($tag) => !in_array($tag, $tags));
                    $asset->update(['tags' => array_values($newTags)]);
                    break;
            }

            $updated++;
        }

        return $updated;
    }

    /**
     * Update asset name
     */
    public function updateAssetName(PropertyAsset $asset, string $name): PropertyAsset
    {
        $asset->update(['name' => $name]);
        return $asset->fresh();
    }

    /**
     * Reorder assets
     */
    public function reorderAssets(Property $property, array $orderedIds): void
    {
        foreach ($orderedIds as $index => $assetId) {
            PropertyAsset::where('property_id', $property->id)
                ->where('id', $assetId)
                ->update(['order' => $index]);
        }
    }

    /**
     * Generate unique filename
     */
    private function generateFilename(UploadedFile $file): string
    {
        $extension = $file->getClientOriginalExtension();
        $timestamp = now()->format('YmdHis');
        $random = Str::random(8);
        return "{$timestamp}_{$random}.{$extension}";
    }

    /**
     * Extract metadata from file
     */
    private function extractMetadata(UploadedFile $file): array
    {
        $metadata = [
            'original_name' => $file->getClientOriginalName(),
            'extension' => $file->getClientOriginalExtension(),
        ];

        // For images, extract dimensions
        if (Str::startsWith($file->getMimeType(), 'image/')) {
            try {
                $imageSize = getimagesize($file->getRealPath());
                if ($imageSize) {
                    $metadata['width'] = $imageSize[0];
                    $metadata['height'] = $imageSize[1];
                    $metadata['aspect_ratio'] = round($imageSize[0] / $imageSize[1], 2);
                }
            } catch (\Exception $e) {
                // Ignore if unable to get dimensions
            }
        }

        return $metadata;
    }

    /**
     * Get assets grouped by tags
     */
    public function getAssetsByTags(Property $property): array
    {
        $assets = PropertyAsset::where('property_id', $property->id)
            ->newest()
            ->get();

        $grouped = [];
        $availableTags = PropertyAsset::getAvailableTags();

        foreach ($availableTags as $tagKey => $tagLabel) {
            $grouped[$tagKey] = $assets->filter(fn($asset) => $asset->hasTag($tagKey));
        }

        $grouped['untagged'] = $assets->filter(fn($asset) => empty($asset->tags));

        return $grouped;
    }
}
