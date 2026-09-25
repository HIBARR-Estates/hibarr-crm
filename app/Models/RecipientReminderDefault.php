<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Support\Facades\Cache;

/**
 * Company-scoped cadence overrides keyed by entity type + recipient type.
 *
 * Used for RECIPIENT_LEAD meeting reminders so leads can diverge from the
 * company EntityReminderDefault / config fallback without colliding with
 * entity_type = "lead" (reminders about a Lead record).
 */
class RecipientReminderDefault extends BaseModel
{
    use HasCompany;

    public const CACHE_TTL = 300;

    protected $fillable = [
        'company_id',
        'entity_type',
        'recipient_type',
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

        static::saved(function (RecipientReminderDefault $row) {
            $row->clearCache();
        });

        static::deleted(function (RecipientReminderDefault $row) {
            $row->clearCache();
        });
    }

    public static function cacheKey(int $companyId, string $entityType, string $recipientType): string
    {
        return "recipient_reminder_defaults:{$companyId}:{$entityType}:{$recipientType}";
    }

    public function clearCache(): void
    {
        Cache::forget(self::cacheKey(
            (int) $this->company_id,
            (string) $this->entity_type,
            (string) $this->recipient_type
        ));
    }

    /**
     * Minutes-before list for company + entity + recipient.
     * Returns null when no active row (or empty reminders) so callers fall through.
     *
     * @return array<int, int>|null
     */
    public static function forCompanyEntityAndRecipient(
        int $companyId,
        string $entityType,
        string $recipientType
    ): ?array {
        $reminders = Cache::remember(
            self::cacheKey($companyId, $entityType, $recipientType),
            self::CACHE_TTL,
            function () use ($companyId, $entityType, $recipientType) {
                $row = self::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('entity_type', $entityType)
                    ->where('recipient_type', $recipientType)
                    ->where('is_active', true)
                    ->first();

                return $row?->reminders;
            }
        );

        if (! is_array($reminders) || $reminders === []) {
            return null;
        }

        return array_values(array_map('intval', $reminders));
    }
}
