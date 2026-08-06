<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ExposeSnapshot extends BaseModel
{
    use HasCompany;

    public const ENTITY_PROPERTY = 'property';
    public const ENTITY_DEVELOPER_PROJECT = 'developer_project';
    public const ENTITY_UNIT_TYPE = 'unit_type';

    public const ENTITY_TYPES = [
        self::ENTITY_PROPERTY,
        self::ENTITY_DEVELOPER_PROJECT,
        self::ENTITY_UNIT_TYPE,
    ];

    protected $fillable = [
        'company_id',
        'token_hash',
        'token_prefix',
        'entity_type',
        'entity_id',
        'sub_entity_id',
        'agent_user_id',
        'lead_id',
        'layout',
        'request_payload',
        'agent_snapshot',
        'lead_snapshot',
        'expose_payload',
        'schema_version',
        'warnings',
    ];

    protected $casts = [
        'request_payload' => 'array',
        'agent_snapshot' => 'array',
        'lead_snapshot' => 'array',
        'expose_payload' => 'array',
        'warnings' => 'array',
        'schema_version' => 'integer',
    ];

    protected $hidden = [
        'token_hash',
    ];

    public function agent(): BelongsTo
    {
        return $this->belongsTo(User::class, 'agent_user_id');
    }

    public function lead(): BelongsTo
    {
        return $this->belongsTo(Lead::class, 'lead_id');
    }

    public static function generatePlainToken(): string
    {
        return 'exp_' . bin2hex(random_bytes(24));
    }

    public static function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    public static function tokenPrefix(string $plainToken): string
    {
        return substr($plainToken, 0, 12);
    }

    public static function findByPlainToken(string $plainToken, int $companyId): ?self
    {
        return static::query()
            ->where('company_id', $companyId)
            ->where('token_hash', self::hashToken($plainToken))
            ->first();
    }
}
