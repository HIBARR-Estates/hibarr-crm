<?php

namespace App\Models;

use App\Traits\HasCompany;

class ExposeJob extends BaseModel
{
    use HasCompany;

    const STATUS_QUEUED = 'queued';
    const STATUS_PROCESSING = 'processing';
    const STATUS_READY = 'ready';
    const STATUS_FAILED = 'failed';

    const ENTITY_PROPERTY = 'property';
    const ENTITY_DEVELOPER_PROJECT = 'developer_project';
    const ENTITY_UNIT_TYPE = 'unit_type';

    protected $fillable = [
        'company_id',
        'user_id',
        'entity_type',
        'entity_id',
        'sub_entity_id',
        'status',
        'filename',
        'download_url',
        'object_path',
        'payload',
        'error_message',
        'expires_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'expires_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function isReady(): bool
    {
        return $this->status === self::STATUS_READY;
    }

    public function hasFailed(): bool
    {
        return $this->status === self::STATUS_FAILED;
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
