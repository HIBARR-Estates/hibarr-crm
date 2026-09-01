<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Deal;
use App\Models\DealExpose;
use App\Models\DealFile;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\ExposeSnapshot;
use App\Models\Lead;
use App\Models\Property;
use App\Services\FileStorageService;
use App\Services\PdfExpose\ExposeSnapshotService;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

/**
 * Exposes attached to a deal - documents shown to a buyer, each carrying an
 * amount and a Not sent -> Shown -> Accepted / Not accepted lifecycle.
 *
 * Distinct from the promotional Offer / DealOfferApplication entities, which
 * are price discounts applied to a deal rather than documents sent out.
 *
 * The whole surface sits behind crm.deal-exposes-tab; with the flag off every
 * endpoint 404s, so the routes are invisible rather than merely unlinked.
 */
class DealExposeController extends AccountBaseController
{
    public const FEATURE_FLAG = 'crm.deal-exposes-tab';

    /** Laravel `max` rule for uploads — kilobytes (1 GB). */
    private const MAX_UPLOAD_KB = 1048576;

    protected FileStorageService $fileStorageService;

    protected ExposeSnapshotService $exposeSnapshots;

    public function __construct(FileStorageService $fileStorageService, ExposeSnapshotService $exposeSnapshots)
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.deals';
        $this->fileStorageService = $fileStorageService;
        $this->exposeSnapshots = $exposeSnapshots;
    }

    /** Exposes on one deal, newest first. */
    public function index(int $dealId)
    {
        $this->abortUnlessEnabled();

        $deal = $this->findDeal($dealId);
        $this->abortUnlessViewable();

        $exposes = DealExpose::with('exposeSnapshot')
            ->where('company_id', user()->company_id)
            ->where('deal_id', $deal->id)
            ->when($this->proposalViewPermission() === 'added', fn ($query) => $query->where('added_by', user()->id))
            ->orderByDesc('created_at')
            ->get();

        return Reply::successWithData('Deal exposes', [
            'exposes' => $exposes->map(fn (DealExpose $e) => $this->transform($e))->values(),
            'summary' => $this->summarise($exposes),
        ]);
    }

    /**
     * Every expose across a lead's deals. The design groups these by deal, so
     * the deal reference travels with each row rather than as a nested tree -
     * grouping is the client's job and keeps this response flat.
     */
    public function leadIndex(int $leadId)
    {
        $this->abortUnlessEnabled();

        $lead = Lead::where('company_id', user()->company_id)->findOrFail($leadId);
        $this->abortUnlessViewable();

        $exposes = DealExpose::with(['exposeSnapshot', 'deal'])
            ->where('company_id', user()->company_id)
            ->where('lead_id', $lead->id)
            ->when($this->proposalViewPermission() === 'added', fn ($query) => $query->where('added_by', user()->id))
            ->orderByDesc('created_at')
            ->get();

        return Reply::successWithData('Lead exposes', [
            'exposes' => $exposes->map(fn (DealExpose $e) => $this->transform($e))->values(),
            'summary' => $this->summarise($exposes),
        ]);
    }

    /** Page size for the linking picker — matches config('api.defaultLimit') elsewhere. */
    private const AVAILABLE_PER_PAGE = 24;

    private const AVAILABLE_MAX_PER_PAGE = 60;

    /**
     * One page of properties, developer projects, or unit types (within one
     * project) that can be linked to this deal. Scoped + paginated + search
     * server-side rather than shipping the whole catalog in one response —
     * this is an internal picker for agents managing their own inventory,
     * not a public-facing listing, so nothing is publish/hidden-filtered,
     * but it is still too large to load in full up front.
     */
    public function available(Request $request, int $dealId)
    {
        $this->abortUnlessEnabled();

        $this->findDeal($dealId);
        $this->abortUnlessViewable();

        $validated = $request->validate([
            'scope' => 'nullable|in:'.implode(',', ExposeSnapshot::ENTITY_TYPES),
            'project_id' => 'nullable|integer',
            'search' => 'nullable|string|max:255',
            'page' => 'nullable|integer|min:1',
            'per_page' => 'nullable|integer|min:1|max:'.self::AVAILABLE_MAX_PER_PAGE,
        ]);

        $scope = $validated['scope'] ?? ExposeSnapshot::ENTITY_PROPERTY;
        $search = trim((string) ($validated['search'] ?? ''));
        $perPage = (int) ($validated['per_page'] ?? self::AVAILABLE_PER_PAGE);
        $projectId = isset($validated['project_id']) ? (int) $validated['project_id'] : null;

        if ($scope === ExposeSnapshot::ENTITY_UNIT_TYPE && $projectId === null) {
            return Reply::error('A project must be selected first.');
        }

        $paginator = $this->availableEntitiesPage(user()->company_id, $scope, $search, $projectId, $perPage);

        return Reply::successWithData('Available exposes', [
            'entities' => $paginator->items(),
            'current_page' => $paginator->currentPage(),
            'last_page' => $paginator->lastPage(),
            'per_page' => $paginator->perPage(),
            'total' => $paginator->total(),
        ]);
    }

    /**
     * @return \Illuminate\Contracts\Pagination\LengthAwarePaginator<int, array<string, mixed>>
     */
    private function availableEntitiesPage(int $companyId, string $scope, string $search, ?int $projectId, int $perPage)
    {
        if ($scope === ExposeSnapshot::ENTITY_DEVELOPER_PROJECT) {
            $paginator = DeveloperProject::query()
                ->with('thumbnail')
                ->where('company_id', $companyId)
                ->when($search !== '', fn ($query) => $query->where('name', 'like', "%{$search}%"))
                // Ties on `name` are common (see e.g. multiple "Aria Mare" rows) —
                // without a unique tiebreaker, MySQL's order for tied rows isn't
                // guaranteed stable between the page-1 and page-2 queries, which
                // duplicates/skips rows across "load more" pages.
                ->orderBy('name')
                ->orderBy('id')
                ->paginate($perPage, ['id', 'name', 'reference_code', 'starting_price']);

            $paginator->setCollection(
                $paginator->getCollection()->map(fn (DeveloperProject $project) => $this->mapProjectEntity($project))
            );

            return $paginator;
        }

        if ($scope === ExposeSnapshot::ENTITY_UNIT_TYPE) {
            $paginator = DeveloperProjectUnitType::query()
                ->with(['project:id,name', 'thumbnail'])
                ->where('company_id', $companyId)
                ->where('developer_project_id', $projectId)
                ->whereHas('project', fn ($query) => $query->where('company_id', $companyId))
                ->when($search !== '', fn ($query) => $query->where('reference_code', 'like', "%{$search}%"))
                ->orderBy('id')
                ->paginate($perPage, ['id', 'developer_project_id', 'starting_price', 'bedrooms', 'property_type', 'primary_category']);

            $paginator->setCollection(
                $paginator->getCollection()->map(fn (DeveloperProjectUnitType $unitType) => $this->mapUnitTypeEntity($unitType))
            );

            return $paginator;
        }

        $paginator = Property::query()
            ->where('company_id', $companyId)
            ->when($search !== '', fn ($query) => $query->where('title', 'like', "%{$search}%"))
            // Same tiebreaker reasoning as the developer-project scope above.
            ->orderBy('title')
            ->orderBy('id')
            ->paginate($perPage, ['id', 'title', 'slug', 'price', 'photos']);

        $paginator->setCollection(
            $paginator->getCollection()->map(fn (Property $property) => $this->mapPropertyEntity($property))
        );

        return $paginator;
    }

    /** @return array<string, mixed> */
    private function mapPropertyEntity(Property $property): array
    {
        return [
            'entity_type' => ExposeSnapshot::ENTITY_PROPERTY,
            'entity_id' => $property->id,
            'unit_type_id' => null,
            'entity_label' => $this->entityLabel(ExposeSnapshot::ENTITY_PROPERTY),
            'title' => $property->title ?: $property->slug ?: ('Property #'.$property->id),
            'suggested_amount' => $property->price,
            'cover_image' => $this->firstPhotoUrl($property->photos),
        ];
    }

    /** @return array<string, mixed> */
    private function mapProjectEntity(DeveloperProject $project): array
    {
        return [
            'entity_type' => ExposeSnapshot::ENTITY_DEVELOPER_PROJECT,
            'entity_id' => $project->id,
            'unit_type_id' => null,
            'entity_label' => $this->entityLabel(ExposeSnapshot::ENTITY_DEVELOPER_PROJECT),
            'title' => $project->name ?: $project->reference_code,
            'suggested_amount' => $project->starting_price !== null ? (float) $project->starting_price : null,
            'cover_image' => $project->thumbnail?->url,
        ];
    }

    /** @return array<string, mixed> */
    private function mapUnitTypeEntity(DeveloperProjectUnitType $unitType): array
    {
        return [
            'entity_type' => ExposeSnapshot::ENTITY_UNIT_TYPE,
            'entity_id' => $unitType->developer_project_id,
            'unit_type_id' => $unitType->id,
            'entity_label' => $this->entityLabel(ExposeSnapshot::ENTITY_UNIT_TYPE),
            'title' => $unitType->project?->name
                ? "{$unitType->display_label} ({$unitType->project->name})"
                : $unitType->display_label,
            'suggested_amount' => $unitType->starting_price !== null ? (float) $unitType->starting_price : null,
            'cover_image' => $unitType->thumbnail?->url,
        ];
    }

    /**
     * Property#photos is a plain JSON array, normally of URL strings, but a
     * few legacy rows store richer `{url:...}`-shaped entries — check the
     * common keys defensively rather than assuming a shape.
     *
     * @param  mixed  $photos
     */
    private function firstPhotoUrl($photos): ?string
    {
        if (! is_array($photos) || $photos === []) {
            return null;
        }

        $first = $photos[0];

        if (is_string($first) && $first !== '') {
            return $first;
        }

        if (is_array($first)) {
            foreach (['url', 'file_url', 'original_url', 'path', 'file_path'] as $key) {
                if (isset($first[$key]) && is_string($first[$key]) && $first[$key] !== '') {
                    return $first[$key];
                }
            }
        }

        return null;
    }

    /**
     * Looks up one entity for the linking picker's submit — re-checks it
     * still exists and belongs to this company (defense against a
     * stale/tampered payload), and shapes it the same way available() does
     * so store() can pull title/amount straight off it.
     *
     * @return array<string, mixed>|null
     */
    private function findLinkableEntity(string $entityType, int $entityId, ?int $unitTypeId): ?array
    {
        $companyId = user()->company_id;

        if ($entityType === ExposeSnapshot::ENTITY_PROPERTY) {
            $property = Property::query()
                ->where('company_id', $companyId)
                ->find($entityId);

            return $property ? $this->mapPropertyEntity($property) : null;
        }

        if ($entityType === ExposeSnapshot::ENTITY_DEVELOPER_PROJECT) {
            $project = DeveloperProject::query()
                ->where('company_id', $companyId)
                ->find($entityId);

            return $project ? $this->mapProjectEntity($project) : null;
        }

        if ($entityType === ExposeSnapshot::ENTITY_UNIT_TYPE) {
            if ($unitTypeId === null) {
                return null;
            }

            $unitType = DeveloperProjectUnitType::query()
                ->with('project:id,name')
                ->where('company_id', $companyId)
                ->where('developer_project_id', $entityId)
                ->whereHas('project', fn ($query) => $query->where('company_id', $companyId))
                ->find($unitTypeId);

            return $unitType ? $this->mapUnitTypeEntity($unitType) : null;
        }

        return null;
    }

    public function store(Request $request, int $dealId)
    {
        $this->abortUnlessEnabled();

        $deal = $this->findDeal($dealId);
        $this->abortUnlessEditable();

        $validated = $request->validate([
            'source' => 'required|in:'.implode(',', DealExpose::SOURCES),
            // Required for manual uploads (derived from the filename client-side).
            // Linked entries have no title field in the UI — it comes from the
            // picked entity below instead.
            'title' => 'nullable|string|max:255',
            'source_label' => 'nullable|string|max:255',
            'amount' => 'nullable|numeric|min:0',
            'entity_type' => 'nullable|in:'.implode(',', ExposeSnapshot::ENTITY_TYPES),
            'entity_id' => 'nullable|integer',
            'unit_type_id' => 'nullable|integer',
            'deal_file_id' => 'nullable|integer',
            'file' => 'nullable|file|max:'.self::MAX_UPLOAD_KB,
            // Optional when the browser already uploaded via storage API (no CORS).
            // Manual uploads from the CRM UI POST multipart here; Laravel proxies to storage.
            'download_url' => 'nullable|url:http,https',
            'object_path' => 'nullable|string|max:512',
            'uploaded_filename' => 'nullable|string|max:255',
            'uploaded_size' => 'nullable|integer|min:0',
        ]);

        $shareUrl = null;

        if ($validated['source'] === DealExpose::SOURCE_LINKED) {
            $entityType = $validated['entity_type'] ?? null;
            $entityId = $validated['entity_id'] ?? null;

            if ($entityType === null || $entityId === null) {
                return Reply::error('A property, project, or unit type must be selected to link.');
            }

            if ($deal->lead_id === null) {
                return Reply::error('This deal has no lead, so an expose cannot be generated.');
            }

            $unitTypeId = $entityType === ExposeSnapshot::ENTITY_UNIT_TYPE
                ? ($validated['unit_type_id'] ?? null)
                : null;

            if ($entityType === ExposeSnapshot::ENTITY_UNIT_TYPE && $unitTypeId === null) {
                return Reply::error('A unit type must be selected to link.');
            }

            $linkedEntity = $this->findLinkableEntity($entityType, (int) $entityId, $unitTypeId !== null ? (int) $unitTypeId : null);

            if ($linkedEntity === null) {
                return Reply::error('That property, project, or unit type could not be found.');
            }

            try {
                $mint = $this->exposeSnapshots->mint(user()->company_id, [
                    'entity_type' => $entityType,
                    'entity_id' => (int) $entityId,
                    'unit_type_id' => $unitTypeId,
                    'agent_id' => user()->id,
                    'lead_id' => $deal->lead_id,
                ]);
            } catch (ValidationException $e) {
                return Reply::error(collect($e->errors())->flatten()->first() ?? 'That expose could not be generated.');
            }

            $linkedEntity['expose_snapshot_id'] = $mint['snapshot']->id;
            $shareUrl = rtrim((string) config('expose.share_base_url'), '/').'/'.$mint['token'];
        } else {
            $linkedEntity = null;
        }

        $title = $validated['title'] ?? ($linkedEntity['title'] ?? null);
        if (empty($title)) {
            return Reply::error('A title is required.');
        }

        $uploaded = $request->file('file');
        $hasMultipart = $uploaded instanceof UploadedFile;
        $hasExternal = ! empty($validated['download_url']) && ! empty($validated['object_path']);
        $dealFile = null;

        if (! empty($validated['deal_file_id'])) {
            $dealFile = DealFile::where('deal_id', $deal->id)
                ->find((int) $validated['deal_file_id']);

            if ($dealFile === null) {
                return Reply::error('That file could not be found.');
            }
        }

        $hasDealFile = $dealFile !== null;

        if ($validated['source'] === DealExpose::SOURCE_MANUAL && ! $hasMultipart && ! $hasExternal && ! $hasDealFile) {
            return Reply::error('A document is required.');
        }

        $expose = new DealExpose;
        $expose->company_id = user()->company_id;
        $expose->deal_id = $deal->id;
        $expose->lead_id = $deal->lead_id;
        $expose->source = $validated['source'];
        $expose->expose_snapshot_id = $linkedEntity['expose_snapshot_id'] ?? null;
        $expose->entity_type = $linkedEntity['entity_type'] ?? null;
        $expose->entity_id = $linkedEntity['entity_id'] ?? null;
        $expose->unit_type_id = $linkedEntity['unit_type_id'] ?? null;
        $expose->title = $title;
        $expose->source_label = $validated['source_label'] ?? null;
        $expose->amount = $validated['amount']
            ?? ($linkedEntity['suggested_amount'] ?? null);
        $expose->status = DealExpose::STATUS_NOT_SENT;
        $expose->added_by = user()->id;

        if ($shareUrl !== null) {
            $expose->external_url = $shareUrl;
        } elseif ($hasDealFile) {
            $expose->filename = $dealFile->filename;
            $expose->size = is_numeric($dealFile->size) ? (int) $dealFile->size : null;
            $expose->external_url = $dealFile->external_url ?: $dealFile->file_url;
            $expose->object_path = $dealFile->object_path ?: $dealFile->hashname;
        } elseif ($hasExternal) {
            $expose->filename = $validated['uploaded_filename']
                ?? basename($validated['object_path']);
            $expose->size = $validated['uploaded_size'] ?? null;
            $expose->external_url = $validated['download_url'];
            $expose->object_path = $validated['object_path'];
        } elseif ($hasMultipart) {
            $expose->filename = $uploaded->getClientOriginalName();
            $expose->size = $uploaded->getSize();

            try {
                $result = $this->fileStorageService->upload($uploaded, 'deal-exposes/'.$deal->id);
                $expose->external_url = $result['downloadUrl'];
                $expose->object_path = $result['objectPath'];
            } catch (\Exception $e) {
                Log::error('Deal expose upload failed', [
                    'error' => $e->getMessage(),
                    'deal_id' => $deal->id,
                ]);

                return Reply::error('The document could not be uploaded. Please try again.');
            }
        }

        $expose->save();

        return Reply::successWithData('Expose added', [
            'expose' => $this->transform($expose),
        ]);
    }

    public function update(Request $request, int $id)
    {
        $this->abortUnlessEnabled();
        $this->abortUnlessEditable();

        $validated = $request->validate([
            'title' => 'sometimes|required|string|max:255',
            'amount' => 'nullable|numeric|min:0',
        ]);

        if (! $request->hasAny(['title', 'amount'])) {
            return Reply::error('Nothing to update.');
        }

        $expose = DealExpose::where('company_id', user()->company_id)->findOrFail($id);
        $this->abortUnlessCanMutateExpose($expose);

        if (array_key_exists('title', $validated)) {
            $expose->title = $validated['title'];
        }
        if ($request->has('amount')) {
            $expose->amount = $validated['amount'];
        }
        $expose->save();

        return Reply::successWithData('Expose updated', [
            'expose' => $this->transform($expose->fresh('exposeSnapshot')),
        ]);
    }

    public function updateStatus(Request $request, int $id)
    {
        $this->abortUnlessEnabled();
        $this->abortUnlessEditable();

        $validated = $request->validate([
            'status' => 'required|in:'.implode(',', DealExpose::STATUSES),
        ]);

        $expose = DealExpose::where('company_id', user()->company_id)->findOrFail($id);
        $this->abortUnlessCanMutateExpose($expose);
        $expose->status = $validated['status'];
        $expose->status_changed_at = now();
        $expose->save();

        return Reply::successWithData('Status updated', [
            'expose' => $this->transform($expose->fresh('exposeSnapshot')),
        ]);
    }

    public function destroy(int $id)
    {
        $this->abortUnlessEnabled();
        $this->abortUnlessEditable();

        $expose = DealExpose::where('company_id', user()->company_id)->findOrFail($id);
        $this->abortUnlessCanMutateExpose($expose);
        $expose->delete();

        return Reply::success('Expose removed');
    }

    private function findDeal(int $dealId): Deal
    {
        return Deal::where('company_id', user()->company_id)
            ->findOrFail($dealId);
    }

    private function entityLabel(string $entityType): string
    {
        return match ($entityType) {
            ExposeSnapshot::ENTITY_PROPERTY => 'Property',
            ExposeSnapshot::ENTITY_DEVELOPER_PROJECT => 'Project',
            ExposeSnapshot::ENTITY_UNIT_TYPE => 'Unit type',
            default => ucfirst(str_replace('_', ' ', $entityType)),
        };
    }

    private function abortUnlessEnabled(): void
    {
        abort_if(! FeatureFlags::enabled(self::FEATURE_FLAG), 404);
    }

    /**
     * Exposes are proposal-shaped, so they follow the proposal permission.
     *
     * Allow-list rather than a `=== 'none'` deny-list: permission() returns
     * `false` when the user has no permission row at all, which a deny-list
     * would wave through (matches DealController's own check).
     */
    private function abortUnlessViewable(): void
    {
        abort_403(! in_array($this->proposalViewPermission(), ['all', 'added'], true));
    }

    private function abortUnlessEditable(): void
    {
        abort_403(! in_array(user()->permission('add_lead_proposals'), ['all', 'added']));
    }

    /** @return string|false */
    private function proposalViewPermission()
    {
        return user()->permission('view_lead_proposals');
    }

    private function abortUnlessCanMutateExpose(DealExpose $expose): void
    {
        $permission = user()->permission('add_lead_proposals');

        abort_403(! (
            $permission === 'all'
            || ($permission === 'added' && (int) $expose->added_by === (int) user()->id)
        ));

        // A locked deal is frozen — matches Deal::isLocked() gating elsewhere
        // (e.g. the Offers tab's "Remove all" button). Only reachable here on
        // update/status/destroy; store() creating a brand-new expose against
        // an already-locked deal is a separate, pre-existing gap left alone.
        abort_403((bool) $expose->deal?->isLocked());
    }

    /**
     * @param  \Illuminate\Support\Collection<int, DealExpose>  $exposes
     * @return array<string, int>
     */
    private function summarise($exposes): array
    {
        return [
            'total' => $exposes->count(),
            'not_sent' => $exposes->where('status', DealExpose::STATUS_NOT_SENT)->count(),
            'shown' => $exposes->where('status', DealExpose::STATUS_SHOWN)->count(),
            'accepted' => $exposes->where('status', DealExpose::STATUS_ACCEPTED)->count(),
            'not_accepted' => $exposes->where('status', DealExpose::STATUS_NOT_ACCEPTED)->count(),
        ];
    }

    /** @return array<string, mixed> */
    private function transform(DealExpose $expose): array
    {
        return [
            'id' => $expose->id,
            'deal_id' => $expose->deal_id,
            'deal_name' => $expose->relationLoaded('deal') ? $expose->deal?->name : null,
            'deal_is_locked' => $expose->relationLoaded('deal') ? (bool) $expose->deal?->isLocked() : false,
            'lead_id' => $expose->lead_id,
            'source' => $expose->source,
            'expose_snapshot_id' => $expose->expose_snapshot_id,
            'entity_type' => $expose->entity_type,
            'entity_id' => $expose->entity_id,
            'unit_type_id' => $expose->unit_type_id,
            'title' => $expose->title,
            'source_label' => $expose->source_label,
            'amount' => $expose->amount !== null ? (float) $expose->amount : null,
            'status' => $expose->status,
            'status_changed_at' => $expose->status_changed_at?->toISOString(),
            'filename' => $expose->filename,
            'download_url' => $expose->external_url,
            'size' => $expose->size,
            'created_at' => $expose->created_at?->toISOString(),
        ];
    }
}
