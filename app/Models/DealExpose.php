<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * An exposé attached to a deal: either linked from a project exposé
 * (expose_snapshots) or a document the agent uploaded themselves.
 *
 * Distinct from the promotional `Offer` / `DealOfferApplication` entities,
 * which are price discounts applied to a deal rather than documents sent to
 * a buyer.
 */
class DealExpose extends BaseModel
{
    use HasCompany;

    public const SOURCE_LINKED = 'linked';

    public const SOURCE_MANUAL = 'manual';

    public const SOURCES = [
        self::SOURCE_LINKED,
        self::SOURCE_MANUAL,
    ];

    public const STATUS_NOT_SENT = 'not_sent';

    public const STATUS_SHOWN = 'shown';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_NOT_ACCEPTED = 'not_accepted';

    /** Display order for the status picker, matching the design. */
    public const STATUSES = [
        self::STATUS_NOT_SENT,
        self::STATUS_SHOWN,
        self::STATUS_ACCEPTED,
        self::STATUS_NOT_ACCEPTED,
    ];

    protected $table = 'deal_exposes';

    protected $fillable = [
        'company_id',
        'deal_id',
        'lead_id',
        'source',
        'expose_snapshot_id',
        'entity_type',
        'entity_id',
        'unit_type_id',
        'title',
        'source_label',
        'amount',
        'status',
        'status_changed_at',
        'filename',
        'external_url',
        'object_path',
        'size',
        'added_by',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'size' => 'integer',
        'status_changed_at' => 'datetime',
    ];

    public function deal(): BelongsTo
    {
        return $this->belongsTo(Deal::class, 'deal_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public function exposeSnapshot(): BelongsTo
    {
        return $this->belongsTo(ExposeSnapshot::class, 'expose_snapshot_id');
    }

    public function addedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }

    public function isLinked(): bool
    {
        return $this->source === self::SOURCE_LINKED;
    }
}
