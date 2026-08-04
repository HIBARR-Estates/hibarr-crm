<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Cache;

/**
 * App\Models\UserReminderPreference
 *
 * @property int $id
 * @property int|null $company_id
 * @property int $user_id
 * @property string $entity_type
 * @property array|null $reminders
 * @property bool $is_active
 * @property \Illuminate\Support\Carbon|null $created_at
 * @property \Illuminate\Support\Carbon|null $updated_at
 * @property-read \App\Models\Company|null $company
 * @property-read \App\Models\User $user
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference newModelQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference newQuery()
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference query()
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference whereCompanyId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference whereUserId($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference whereEntityType($value)
 * @method static \Illuminate\Database\Eloquent\Builder|UserReminderPreference whereIsActive($value)
 * @mixin \Eloquent
 */
class UserReminderPreference extends BaseModel
{
    use HasFactory, HasCompany;

    protected $table = 'user_reminder_preferences';

    protected $fillable = [
        'company_id',
        'user_id',
        'entity_type',
        'reminders',
        'is_active',
    ];

    protected $casts = [
        'reminders' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Default reminders matching DealFollowUp::DEFAULT_REMINDERS
     * Used when user has no custom preferences
     */
    public const DEFAULT_REMINDERS = [
        ['time' => 1, 'type' => 'hour'],
        ['time' => 30, 'type' => 'minute'],
        ['time' => 15, 'type' => 'minute'],
        ['time' => 5, 'type' => 'minute'],
    ];

    /**
     * Valid entity types
     */
    public const ENTITY_TYPES = [
        'meeting',
        'task',
        'note',
        'deal',
        'lead',
        'property',
        'project',
        'unit',
        'flight_itinerary',
        'all',
    ];

    /**
     * Cache TTL in seconds (5 minutes)
     */
    public const CACHE_TTL = 300;

    /**
     * Boot the model and register cache invalidation observers
     */
    protected static function boot()
    {
        parent::boot();

        // Clear cache when preference is saved
        static::saved(function (UserReminderPreference $preference) {
            $preference->clearCache();
        });

        // Clear cache when preference is deleted
        static::deleted(function (UserReminderPreference $preference) {
            $preference->clearCache();
        });
    }

    /**
     * Get the user that owns this preference
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get cache key for user reminder preferences
     */
    public static function getCacheKey(int $userId, string $entityType): string
    {
        return "user_reminder_prefs:{$userId}:{$entityType}";
    }

    /**
     * Clear cache for this preference
     */
    public function clearCache(): void
    {
        Cache::forget(self::getCacheKey($this->user_id, $this->entity_type));
        // Also clear 'all' cache if entity-specific preference changes
        if ($this->entity_type !== 'all') {
            Cache::forget(self::getCacheKey($this->user_id, 'all'));
        }
        // Clear meeting/task/note cache if 'all' preference changes
        if ($this->entity_type === 'all') {
            Cache::forget(self::getCacheKey($this->user_id, 'meeting'));
            Cache::forget(self::getCacheKey($this->user_id, 'task'));
            Cache::forget(self::getCacheKey($this->user_id, 'note'));
        }
    }

    /**
     * Get reminders for a user and entity type with caching
     * Falls back to system defaults if no preference exists
     *
     * @param int $userId
     * @param string $entityType 'meeting', 'task', or 'all'
     * @return array
     */
    public static function getRemindersForUser(int $userId, string $entityType = 'meeting'): array
    {
        $cacheKey = self::getCacheKey($userId, $entityType);

        return Cache::remember($cacheKey, self::CACHE_TTL, function () use ($userId, $entityType) {
            // First try to find entity-specific preference
            $preference = self::where('user_id', $userId)
                ->where('entity_type', $entityType)
                ->where('is_active', true)
                ->first();

            // If not found and not looking for 'all', try 'all' preference
            if (!$preference && $entityType !== 'all') {
                $preference = self::where('user_id', $userId)
                    ->where('entity_type', 'all')
                    ->where('is_active', true)
                    ->first();
            }

            // Return user's reminders or system defaults
            return $preference?->reminders ?? self::DEFAULT_REMINDERS;
        });
    }

    /**
     * Check if user has custom preferences for an entity type
     *
     * @param int $userId
     * @param string $entityType
     * @return bool
     */
    public static function hasCustomPreferences(int $userId, string $entityType = 'meeting'): bool
    {
        return self::where('user_id', $userId)
            ->whereIn('entity_type', [$entityType, 'all'])
            ->where('is_active', true)
            ->exists();
    }

    /**
     * Reset user preferences to defaults by deleting the record
     *
     * @param int $userId
     * @param string $entityType
     * @return bool
     */
    public static function resetToDefaults(int $userId, string $entityType): bool
    {
        $preference = self::where('user_id', $userId)
            ->where('entity_type', $entityType)
            ->first();

        if ($preference) {
            return $preference->delete();
        }

        return true;
    }
}
