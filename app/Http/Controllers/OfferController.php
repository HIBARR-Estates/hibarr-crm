<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\Offer\StoreOfferRequest;
use App\Http\Requests\Offer\UpdateOfferRequest;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Offer;
use App\Services\DealOfferService;
use Illuminate\Http\Request;

class OfferController extends AccountBaseController
{
    public function __construct(
        private DealOfferService $dealOfferService,
    ) {
        parent::__construct();
    }

    /**
     * List all offers for the current company.
     */
    public function index(Request $request)
    {
        $query = Offer::where('company_id', user()->company_id)
            ->withCount(['dealApplications']);

        if ($request->boolean('active_only')) {
            $query->active();
        }

        if ($request->filled('search')) {
            $query->where('name', 'like', '%' . $request->search . '%');
        }

        $offers = $query->orderBy('created_at', 'desc')->paginate($request->input('per_page', 15));

        return Reply::successWithData('Offers fetched successfully', [
            'offers' => $offers,
        ]);
    }

    /**
     * Create a new offer.
     */
    public function store(StoreOfferRequest $request)
    {
        $offer = Offer::create([
            'company_id' => user()->company_id,
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

        return Reply::successWithData('Offer created successfully', [
            'offer' => $offer,
        ]);
    }

    /**
     * Show a single offer with its attached models.
     */
    public function show(int $id)
    {
        $offer = Offer::where('company_id', user()->company_id)
            ->with(['developerProjects', 'unitTypes'])
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
            'offer' => $offer->fresh(),
        ]);
    }

    /**
     * Soft-delete an offer.
     */
    public function destroy(int $id)
    {
        $offer = Offer::where('company_id', user()->company_id)->findOrFail($id);
        $offer->delete();

        return Reply::success('Offer deleted successfully');
    }

    // ── Attach / Detach ──────────────────────────────────────────

    /**
     * Attach an offer to a DeveloperProject or DeveloperProjectUnitType.
     * Enforces the "one active offer per model" constraint.
     */
    public function attach(Request $request, int $offerId)
    {
        $request->validate([
            'offerable_type' => 'required|in:developer_project,unit_type',
            'offerable_id' => 'required|integer',
        ]);

        $offer = Offer::where('company_id', user()->company_id)->findOrFail($offerId);

        $model = $this->resolveOfferableModel($request->offerable_type, $request->offerable_id);

        // Enforce one active offer per model
        if ($offer->is_active && $model->hasActiveOffer()) {
            $existingOffer = $model->activeOffer();
            if ($existingOffer && $existingOffer->id !== $offer->id) {
                return Reply::error(
                    "This {$request->offerable_type} already has an active offer: \"{$existingOffer->name}\". Remove it first or deactivate it."
                );
            }
        }

        $model->offers()->syncWithoutDetaching([$offer->id]);

        return Reply::successWithData('Offer attached successfully', [
            'offer' => $offer,
            'offerable_type' => $request->offerable_type,
            'offerable_id' => $request->offerable_id,
        ]);
    }

    /**
     * Detach an offer from a DeveloperProject or DeveloperProjectUnitType.
     */
    public function detach(Request $request, int $offerId)
    {
        $request->validate([
            'offerable_type' => 'required|in:developer_project,unit_type',
            'offerable_id' => 'required|integer',
        ]);

        $offer = Offer::where('company_id', user()->company_id)->findOrFail($offerId);

        $model = $this->resolveOfferableModel($request->offerable_type, $request->offerable_id);
        $model->offers()->detach($offer->id);

        return Reply::successWithData('Offer detached successfully', [
            'offer' => $offer,
            'offerable_type' => $request->offerable_type,
            'offerable_id' => $request->offerable_id,
        ]);
    }

    // ── Deal Offer Endpoints ─────────────────────────────────────

    /**
     * Apply (or re-apply) offers to a deal based on its products/properties.
     */
    public function applyToDeal(int $dealId)
    {
        $deal = \App\Models\Deal::findOrFail($dealId);

        $applications = $this->dealOfferService->applyOffersToDeal($deal);

        return Reply::successWithData('Offers applied to deal', [
            'applications' => $applications,
            'total_discount' => $applications->sum('discount_amount'),
        ]);
    }

    /**
     * Preview what offers would apply to a deal without persisting.
     */
    public function previewForDeal(int $dealId)
    {
        $deal = \App\Models\Deal::findOrFail($dealId);

        $previews = $this->dealOfferService->previewOffers($deal);

        return Reply::successWithData('Offer preview for deal', [
            'previews' => $previews,
            'total_discount' => $previews->sum('discount_amount'),
        ]);
    }

    /**
     * Get applied offers for a deal.
     */
    public function dealOffers(int $dealId)
    {
        $deal = \App\Models\Deal::findOrFail($dealId);

        $applications = $deal->offerApplications()
            ->with(['offer', 'product', 'resolvedFrom'])
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
}
