<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\MassPrunable;

/**
 * One row per email handed to the uns-routing mailer: which system actually
 * delivered it (UNS/Plunk or the PHP SMTP mailer) and what that system said.
 *
 * Written by App\Services\Notifications\UnsRoutingTransport for every send,
 * including ones that happen inside a queue worker — that's why the origin
 * (automation/deal/lead) travels with the message as a header rather than
 * being resolved here.
 */
class EmailDeliveryLog extends BaseModel
{
    use HasCompany, HasFactory, MassPrunable;

    protected $table = 'email_delivery_logs';

    /** Delivered by the notification service (UNS), i.e. a Plunk template send. */
    public const SYSTEM_UNS = 'uns';

    /** Delivered by the PHP mailer (SMTP) — by design, or as the UNS fallback. */
    public const SYSTEM_SMTP = 'smtp';

    public const STATUS_SENT = 'sent';

    public const STATUS_FAILED = 'failed';

    /**
     * The send raised no error, but no transport outcome was recorded for it —
     * so whether it actually left the building is unknown. Happens when the
     * send never reaches UnsRoutingTransport (the array/log mail driver, for
     * instance). Never written to this table; only used by callers that read
     * back a delivery outcome, so they don't report an unverified send as sent.
     */
    public const STATUS_UNCONFIRMED = 'unconfirmed';

    protected $fillable = [
        'company_id',
        'recipient',
        'subject',
        'plunk_template_id',
        'system',
        'uns_attempted',
        'status',
        'response_status',
        'response_body',
        'error',
        'fallback_reason',
        'context',
        'correlation_id',
        'sent_at',
    ];

    protected $casts = [
        'uns_attempted' => 'boolean',
        'context' => 'array',
        'sent_at' => 'datetime',
    ];

    /**
     * Every outgoing email writes a row here, so the table would grow without
     * bound. Kept for a quarter — long enough to investigate a reported
     * delivery problem, short enough to stay small. Pruned by `model:prune`.
     *
     * The retention window is floored at one day: an empty, zero or negative
     * config value would otherwise make `subDays()` land on now (or the
     * future) and prune the entire table on the next scheduled run.
     */
    public function prunable(): Builder
    {
        $days = max(1, (int) config('mail.delivery_log_retention_days', 90));

        return static::withoutGlobalScopes()->where('created_at', '<', now()->subDays($days));
    }
}
