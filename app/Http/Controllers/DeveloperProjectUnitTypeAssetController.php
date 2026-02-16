<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\DeveloperProjectUnitTypeAsset;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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

        // Delete the file from storage
        if ($asset->file_path && Storage::disk('public')->exists($asset->file_path)) {
            Storage::disk('public')->delete($asset->file_path);
        }

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
            if ($asset->file_path && Storage::disk('public')->exists($asset->file_path)) {
                Storage::disk('public')->delete($asset->file_path);
            }
            $asset->delete();
        }

        return Reply::successWithData('Assets deleted successfully', [
            'count' => $assets->count(),
        ]);
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
