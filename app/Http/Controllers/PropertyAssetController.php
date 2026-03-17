<?php

namespace App\Http\Controllers;

use App\Models\Property;
use App\Models\PropertyAsset;
use App\Services\PropertyAssetManagementService;
use App\Helper\Reply;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;

class PropertyAssetController extends AccountBaseController
{
    public function __construct(
        private PropertyAssetManagementService $assetService
    ) {
        parent::__construct();
        $this->pageTitle = 'Property Assets';
    }

    /**
     * Display asset management page for a property
     */
    public function index(Request $request, $propertyId)
    {
        $property = Property::with(['product'])->findOrFail($propertyId);
        
        abort_if(!$this->canViewProperty($property), 403);

        $query = PropertyAsset::where('property_id', $propertyId)
            ->with(['property']);

        // Apply filters
        if ($request->has('asset_type') && $request->asset_type !== '') {
            $query->where('asset_type', $request->asset_type);
        }

        if ($request->has('tags') && !empty($request->tags)) {
            $tags = is_array($request->tags) ? $request->tags : [$request->tags];
            $query->byTags($tags);
        }

        if ($request->has('search') && $request->search !== '') {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        
        if ($sortBy === 'created_at') {
            $query->orderBy('created_at', $sortOrder);
        } elseif ($sortBy === 'name') {
            $query->orderBy('name', $sortOrder);
        } elseif ($sortBy === 'size') {
            $query->orderBy('file_size', $sortOrder);
        } else {
            $query->newest();
        }

        $assets = $query->paginate($request->get('per_page', 24));

        return Inertia::render('Properties/ManageAssets', [
            'pageTitle' => "Manage Assets - {$property->title}",
            'property' => $property,
            'assets' => $assets,
            'availableTags' => PropertyAsset::getAvailableTags(),
            'availableTypes' => PropertyAsset::getAvailableTypes(),
            'filters' => [
                'asset_type' => $request->asset_type,
                'tags' => $request->tags,
                'search' => $request->search,
                'sort_by' => $sortBy,
                'sort_order' => $sortOrder,
            ],
        ]);
    }

    /**
     * Return property assets as JSON (used by PhotosSection inside modals).
     */
    public function apiIndex(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);

        abort_if(!$this->canViewProperty($property), 403);

        $query = PropertyAsset::where('property_id', $propertyId);

        if ($request->filled('asset_type')) {
            $query->where('asset_type', $request->asset_type);
        }

        if ($request->filled('tags')) {
            $tags = is_array($request->tags) ? $request->tags : [$request->tags];
            $query->byTags($tags);
        }

        $assets = $query->ordered()->get();

        return Reply::successWithData('Property assets fetched', [
            'assets' => $assets,
        ]);
    }

    /**
     * Upload new assets
     */
    public function store(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'files' => 'required|array',
            'files.*' => 'file|max:51200', // 50MB max
            'asset_type' => 'required|in:image,video',
            'tags' => 'nullable|array',
            'tags.*' => 'string|in:hero,facilities,features,area,exterior,interior,floor-plan,footer,gallery',
        ]);

        try {
            DB::beginTransaction();

            $uploadedAssets = $this->assetService->uploadAssets(
                $property,
                $request->file('files'),
                $request->input('asset_type', 'image'),
                $request->input('tags', [])
            );

            DB::commit();

            return Reply::successWithData(__('messages.assetUploadSuccess'), [
                'assets' => $uploadedAssets,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Add external URL (video, 360 tour)
     */
    public function storeExternalUrl(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'url' => 'required|url',
            'asset_type' => 'required|in:video_url,tour_360_url',
            'name' => 'required|string|max:255',
            'tags' => 'nullable|array',
        ]);

        try {
            $asset = $this->assetService->createExternalUrlAsset(
                $property,
                $request->input('url'),
                $request->input('asset_type'),
                $request->input('name'),
                $request->input('tags', [])
            );

            return Reply::successWithData(__('messages.assetCreatedSuccess'), [
                'asset' => $asset->load('property'),
            ]);

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Store assets from pre-uploaded URLs (from external file upload service)
     * This receives URLs of files already uploaded to an external service
     */
    public function storeFromUrls(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'assets' => 'required|array|min:1',
            'assets.*.url' => 'required|url',
            'assets.*.name' => 'required|string|max:255',
            'assets.*.object_path' => 'nullable|string|max:500',
            'assets.*.asset_type' => 'required|in:image,video',
            'assets.*.mime_type' => 'nullable|string|max:100',
            'assets.*.file_size' => 'nullable|integer',
            'tags' => 'nullable|array',
            'tags.*' => 'string|in:hero,facilities,features,area,exterior,interior,floor-plan,footer,gallery',
        ]);

        try {
            DB::beginTransaction();

            $createdAssets = [];
            $tags = $request->input('tags', []);
            $maxOrder = PropertyAsset::where('property_id', $propertyId)->max('order') ?? 0;

            foreach ($request->input('assets') as $index => $assetData) {
                $asset = PropertyAsset::create([
                    'property_id' => $property->id,
                    'company_id' => $property->company_id,
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

            return Reply::successWithData(__('messages.assetUploadSuccess'), [
                'assets' => $createdAssets,
            ]);

        } catch (\Exception $e) {
            DB::rollBack();
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Update asset details (name, tags)
     */
    public function update(Request $request, $propertyId, $assetId)
    {
        $property = Property::findOrFail($propertyId);
        $asset = PropertyAsset::where('property_id', $propertyId)->findOrFail($assetId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'name' => 'sometimes|string|max:255',
            'tags' => 'sometimes|array',
            'tags.*' => 'string',
            'order' => 'sometimes|integer',
        ]);

        try {
            $asset->update($request->only(['name', 'tags', 'order']));

            return Reply::successWithData(__('messages.assetUpdateSuccess'), [
                'asset' => $asset->fresh(),
            ]);

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Bulk update tags
     */
    public function bulkUpdateTags(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'asset_ids' => 'required|array',
            'asset_ids.*' => 'integer|exists:property_assets,id',
            'tags' => 'required|array',
            'action' => 'required|in:add,replace,remove',
        ]);

        try {
            $updated = $this->assetService->bulkUpdateTags(
                $property,
                $request->input('asset_ids'),
                $request->input('tags'),
                $request->input('action')
            );

            return Reply::success(__('messages.bulkTagsUpdateSuccess', ['count' => $updated]));

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Delete single asset
     */
    public function destroy($propertyId, $assetId)
    {
        $property = Property::findOrFail($propertyId);
        $asset = PropertyAsset::where('property_id', $propertyId)->findOrFail($assetId);
        
        abort_if(!$this->canEditProperty($property), 403);

        try {
            $this->assetService->deleteAsset($asset);

            return Reply::success(__('messages.assetDeleteSuccess'));

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Bulk delete assets
     */
    public function bulkDestroy(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'asset_ids' => 'required|array',
            'asset_ids.*' => 'integer|exists:property_assets,id',
        ]);

        try {
            $deleted = $this->assetService->bulkDeleteAssets(
                $property,
                $request->input('asset_ids')
            );

            return Reply::success(__('messages.bulkAssetsDeleteSuccess', ['count' => $deleted]));

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Get single asset details
     */
    public function show($propertyId, $assetId)
    {
        $property = Property::findOrFail($propertyId);
        $asset = PropertyAsset::where('property_id', $propertyId)
            ->with(['property'])
            ->findOrFail($assetId);
        
        abort_if(!$this->canViewProperty($property), 403);

        return Reply::dataOnly($asset);
    }

    /**
     * Bulk action handler (similar to PropertyController::bulkAction)
     */
    public function bulkAction(Request $request, $propertyId)
    {
        $property = Property::findOrFail($propertyId);
        
        abort_if(!$this->canEditProperty($property), 403);

        $request->validate([
            'asset_ids' => 'required|array',
            'asset_ids.*' => 'integer|exists:property_assets,id',
            'action_type' => 'required|string|in:delete,apply_tags',
        ]);

        $actionType = $request->input('action_type');
        $assetIds = $request->input('asset_ids');

        try {
            switch ($actionType) {
                case 'delete':
                    $deleted = $this->assetService->bulkDeleteAssets($property, $assetIds);
                    return Reply::success(__('messages.bulkAssetsDeleteSuccess', ['count' => $deleted]));

                case 'apply_tags':
                    $request->validate([
                        'tags' => 'required|array',
                        'action' => 'required|string|in:add,replace,remove',
                    ]);
                    
                    $updated = $this->assetService->bulkUpdateTags(
                        $property,
                        $assetIds,
                        $request->input('tags'),
                        $request->input('action')
                    );
                    return Reply::success(__('messages.bulkTagsUpdateSuccess', ['count' => $updated]));

                default:
                    return Reply::error('Invalid action type');
            }
        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    /**
     * Get available tags and asset types for property assets
     * This is a static endpoint that doesn't require a property ID
     */
    public function getAssetOptions()
    {
        return Reply::dataOnly([
            'tags' => collect(PropertyAsset::getAvailableTags())->map(fn($label, $value) => [
                'value' => $value,
                'label' => $label,
            ])->values()->all(),
            'types' => collect(PropertyAsset::getAvailableTypes())->map(fn($label, $value) => [
                'value' => $value,
                'label' => $label,
            ])->values()->all(),
        ]);
    }

    /**
     * Permission helpers
     */
    private function canViewProperty(Property $property): bool
    {
        // Add your permission logic here
        return true;
    }

    private function canEditProperty(Property $property): bool
    {
        // Add your permission logic here
        return true;
    }
}
