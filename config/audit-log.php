<?php

/*
 * Application-wide audit log (App\Support\AuditLog). Every Eloquent create,
 * update, delete and restore — plus sign-ins and sign-outs — is written to
 * `audit_logs` and shown on Settings → Audit log. Reads are never recorded.
 *
 * Recording is best-effort: a failure to write an audit row is reported and
 * swallowed, never surfaced to the write that triggered it.
 */
return [

    'enabled' => env('AUDIT_LOG_ENABLED', true),

    /*
     * Models never audited: the audit table itself, other log/history tables
     * (auditing them only duplicates what they already record), and models
     * whose writes are really reads (notifications marked read, notices
     * viewed, product tours seen, session heartbeats).
     */
    'excluded_models' => [
        App\Models\AuditLog::class,
        App\Models\Session::class,
        App\Models\Notification::class,
        Illuminate\Notifications\DatabaseNotification::class,
        App\Models\NoticeView::class,
        App\Models\UserProductTour::class,
        App\Models\UserActivity::class,
        App\Models\DealAutomationLog::class,
        App\Models\LeadAutomationLog::class,
        App\Models\RotationAutomateLog::class,
        App\Models\EmailDeliveryLog::class,
        App\Models\OlWebhookDelivery::class,
        App\Models\AgentCommissionRateAuditLog::class,
        App\Email\Models\EmailLinkAudit::class,
    ],

    /*
     * Attributes left out of every diff. An update that changes nothing but
     * these is not recorded at all.
     */
    'ignored_attributes' => [
        'created_at',
        'updated_at',
        'remember_token',
    ],

    /*
     * Read-tracking columns. An update that only touches these (plus ignored
     * attributes) is a read, not an activity, and is skipped.
     */
    'read_attributes' => [
        'read_at',
        'is_read',
        'seen_at',
        'last_seen',
        'last_seen_at',
        'last_viewed',
        'last_viewed_at',
        'last_activity',
        'last_activity_at',
        'last_login',
    ],

    /*
     * Attributes whose value is replaced with "[redacted]". Matched against
     * the attribute name case-insensitively, as a substring. `_key` covers
     * api/private/access keys and payment gateway keys (paystack_key,
     * live_razorpay_key, ...), at the cost of also hiding harmless *_key columns.
     */
    'redacted_attributes' => [
        'password',
        'secret',
        'token',
        'two_factor',
        '_key',
    ],

    /* Longest stored value per attribute; longer strings are truncated. */
    'max_value_length' => 2000,

    /*
     * Artisan commands whose writes are bulk maintenance, not activity.
     * Anything run from these commands is not audited.
     */
    'skipped_commands' => [
        'migrate',
        'migrate:fresh',
        'migrate:refresh',
        'migrate:reset',
        'migrate:rollback',
        'db:seed',
        'db:wipe',
        'schema:dump',
    ],

    /* Rows older than this many days are removed by `audit-log:prune`. 0 keeps them forever. */
    'retention_days' => (int) env('AUDIT_LOG_RETENTION_DAYS', 0),
];
