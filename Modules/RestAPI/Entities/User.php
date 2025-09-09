<?php

namespace Modules\RestAPI\Entities;

use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\NewAccessToken;

class User extends \App\Models\User
{
    use HasApiTokens;

    protected $default = [
        'id',
        'name',
        'email',
        'status',
    ];

    protected $guarded = [
        'id',
        'created_at',
        'updated_at',
    ];

    protected $filterable = [
        'id',
        'users.name',
        'email',
        'status',
    ];

    public function createToken(string $name, array $abilities = ['*'], \DateTimeInterface $expiresAt = null, array $claims = []): NewAccessToken
    {
        $token = $this->tokens()->create([
            'name' => $name,
            'token' => hash('sha256', $plainTextToken = Str::random(40)),
            'abilities' => $abilities,
            'expires_at' => $expiresAt,
            'claims' => $claims,
        ]);

        return new NewAccessToken($token, $token->getKey() . '|' . $plainTextToken);
    }

    public static function getCacheKey($id)
    {
        return 'user_'.$id;
    }

    public function devices(): HasMany
    {
        return $this->hasMany(Device::class);
    }

    public function setPasswordAttribute($value)
    {
        if ($value) {
            $this->attributes['password'] = \Hash::make($value);
        }
    }
}
