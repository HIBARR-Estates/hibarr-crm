<?php

namespace App\Http\Controllers;

use App\Models\DeveloperProject;
use App\Models\DeveloperProjectAsset;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * DeveloperProjectAssetController
 *
 * Handles CRUD operations for project-level assets (images, videos).
 * Mirrors PropertyAssetController's storeFromUrls / destroy pattern
 * so the frontend FileUploadService flow works identically.
 */
class DeveloperProjectAssetController extends AccountBaseController
{
    /**
     * List assets for a developer project.
     */
    public function index(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $query = DeveloperProjectAsset::where('developer_project_id', $projectId);

        // Filter by asset_type
        if ($request->filled('asset_type')) {
            $query->where('asset_type', $request->asset_type);
        }

        // Filter by tags
        if ($request->filled('tags')) {
            $tags = is_array($request->tags) ? $request->tags : [$request->tags];
            $query->byTags($tags);
        }

        $assets = $query->ordered()->get();

        return Reply::successWithData('Project assets fetched', [
            'assets' => $assets,
        ]);
    }

    /**
     * Store assets from pre-uploaded URLs (from external FileUploadService).
     *
     * Accepts an array of assets already uploaded to an external service
     * and creates DeveloperProjectAsset records pointing to those URLs.
     */
    public function storeFromUrls(Request $request, $projectId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $request->validate([
            'assets' => 'required|array|min:1',
            'assets.*.url' => 'required|url',
            'assets.*.name' => 'required|string|max:255',
            'assets.*.object_path' => 'nullable|string|max:500',
            'assets.*.asset_type' => 'required|in:image,video',
            'assets.*.mime_type' => 'nullable|string|max:100',
            'assets.*.file_size' => 'nullable|integer',
            'tags' => 'nullable|array',
            'tags.*' => 'string|in:hero,facilities,features,area,exterior,interior,floor-plan,site-plan,footer,gallery',
        ]);

        try {
            DB::beginTransaction();

            $createdAssets = [];
            $tags = $request->input('tags', []);
            $maxOrder = DeveloperProjectAsset::where('developer_project_id', $projectId)->max('order') ?? 0;

            foreach ($request->input('assets') as $index => $assetData) {
                $asset = DeveloperProjectAsset::create([
                    'developer_project_id' => $project->id,
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

            return Reply::successWithData('Project assets uploaded successfully', [
                'assets' => $createdAssets,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Delete a single project asset.
     */
    public function destroy($projectId, $assetId)
    {
        $project = DeveloperProject::where('company_id', user()->company_id)
            ->findOrFail($projectId);

        $asset = DeveloperProjectAsset::where('developer_project_id', $projectId)
            ->findOrFail($assetId);

        $asset->delete();

        return Reply::success('Project asset deleted successfully');
    }
}
