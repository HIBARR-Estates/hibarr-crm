<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

/**
 * App\Models\UserProductTour
 *
 * Tracks which guided product tours (e.g. "deal-redesign-v1") a user has
 * completed or skipped, so the auto-launch is cross-device instead of
 * relying on localStorage.
 *
 * @property int $id
 * @property int|null $company_id
 * @property int $user_id
 * @property string $tour_id
 * @property \Illuminate\Support\Carbon $seen_at
 * @property-read \App\Models\Company|null $company
 * @property-read \App\Models\User $user
 */
class UserProductTour extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'user_product_tours';

    protected $fillable = [
        'company_id',
        'user_id',
        'tour_id',
        'seen_at',
    ];

    protected $casts = [
        'seen_at' => 'datetime',
    ];

    public const CACHE_TTL = 300;

    protected static function boot()
    {
        parent::boot();

        static::saved(function (UserProductTour $tour) {
            $tour->clearCache();
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public static function getCacheKey(int $userId): string
    {
        return "user_product_tours_seen:{$userId}";
    }

    public function clearCache(): void
    {
        Cache::forget(self::getCacheKey($this->user_id));
    }

    /**
     * Tour ids this user has already seen/dismissed, cached per user.
     *
     * @return array<int, string>
     */
    public static function seenTourIdsForUser(int $userId): array
    {
        return Cache::remember(self::getCacheKey($userId), self::CACHE_TTL, function () use ($userId) {
            return self::where('user_id', $userId)->pluck('tour_id')->all();
        });
    }

    public static function hasSeen(int $userId, string $tourId): bool
    {
        return in_array($tourId, self::seenTourIdsForUser($userId), true);
    }

    public static function markSeen(int $userId, string $tourId, ?int $companyId = null): self
    {
        return self::updateOrCreate(
            ['user_id' => $userId, 'tour_id' => $tourId],
            ['company_id' => $companyId, 'seen_at' => now()]
        );
    }
}
