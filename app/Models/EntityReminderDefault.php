<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Support\Facades\Cache;

class EntityReminderDefault extends BaseModel
{
    use HasCompany;

    public const ENTITY_ALL = 'all';
    public const ENTITY_MEETING = 'meeting';
    public const ENTITY_TASK = 'task';
    public const ENTITY_DEAL = 'deal';
    public const ENTITY_LEAD = 'lead';

    public const CACHE_TTL = 300;

    protected $fillable = [
        'company_id',
        'entity_type',
        'reminders',
        'is_active',
    ];

    protected $casts = [
        'reminders' => 'array',
        'is_active' => 'boolean',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saved(function (EntityReminderDefault $row) {
            $row->clearCache();
        });

        static::deleted(function (EntityReminderDefault $row) {
            $row->clearCache();
        });
    }

    /**
     * @return array<int, string>
     */
    public static function allowedEntityTypes(): array
    {
        $types = config('reminders.entity_types', [
            self::ENTITY_ALL,
            self::ENTITY_MEETING,
            self::ENTITY_TASK,
            self::ENTITY_DEAL,
            self::ENTITY_LEAD,
        ]);

        return array_values(array_unique(array_map('strval', is_array($types) ? $types : [])));
    }

    public static function isAllowedEntityType(string $entityType): bool
    {
        return in_array($entityType, self::allowedEntityTypes(), true);
    }

    public static function cacheKey(int $companyId, string $entityType): string
    {
        return "entity_reminder_defaults:{$companyId}:{$entityType}";
    }

    public function clearCache(): void
    {
        Cache::forget(self::cacheKey((int) $this->company_id, (string) $this->entity_type));
        if ($this->entity_type !== self::ENTITY_ALL) {
            Cache::forget(self::cacheKey((int) $this->company_id, self::ENTITY_ALL));
        }
    }

    /**
     * Minutes-before list for company + entity, falling back to "all".
     *
     * @return array<int, int>|null
     */
    public static function forCompanyAndType(int $companyId, string $entityType): ?array
    {
        $specific = Cache::remember(
            self::cacheKey($companyId, $entityType),
            self::CACHE_TTL,
            function () use ($companyId, $entityType) {
                $row = self::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('entity_type', $entityType)
                    ->where('is_active', true)
                    ->first();

                return $row?->reminders;
            }
        );

        if (is_array($specific) && $specific !== []) {
            return array_values(array_map('intval', $specific));
        }

        if ($entityType === self::ENTITY_ALL) {
            return null;
        }

        $all = Cache::remember(
            self::cacheKey($companyId, self::ENTITY_ALL),
            self::CACHE_TTL,
            function () use ($companyId) {
                $row = self::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('entity_type', self::ENTITY_ALL)
                    ->where('is_active', true)
                    ->first();

                return $row?->reminders;
            }
        );

        if (is_array($all) && $all !== []) {
            return array_values(array_map('intval', $all));
        }

        return null;
    }

    /**
     * Seed meeting + all rows from config('reminders.default') as minutes.
     */
    public static function seedDefaultsForCompany(int $companyId): void
    {
        $minutes = self::configDefaultsAsMinutes();

        foreach ([self::ENTITY_MEETING, self::ENTITY_ALL] as $entityType) {
            self::withoutGlobalScopes()->updateOrCreate(
                [
                    'company_id' => $companyId,
                    'entity_type' => $entityType,
                ],
                [
                    'reminders' => $minutes,
                    'is_active' => true,
                ]
            );
        }
    }

    /**
     * @return array<int, int>
     */
    public static function configDefaultsAsMinutes(): array
    {
        $raw = config('reminders.default', []);

        return array_values(array_filter(array_map(
            static fn ($item) => self::offsetToMinutes($item),
            is_array($raw) ? $raw : []
        )));
    }

    /**
     * @param  array{time?: int|string, type?: string}|int  $item
     */
    public static function offsetToMinutes(array|int $item): ?int
    {
        if (is_int($item) || (is_numeric($item) && !is_array($item))) {
            return max(0, (int) $item);
        }

        $time = (int) ($item['time'] ?? 0);
        $type = (string) ($item['type'] ?? 'minute');

        return match ($type) {
            'day' => $time * 1440,
            'hour' => $time * 60,
            default => $time,
        };
    }

    /**
     * @return array{time: int, type: string}
     */
    public static function minutesToOffset(int $minutes): array
    {
        $minutes = max(0, $minutes);

        if ($minutes >= 1440 && $minutes % 1440 === 0) {
            return ['time' => (int) ($minutes / 1440), 'type' => 'day'];
        }

        if ($minutes >= 60 && $minutes % 60 === 0) {
            return ['time' => (int) ($minutes / 60), 'type' => 'hour'];
        }

        return ['time' => $minutes, 'type' => 'minute'];
    }

    /**
     * @param  array<int, int>  $minutes
     * @return array<int, array{time: int, type: string}>
     */
    public static function minutesListToOffsets(array $minutes): array
    {
        return array_map(
            static fn ($value) => self::minutesToOffset((int) $value),
            array_values($minutes)
        );
    }
}
