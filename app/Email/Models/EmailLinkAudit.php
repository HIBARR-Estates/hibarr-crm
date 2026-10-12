<?php

namespace App\Email\Models;

use App\Email\Enums\LinkableType;
use App\Email\Enums\LinkAuditAction;
use App\Models\BaseModel;
use App\Traits\HasCompany;
use LogicException;

/**
 * Append-only record of who linked, unlinked, dismissed or handed off what.
 *
 * @property int $id
 * @property int $company_id
 * @property LinkAuditAction $action
 * @property int|null $conversation_id
 * @property int|null $mailbox_copy_id
 * @property LinkableType|null $linkable_type
 * @property int|null $linkable_id
 * @property int|null $actor_id
 * @property array<string, mixed>|null $meta
 * @property \Illuminate\Support\Carbon|null $created_at
 */
class EmailLinkAudit extends BaseModel
{
    use HasCompany;

    public const UPDATED_AT = null;

    protected $table = 'email_link_audits';

    protected $fillable = [
        'company_id',
        'action',
        'conversation_id',
        'mailbox_copy_id',
        'linkable_type',
        'linkable_id',
        'actor_id',
        'meta',
    ];

    protected $casts = [
        'action' => LinkAuditAction::class,
        'linkable_type' => LinkableType::class,
        'meta' => 'array',
    ];

    protected static function boot()
    {
        parent::boot();

        static::updating(function () {
            throw new LogicException('Email link audit rows are append-only.');
        });

        static::deleting(function () {
            throw new LogicException('Email link audit rows are append-only.');
        });
    }
}
