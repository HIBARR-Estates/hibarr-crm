<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

/**
 * @property int $id
 * @property int $company_id
 * @property string $webhook_token
 * @property string|null $signing_key
 * @property \Illuminate\Support\Carbon|null $last_received_at
 */
class CalendlyWebhookSetting extends Model
{
    use HasCompany;

    protected $fillable = ['webhook_token', 'signing_key', 'last_received_at'];

    protected $casts = [
        'signing_key' => 'encrypted',
        'last_received_at' => 'datetime',
    ];

    protected $hidden = ['signing_key'];

    /**
     * The company's row, created on first use. Not through the company scope:
     * the public webhook route has no signed-in user to scope by.
     */
    public static function forCompany(int $companyId): self
    {
        $setting = static::withoutGlobalScopes()->where('company_id', $companyId)->first();

        if ($setting) {
            return $setting;
        }

        $setting = new static(['webhook_token' => Str::random(40)]);
        $setting->company_id = $companyId;
        $setting->save();

        return $setting;
    }

    public static function findByToken(string $token): ?self
    {
        return static::withoutGlobalScopes()->where('webhook_token', $token)->first();
    }
}
