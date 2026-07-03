<?php

namespace App\Models;

use App\Services\ApiTokenScopeService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApiToken extends Model
{
    protected $table = 'api_tokens';

    protected $fillable = [
        'token',
        'name',
        'permissions',
        'revoked',
        'company_id',
    ];

    protected $casts = [
        'permissions' => 'array',
        'revoked' => 'boolean',
    ];

    protected $hidden = [
        'token',
    ];

    public function company(): BelongsTo
    {
        return $this->belongsTo(Company::class);
    }

    public static function generatePlainToken(): string
    {
        return 'hib_' . bin2hex(random_bytes(24));
    }

    public static function hashToken(string $plainToken): string
    {
        return hash('sha256', $plainToken);
    }

    public function maskedToken(): string
    {
        $token = (string) $this->token;

        if ($token === '') {
            return '';
        }

        if (strlen($token) <= 12) {
            return str_repeat('•', strlen($token));
        }

        return substr($token, 0, 8) . str_repeat('•', 8) . substr($token, -4);
    }

    public function isUnrestricted(): bool
    {
        return ApiTokenScopeService::isUnrestricted($this->permissions);
    }

    /**
     * @return list<string>
     */
    public function scopeKeys(): array
    {
        return ApiTokenScopeService::scopesForToken($this->permissions);
    }

    /**
     * @return list<string>
     */
    public function scopeLabels(): array
    {
        return ApiTokenScopeService::labelsForScopeKeys($this->scopeKeys());
    }
}
