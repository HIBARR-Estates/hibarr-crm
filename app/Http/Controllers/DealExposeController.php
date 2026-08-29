<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Deal;
use App\Models\DealExpose;
use App\Models\ExposeSnapshot;
use App\Models\Lead;
use App\Services\FileStorageService;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

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

    public function __construct(FileStorageService $fileStorageService)
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.deals';
        $this->fileStorageService = $fileStorageService;
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

    /**
     * Project exposes that can be linked to this deal — the ones already
     * generated for the deal's lead, newest first.
     */
    public function available(int $dealId)
    {
        $this->abortUnlessEnabled();

        $deal = $this->findDeal($dealId);
        $this->abortUnlessViewable();

        if ($deal->lead_id === null) {
            return Reply::successWithData('Available exposes', ['snapshots' => []]);
        }

        $snapshots = ExposeSnapshot::where('company_id', user()->company_id)
            ->where('lead_id', $deal->lead_id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();

        return Reply::successWithData('Available exposes', [
            'snapshots' => $snapshots->map(fn (ExposeSnapshot $s) => [
                'id' => $s->id,
                'entity_type' => $s->entity_type,
                'title' => $this->snapshotTitle($s),
                'created_at' => $s->created_at?->toISOString(),
            ])->values(),
        ]);
    }

    /**
     * Exposé payloads are schema-versioned and vary by entity type, so read
     * the title defensively and fall back to something identifiable rather
     * than rendering a blank row.
     */
    private function snapshotTitle(ExposeSnapshot $snapshot): string
    {
        $payload = $snapshot->expose_payload;

        if (is_array($payload)) {
            foreach (['title', 'name', 'project_name', 'property_title'] as $key) {
                if (isset($payload[$key]) && is_string($payload[$key]) && $payload[$key] !== '') {
                    return $payload[$key];
                }
            }
        }

        return 'Exposé #'.$snapshot->id;
    }

    public function store(Request $request, int $dealId)
    {
        $this->abortUnlessEnabled();

        $deal = $this->findDeal($dealId);
        $this->abortUnlessEditable();

        $validated = $request->validate([
            'source' => 'required|in:'.implode(',', DealExpose::SOURCES),
            'title' => 'required|string|max:255',
            'source_label' => 'nullable|string|max:255',
            'amount' => 'nullable|numeric|min:0',
            'expose_snapshot_id' => 'nullable|integer',
            'file' => 'nullable|file|max:'.self::MAX_UPLOAD_KB,
            // Manual uploads go through the external storage API first; the
            // frontend then posts these references instead of a multipart body.
            'download_url' => 'nullable|url',
            'object_path' => 'nullable|string|max:512',
            'uploaded_filename' => 'nullable|string|max:255',
            'uploaded_size' => 'nullable|integer|min:0',
        ]);

        if ($validated['source'] === DealExpose::SOURCE_LINKED) {
            // A linked expose must point at a snapshot this company owns for
            // this deal's lead — otherwise it is a manual row wearing the wrong label.
            $snapshotId = $validated['expose_snapshot_id'] ?? null;

            if ($snapshotId === null) {
                return Reply::error('An expose must be selected to link.');
            }

            if ($deal->lead_id === null) {
                return Reply::error('This deal has no lead to link a project expose from.');
            }

            $exists = ExposeSnapshot::where('company_id', user()->company_id)
                ->where('lead_id', $deal->lead_id)
                ->where('id', $snapshotId)
                ->exists();

            if (! $exists) {
                return Reply::error('That expose could not be found.');
            }
        }

        $uploaded = $request->file('file');
        $hasMultipart = $uploaded instanceof UploadedFile;
        $hasExternal = ! empty($validated['download_url']) && ! empty($validated['object_path']);

        if ($validated['source'] === DealExpose::SOURCE_MANUAL && ! $hasMultipart && ! $hasExternal) {
            return Reply::error('A document is required.');
        }

        $expose = new DealExpose;
        $expose->company_id = user()->company_id;
        $expose->deal_id = $deal->id;
        $expose->lead_id = $deal->lead_id;
        $expose->source = $validated['source'];
        $expose->expose_snapshot_id = $validated['source'] === DealExpose::SOURCE_LINKED
            ? $validated['expose_snapshot_id']
            : null;
        $expose->title = $validated['title'];
        $expose->source_label = $validated['source_label'] ?? null;
        $expose->amount = $validated['amount'] ?? null;
        $expose->status = DealExpose::STATUS_NOT_SENT;
        $expose->added_by = user()->id;

        if ($hasExternal) {
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
        return Deal::where('company_id', user()->company_id)->findOrFail($dealId);
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
            'lead_id' => $expose->lead_id,
            'source' => $expose->source,
            'expose_snapshot_id' => $expose->expose_snapshot_id,
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
