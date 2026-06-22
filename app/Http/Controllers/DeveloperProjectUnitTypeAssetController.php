<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\DeveloperProjectUnitTypeAsset;
use App\Helper\Reply;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use League\Flysystem\CorruptedPathDetected;
use Throwable;

/**
 * DeveloperProjectUnitTypeAssetController
 * 
 * Handles photo/asset management for unit types within developer projects.
 * Follows the same pattern as PropertyAssetController.
 */
class DeveloperProjectUnitTypeAssetController extends Controller
{
    /**
     * List all assets for a unit type.
     */
    public function index($projectId, $unitTypeId)
    {
        $unitType = $this->findUnitType($projectId, $unitTypeId);

        $assets = $unitType->assets()
            ->ordered()
            ->get();

        return Reply::successWithData('Assets retrieved', [
            'assets' => $assets,
        ]);
    }

    /**
     * Upload new assets for a unit type.
     */
    public function store(Request $request, $projectId, $unitTypeId)
    {
        $unitType = $this->findUnitType($projectId, $unitTypeId);

        $validator = Validator::make($request->all(), [
            'files' => 'required|array',
            'files.*' => 'file|max:51200', // 50MB max
            'tags' => 'nullable|array',
            'tags.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitTypeAsset::AVAILABLE_TAGS)),
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        try {
            DB::beginTransaction();

            $assets = [];
            $maxOrder = $unitType->assets()->max('order') ?? 0;

            foreach ($request->file('files') as $file) {
                $path = $file->store(
                    'developer-project-unit-type-assets/' . $unitType->id,
                    'public'
                );

                $asset = DeveloperProjectUnitTypeAsset::create([
                    'unit_type_id' => $unitType->id,
                    'company_id' => user()->company_id,
                    'name' => $file->getClientOriginalName(),
                    'asset_type' => str_starts_with($file->getMimeType(), 'video/')
                        ? DeveloperProjectUnitTypeAsset::TYPE_VIDEO
                        : DeveloperProjectUnitTypeAsset::TYPE_IMAGE,
                    'file_path' => $path,
                    'mime_type' => $file->getMimeType(),
                    'file_size' => $file->getSize(),
                    'tags' => $request->tags ?? [],
                    'order' => ++$maxOrder,
                ]);

                $assets[] = $asset;
            }

            DB::commit();

            return Reply::successWithData('Assets uploaded successfully', [
                'assets' => $assets,
                'count' => count($assets),
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error('Failed to upload assets: ' . $e->getMessage());
        }
    }

    /**
     * Update an asset (tags, name, order).
     */
    public function update(Request $request, $projectId, $unitTypeId, $assetId)
    {
        $unitType = $this->findUnitType($projectId, $unitTypeId);
        $asset = $unitType->assets()->findOrFail($assetId);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:255',
            'tags' => 'sometimes|array',
            'tags.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitTypeAsset::AVAILABLE_TAGS)),
            'order' => 'sometimes|integer|min:0',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $asset->update($request->only(['name', 'tags', 'order']));

        return Reply::successWithData('Asset updated successfully', [
            'asset' => $asset->fresh(),
        ]);
    }

    /**
     * Delete an asset.
     */
    public function destroy($projectId, $unitTypeId, $assetId)
    {
        try {
            $unitType = $this->findUnitType($projectId, $unitTypeId);
            $asset = $unitType->assets()->findOrFail($assetId);

            $fileWarning = $this->deleteAssetFile($asset);
            $asset->delete();

            $message = 'Asset deleted successfully';
            if ($fileWarning) {
                $message .= ' However, ' . $fileWarning;
            }

            return Reply::success($message);
        } catch (Throwable $e) {
            Log::error('Failed to delete unit type asset', [
                'project_id' => $projectId,
                'unit_type_id' => $unitTypeId,
                'asset_id' => $assetId,
                'error' => $e->getMessage(),
            ]);

            return Reply::error(
                $this->assetDeletionErrorMessage($e),
                'asset_delete_failed'
            );
        }
    }

    /**
     * Bulk delete assets.
     */
    public function bulkDestroy(Request $request, $projectId, $unitTypeId)
    {
        $validator = Validator::make($request->all(), [
            'asset_ids' => 'required|array',
            'asset_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first(), 'validation_error');
        }

        try {
            $unitType = $this->findUnitType($projectId, $unitTypeId);
            $assets = $unitType->assets()->whereIn('id', $request->asset_ids)->get();

            if ($assets->isEmpty()) {
                return Reply::error(
                    'No matching photos were found. Refresh the page and try again.',
                    'asset_not_found'
                );
            }

            $fileWarnings = [];

            foreach ($assets as $asset) {
                $warning = $this->deleteAssetFile($asset);
                if ($warning) {
                    $fileWarnings[] = $warning;
                }
                $asset->delete();
            }

            $count = $assets->count();
            $message = $count === 1
                ? 'Photo deleted successfully'
                : "{$count} photos deleted successfully";

            if (!empty($fileWarnings)) {
                $message .= ' However, some stored files could not be removed: '
                    . implode(' ', $fileWarnings);
            }

            return Reply::successWithData($message, [
                'count' => $count,
                'file_warnings' => $fileWarnings,
            ]);
        } catch (Throwable $e) {
            Log::error('Failed to bulk delete unit type assets', [
                'project_id' => $projectId,
                'unit_type_id' => $unitTypeId,
                'asset_ids' => $request->input('asset_ids', []),
                'error' => $e->getMessage(),
            ]);

            return Reply::error(
                $this->assetDeletionErrorMessage($e),
                'asset_delete_failed'
            );
        }
    }

    /**
     * Bulk update tags on multiple unit-type assets.
     *
     * Supports three actions:
     *  - add:     merge supplied tags into each asset's existing tags
     *  - remove:  remove supplied tags from each asset's existing tags
     *  - replace: overwrite each asset's tags with the supplied set
     */
    public function bulkUpdateTags(Request $request, $projectId, $unitTypeId)
    {
        $unitType = $this->findUnitType($projectId, $unitTypeId);

        $request->validate([
            'asset_ids' => 'required|array|min:1',
            'asset_ids.*' => 'integer',
            'tags' => 'required|array',
            'tags.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitTypeAsset::AVAILABLE_TAGS)),
            'action' => 'required|in:add,replace,remove',
        ]);

        $assets = $unitType->assets()
            ->whereIn('id', $request->input('asset_ids'))
            ->get();

        $tags = $request->input('tags');
        $action = $request->input('action');
        $updated = 0;

        DB::beginTransaction();
        try {
            foreach ($assets as $asset) {
                $current = $asset->tags ?? [];

                switch ($action) {
                    case 'add':
                        $newTags = array_values(array_unique(array_merge($current, $tags)));
                        break;
                    case 'remove':
                        $newTags = array_values(array_diff($current, $tags));
                        break;
                    case 'replace':
                    default:
                        $newTags = $tags;
                        break;
                }

                $asset->update(['tags' => $newTags]);
                $updated++;
            }

            DB::commit();

            return Reply::successWithData("Tags updated on {$updated} asset(s)", [
                'updated' => $updated,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Store assets from pre-uploaded URLs (from external FileUploadService).
     *
     * Accepts an array of assets already uploaded to an external service
     * and creates DeveloperProjectUnitTypeAsset records pointing to those URLs.
     */
    public function storeFromUrls(Request $request, $projectId, $unitTypeId)
    {
        $unitType = $this->findUnitType($projectId, $unitTypeId);

        $validator = Validator::make($request->all(), [
            'assets' => 'required|array|min:1',
            'assets.*.url' => 'required|url',
            'assets.*.name' => 'required|string|max:255',
            'assets.*.object_path' => 'nullable|string|max:500',
            'assets.*.asset_type' => 'required|in:image,video',
            'assets.*.mime_type' => 'nullable|string|max:100',
            'assets.*.file_size' => 'nullable|integer',
            'tags' => 'nullable|array',
            'tags.*' => 'string|in:' . implode(',', array_keys(DeveloperProjectUnitTypeAsset::AVAILABLE_TAGS)),
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        try {
            DB::beginTransaction();

            $createdAssets = [];
            $tags = $request->input('tags', []);
            $maxOrder = $unitType->assets()->max('order') ?? 0;

            foreach ($request->input('assets') as $index => $assetData) {
                $asset = DeveloperProjectUnitTypeAsset::create([
                    'unit_type_id' => $unitType->id,
                    'company_id' => user()->company_id,
                    'asset_type' => $assetData['asset_type'],
                    'name' => $assetData['name'],
                    'external_url' => $assetData['url'],
                    'file_path' => $assetData['object_path'] ?? null,
                    'mime_type' => $assetData['mime_type'] ?? null,
                    'file_size' => $assetData['file_size'] ?? null,
                    'tags' => $tags,
                    'order' => $maxOrder + $index + 1,
                ]);

                $createdAssets[] = $asset;
            }

            DB::commit();

            return Reply::successWithData('Unit type assets uploaded successfully', [
                'assets' => $createdAssets,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error('Failed to save assets: ' . $e->getMessage());
        }
    }

    /**
     * Delete the physical file for an asset, if one exists.
     *
     * Externally stored assets (uploaded via FileUploadService) must be removed
     * through FileStorageService. Local uploads use the public disk.
     * Failures are logged and a user-facing warning is returned, but do not
     * block database deletion.
     *
     * @return string|null User-facing warning when file removal fails
     */
    private function deleteAssetFile(DeveloperProjectUnitTypeAsset $asset): ?string
    {
        $assetLabel = $asset->name ?: 'photo #' . $asset->id;

        if (!empty($asset->external_url)) {
            $objectPath = $asset->file_path;

            if (empty($objectPath)) {
                $objectPath = FileStorageService::extractObjectPathFromUrl($asset->external_url);
            }

            if (empty($objectPath)) {
                return "the stored file for \"{$assetLabel}\" could not be located";
            }

            try {
                app(FileStorageService::class)->delete($objectPath);
            } catch (\Exception $e) {
                Log::warning('Failed to delete external unit type asset file', [
                    'asset_id' => $asset->id,
                    'object_path' => $objectPath,
                    'error' => $e->getMessage(),
                ]);

                return $this->assetFileDeletionWarning($assetLabel, $e);
            }

            return null;
        }

        if (empty($asset->file_path)) {
            return null;
        }

        try {
            if (Storage::disk('public')->exists($asset->file_path)) {
                Storage::disk('public')->delete($asset->file_path);
            }
        } catch (\Exception $e) {
            Log::warning('Failed to delete local unit type asset file', [
                'asset_id' => $asset->id,
                'file_path' => $asset->file_path,
                'error' => $e->getMessage(),
            ]);

            return $this->assetFileDeletionWarning($assetLabel, $e);
        }

        return null;
    }

    /**
     * Build a user-facing error message for asset deletion failures.
     */
    private function assetDeletionErrorMessage(Throwable $e): string
    {
        if ($e instanceof \Illuminate\Database\Eloquent\ModelNotFoundException) {
            return 'One or more selected photos could not be found. Refresh the page and try again.';
        }

        if ($e instanceof CorruptedPathDetected) {
            return 'Could not delete one or more photos because a stored file path is invalid. Refresh the page and try again, or contact support if the problem persists.';
        }

        if ($e instanceof \Illuminate\Database\QueryException) {
            return 'Failed to delete photos due to a database error. Please try again.';
        }

        $message = trim($e->getMessage());
        if ($message !== '') {
            return 'Failed to delete photos: ' . $message;
        }

        return 'Failed to delete photos. Please try again or contact support if the problem persists.';
    }

    /**
     * Build a user-facing warning when the DB record is removed but file cleanup fails.
     */
    private function assetFileDeletionWarning(string $assetLabel, \Exception $e): string
    {
        if ($e instanceof CorruptedPathDetected) {
            return "\"{$assetLabel}\" was removed, but its stored file could not be deleted because the file path is invalid.";
        }

        return "\"{$assetLabel}\" was removed, but its stored file could not be deleted from storage.";
    }

    /**
     * Find a unit type with authorization check.
     */
    private function findUnitType($projectId, $unitTypeId): DeveloperProjectUnitType
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        return $project->unitTypes()->findOrFail($unitTypeId);
    }
}
