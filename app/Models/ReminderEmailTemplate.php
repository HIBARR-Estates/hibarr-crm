<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Support\Facades\Cache;

/**
 * Company-scoped Plunk template IDs for entity reminder emails.
 *
 * Mail entity keys map to models:
 * meeting → DealFollowUp, task → Task, note → DealNote/LeadNote,
 * deal → Deal, lead → Lead, property → Property,
 * project → DeveloperProject, unit → DeveloperProjectUnitType,
 * flight → LeadFlightItinerary
 *
 * Blade/Plunk files live under resources/views/mail/{model-kebab}/…
 */
class ReminderEmailTemplate extends BaseModel
{
    use HasCompany;

    public const CACHE_TTL = 300;

    public const MAIL_ENTITY_TYPES = [
        'meeting',
        'task',
        'note',
        'deal',
        'lead',
        'property',
        'project',
        'unit',
        'flight',
    ];

    protected $fillable = [
        'company_id',
        'entity_type',
        'plunk_template_id',
    ];

    protected static function boot()
    {
        parent::boot();

        static::saved(function (ReminderEmailTemplate $row) {
            $row->clearCache();
        });

        static::deleted(function (ReminderEmailTemplate $row) {
            $row->clearCache();
        });
    }

    public static function cacheKey(int $companyId, string $entityType): string
    {
        return "reminder_email_templates:{$companyId}:{$entityType}";
    }

    public function clearCache(): void
    {
        Cache::forget(self::cacheKey((int) $this->company_id, (string) $this->entity_type));
    }

    public static function isAllowedMailEntityType(string $entityType): bool
    {
        return in_array($entityType, self::MAIL_ENTITY_TYPES, true);
    }

    /**
     * Map Reminder.entity_type storage values to mail template keys.
     */
    public static function mailKeyFromReminderEntityType(string $entityType): ?string
    {
        return match ($entityType) {
            Reminder::ENTITY_MEETING => 'meeting',
            Reminder::ENTITY_TASK => 'task',
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => 'note',
            Reminder::ENTITY_DEAL => 'deal',
            Reminder::ENTITY_LEAD => 'lead',
            Reminder::ENTITY_PROPERTY => 'property',
            Reminder::ENTITY_DEVELOPER_PROJECT => 'project',
            Reminder::ENTITY_UNIT => 'unit',
            Reminder::ENTITY_FLIGHT_ITINERARY => 'flight',
            default => null,
        };
    }

    /**
     * Resolve Plunk template ID for a company + mail entity key.
     * Empty / missing → caller should send Blade HTML body instead.
     */
    public static function plunkTemplateId(int $companyId, string $mailEntityType): ?string
    {
        if ($companyId < 1 || ! self::isAllowedMailEntityType($mailEntityType)) {
            return null;
        }

        $value = Cache::remember(
            self::cacheKey($companyId, $mailEntityType),
            self::CACHE_TTL,
            function () use ($companyId, $mailEntityType) {
                return self::withoutGlobalScopes()
                    ->where('company_id', $companyId)
                    ->where('entity_type', $mailEntityType)
                    ->value('plunk_template_id');
            }
        );

        if (! is_string($value)) {
            return null;
        }

        $value = trim($value);

        return $value !== '' ? $value : null;
    }

    /**
     * @return array<string, string|null> keyed by mail entity type
     */
    public static function mapForCompany(int $companyId): array
    {
        $rows = self::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereIn('entity_type', self::MAIL_ENTITY_TYPES)
            ->pluck('plunk_template_id', 'entity_type');

        $map = [];
        foreach (self::MAIL_ENTITY_TYPES as $type) {
            $raw = $rows->get($type);
            $map[$type] = is_string($raw) && trim($raw) !== '' ? trim($raw) : null;
        }

        return $map;
    }

    /**
     * Ensure rows exist for every mail entity type.
     * Meeting keeps the known default Plunk ID when first created.
     */
    public static function seedDefaultsForCompany(int $companyId): void
    {
        if ($companyId < 1) {
            return;
        }

        $defaultMeetingId = '24330e3e-a357-41d2-8762-7014732d5b7e';

        foreach (self::MAIL_ENTITY_TYPES as $entityType) {
            $existing = self::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->where('entity_type', $entityType)
                ->first();

            if ($existing) {
                continue;
            }

            self::withoutGlobalScopes()->create([
                'company_id' => $companyId,
                'entity_type' => $entityType,
                'plunk_template_id' => $entityType === 'meeting' ? $defaultMeetingId : null,
            ]);
        }
    }

    /**
     * Upsert Plunk template IDs for a company. Empty string clears (Blade fallback).
     *
     * @param  array<string, string|null>  $templates  keyed by mail entity type
     */
    public static function syncForCompany(int $companyId, array $templates): void
    {
        foreach (self::MAIL_ENTITY_TYPES as $entityType) {
            if (! array_key_exists($entityType, $templates)) {
                continue;
            }

            $raw = $templates[$entityType];
            $value = is_string($raw) ? trim($raw) : null;
            if ($value === '') {
                $value = null;
            }

            self::withoutGlobalScopes()->updateOrCreate(
                [
                    'company_id' => $companyId,
                    'entity_type' => $entityType,
                ],
                [
                    'plunk_template_id' => $value,
                ]
            );

            Cache::forget(self::cacheKey($companyId, $entityType));
        }
    }
}
