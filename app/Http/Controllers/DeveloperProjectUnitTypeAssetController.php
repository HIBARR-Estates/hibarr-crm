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
        $unitType = $this->findUnitType($projectId, $unitTypeId);
        $asset = $unitType->assets()->findOrFail($assetId);

        $this->deleteAssetFile($asset);

        $asset->delete();

        return Reply::success('Asset deleted successfully');
    }

    /**
     * Bulk delete assets.
     */
    public function bulkDestroy(Request $request, $projectId, $unitTypeId)
    {
        $unitType = $this->findUnitType($projectId, $unitTypeId);

        $validator = Validator::make($request->all(), [
            'asset_ids' => 'required|array',
            'asset_ids.*' => 'integer',
        ]);

        if ($validator->fails()) {
            return Reply::error($validator->errors()->first());
        }

        $assets = $unitType->assets()->whereIn('id', $request->asset_ids)->get();

        foreach ($assets as $asset) {
            $this->deleteAssetFile($asset);
            $asset->delete();
        }

        return Reply::successWithData('Assets deleted successfully', [
            'count' => $assets->count(),
        ]);
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
     * Failures are logged but do not block database deletion.
     */
    private function deleteAssetFile(DeveloperProjectUnitTypeAsset $asset): void
    {
        if (!empty($asset->external_url)) {
            $objectPath = $asset->file_path;

            if (empty($objectPath)) {
                $objectPath = FileStorageService::extractObjectPathFromUrl($asset->external_url);
            }

            if (empty($objectPath)) {
                return;
            }

            try {
                app(FileStorageService::class)->delete($objectPath);
            } catch (\Exception $e) {
                Log::warning('Failed to delete external unit type asset file', [
                    'asset_id' => $asset->id,
                    'object_path' => $objectPath,
                    'error' => $e->getMessage(),
                ]);
            }

            return;
        }

        if (empty($asset->file_path)) {
            return;
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
        }
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
