<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Offer\StoreOfferRequest;
use App\Http\Requests\Offer\UpdateOfferRequest;
use App\Models\Developer;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Offer;
use App\Services\DealOfferService;
use Illuminate\Http\Request;
use Inertia\Inertia;

class OfferController extends AccountBaseController
{
    public function __construct(
        private DealOfferService $dealOfferService,
    ) {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(!\App\Support\PermissionGates::canManageOffers(user()));

            return $next($request);
        })->except(['dealOffers', 'removeFromDeal']);
    }

    /**
     * List all offers for the current company.
     */
    public function index(Request $request)
    {
        $query = Offer::where('company_id', user()->company_id)
            ->with(['developer:id,name'])
            ->withCount(['dealApplications', 'developerProjects', 'unitTypes']);

        if ($request->boolean('active_only')) {
            $query->active();
        }

        if ($request->filled('developer_id')) {
            $query->where('developer_id', $request->developer_id);
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $offers = $query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 15));

        // Fetch developers for the filter dropdown
        $developers = Developer::where('company_id', user()->company_id)
            ->select('id', 'name')
            ->orderBy('name')
            ->get();

        // Return Inertia page for browser requests, JSON for API requests
        if ($request->wantsJson()) {
            return Reply::successWithData('Offers fetched successfully', [
                'offers' => $offers,
            ]);
        }

        return Inertia::render('Offers/Index', [
            'pageTitle' => 'Offers',
            'offers' => [
                'data' => $offers->items(),
                'current_page' => $offers->currentPage(),
                'last_page' => $offers->lastPage(),
                'per_page' => $offers->perPage(),
                'total' => $offers->total(),
                'from' => $offers->firstItem(),
                'to' => $offers->lastItem(),
            ],
            'developers' => $developers,
            'filters' => $request->only(['search', 'active_only', 'developer_id']),
        ]);
    }

    /**
     * Create a new offer. Optionally attach to projects in the same request.
     */
    public function store(StoreOfferRequest $request)
    {
        $offer = Offer::create([
            'company_id' => user()->company_id,
            'developer_id' => $request->developer_id,
            'name' => $request->name,
            'description' => $request->description,
            'type' => $request->type,
            'value' => $request->value,
            'max_discount_amount' => $request->max_discount_amount,
            'is_active' => $request->boolean('is_active', true),
            'starts_at' => $request->starts_at,
            'ends_at' => $request->ends_at,
            'added_by' => user()->id,
            'last_updated_by' => user()->id,
        ]);

        // Attach to projects if provided
        if ($request->filled('project_ids')) {
            $offer->developerProjects()->attach($request->project_ids);
        }

        // Attach to unit types if provided
        if ($request->filled('unit_type_ids')) {
            $offer->unitTypes()->attach($request->unit_type_ids);
        }

        return Reply::successWithData('Offer created successfully', [
            'offer' => $offer->load('developer:id,name'),
        ]);
    }

    /**
     * Show a single offer with its attached models (including pivot status).
     */
    public function show(int $id)
    {
        $offer = Offer::where('company_id', user()->company_id)
            ->with([
                'developer:id,name',
                'developerProjects',
                'developerProjects.unitTypes',
                'unitTypes',
            ])
            ->withCount(['dealApplications'])
            ->findOrFail($id);

        return Reply::successWithData('Offer fetched successfully', [
            'offer' => $offer,
        ]);
    }

    /**
     * Update an existing offer.
     */
    public function update(UpdateOfferRequest $request, int $id)
    {
        $offer = Offer::where('company_id', user()->company_id)->findOrFail($id);

        $offer->update(array_merge(
            $request->validated(),
            ['last_updated_by' => user()->id],
        ));

        return Reply::successWithData('Offer updated successfully', [
            'offer' => $offer->fresh()->load('developer:id,name'),
        ]);
    }

    /**
     * Soft-delete an offer.
     */
    public function destroy(int $id)
    {
        $offer = Offer::where('company_id', user()->company_id)->findOrFail($id);

        if ($offer->dealApplications()->exists()) {
            return Reply::error('This offer has been applied to deals and cannot be deleted. Deactivate it instead.');
        }

        $offer->delete();

        return Reply::success('Offer deleted successfully');
    }

    /**
     * Toggle the global is_active flag on an offer.
     */
    public function toggle(int $id)
    {
        $offer = Offer::where('company_id', user()->company_id)->findOrFail($id);
        $offer->update(['is_active' => !$offer->is_active]);

        return Reply::successWithData('Offer toggled', [
            'is_active' => $offer->is_active,
        ]);
    }

    /**
     * Detach (hard-remove) an offer from a DeveloperProject or DeveloperProjectUnitType.
     * Use disable() to keep the row but deactivate it.
     */
    public function detach(Request $request, int $offerId)
    {
        $request->validate([
            'offerable_type' => 'required|in:developer_project,unit_type',
            'offerable_id'   => 'required|integer',
        ]);

        $offer = Offer::where('company_id', user()->company_id)->findOrFail($offerId);

        if ($request->offerable_type === 'unit_type') {
            $offer->unitTypes()->detach($request->offerable_id);
        } else {
            $offer->developerProjects()->detach($request->offerable_id);
        }

        return Reply::success('Detached successfully');
    }

    // ── Attach / Disable / Enable ────────────────────────────────

    /**
     * Attach an offer to a DeveloperProject or DeveloperProjectUnitType.
     * Supports bulk via offerable_ids array.
     * Validates that the target belongs to the offer's developer.
     */
    public function attach(Request $request, int $offerId)
    {
        $request->validate([
            'offerable_type' => 'required|in:developer_project,unit_type',
            'offerable_ids' => 'required|array|min:1',
            'offerable_ids.*' => 'integer',
        ]);

        $offer = Offer::where('company_id', user()->company_id)->findOrFail($offerId);

        $attachedIds = [];

        foreach ($request->offerable_ids as $offerableId) {
            $model = $this->resolveOfferableModel($request->offerable_type, $offerableId);

            // Validate model belongs to offer's developer
            if ($offer->developer_id) {
                $developerId = $this->getModelDeveloperId($request->offerable_type, $model);

                if ($developerId && $developerId !== $offer->developer_id) {
                    continue; // Skip models not belonging to the offer's developer
                }
            }

            $model->offers()->syncWithoutDetaching([$offer->id]);
            $attachedIds[] = $offerableId;
        }

        return Reply::successWithData('Offer attached successfully', [
            'offer' => $offer,
            'offerable_type' => $request->offerable_type,
            'attached_ids' => $attachedIds,
        ]);
    }

    /**
     * Disable an offer on a specific DeveloperProject or DeveloperProjectUnitType.
     * The attachment is NOT removed — only disabled via pivot.
     */
    public function disable(Request $request, int $offerId)
    {
        $request->validate([
            'offerable_type' => 'required|in:developer_project,unit_type',
            'offerable_id' => 'required|integer',
        ]);

        $offer = Offer::where('company_id', user()->company_id)->findOrFail($offerId);

        $model = $this->resolveOfferableModel($request->offerable_type, $request->offerable_id);
        $model->offers()->updateExistingPivot($offer->id, [
            'is_active' => false,
            'disabled_at' => now(),
            'disabled_by' => user()->id,
        ]);

        return Reply::successWithData('Offer disabled on this attachment', [
            'offer_id' => $offer->id,
            'offerable_type' => $request->offerable_type,
            'offerable_id' => $request->offerable_id,
        ]);
    }

    /**
     * Re-enable a previously disabled offer on a DeveloperProject or DeveloperProjectUnitType.
     */
    public function enable(Request $request, int $offerId)
    {
        $request->validate([
            'offerable_type' => 'required|in:developer_project,unit_type',
            'offerable_id' => 'required|integer',
        ]);

        $offer = Offer::where('company_id', user()->company_id)->findOrFail($offerId);

        $model = $this->resolveOfferableModel($request->offerable_type, $request->offerable_id);
        $model->offers()->updateExistingPivot($offer->id, [
            'is_active' => true,
            'disabled_at' => null,
            'disabled_by' => null,
        ]);

        return Reply::successWithData('Offer re-enabled on this attachment', [
            'offer_id' => $offer->id,
            'offerable_type' => $request->offerable_type,
            'offerable_id' => $request->offerable_id,
        ]);
    }

    // ── Deal Offer Endpoints ─────────────────────────────────────

    /**
     * Get applied offers for a deal.
     */
    public function dealOffers(int $dealId)
    {
        $deal = \App\Models\Deal::findOrFail($dealId);

        $applications = $deal->offerApplications()
            ->with([
                'offer:id,name,type,value,max_discount_amount',
                'product:id,name,price',
                'product.property:id,product_id,title,property_type,bedrooms,city,area,unit_style,view_types,furniture_status,primary_category,construction_status',
            ])
            ->get();

        return Reply::successWithData('Deal offers fetched', [
            'applications' => $applications,
            'total_discount' => $applications->sum('discount_amount'),
        ]);
    }

    /**
     * Remove all applied offers from a deal (manual override).
     */
    public function removeFromDeal(int $dealId)
    {
        $deal = \App\Models\Deal::findOrFail($dealId);

        if ($deal->isLocked()) {
            return Reply::error(__('messages.dealLocked'));
        }

        $this->dealOfferService->removeOffersFromDeal($deal);

        return Reply::success('All offers removed from deal');
    }

    // ── Private ──────────────────────────────────────────────────

    private function resolveOfferableModel(string $type, int $id)
    {
        $companyId = user()->company_id;

        return match ($type) {
            'developer_project' => DeveloperProject::where('company_id', $companyId)->findOrFail($id),
            'unit_type' => DeveloperProjectUnitType::where('company_id', $companyId)->findOrFail($id),
        };
    }

    private function getModelDeveloperId(string $type, $model): ?int
    {
        return match ($type) {
            'developer_project' => $model->developer_id,
            'unit_type' => $model->project?->developer_id,
            default => null,
        };
    }
}
