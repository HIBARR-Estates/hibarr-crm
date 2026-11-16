<?php

namespace App\Support;

use App\Models\LeadUtmTouch;
use App\Services\FormDataService;
use App\Services\I18nTranslationService;
use Illuminate\Support\Facades\Cache;

/**
 * The caches that Settings → Cache refresh may clear: derived data that is
 * rebuilt on the next read and otherwise only refreshes when its TTL runs out.
 *
 * This is deliberately a fixed list rather than a cache flush. The same cache
 * store also holds locks, de-duplication markers and revoked-session entries
 * (deal creation, automations, Keycloak logout), and those must never be
 * cleared from a settings page.
 */
class ExpiringCacheRegistry
{
    public const LEAD_UTM_VALUES = 'lead_utm_values';

    public const DROPDOWN_LISTS = 'dropdown_lists';

    public const TRANSLATIONS = 'translations';

    public const EXPOSE_BRANDING = 'expose_branding';

    /**
     * @return array<string, array{ttl_seconds: int, keys: list<string>}>
     */
    public static function groups(int $companyId): array
    {
        return [
            self::LEAD_UTM_VALUES => [
                'ttl_seconds' => 1800,
                'keys' => array_map(
                    fn (string $column) => FormDataService::utmValuesCacheKey($column, $companyId),
                    LeadUtmTouch::UTM_FIELDS,
                ),
            ],
            self::DROPDOWN_LISTS => [
                'ttl_seconds' => 1800,
                'keys' => [
                    'salutations',
                    'genders',
                    'age_ranges',
                    'lead_temperatures',
                    'lead_preferred_contact_times',
                    // Unsearched lists only: searched variants are keyed by the
                    // search text and simply expire.
                    'countries_',
                    'company_currencies_' . $companyId . '_',
                ],
            ],
            self::TRANSLATIONS => [
                'ttl_seconds' => 3600,
                'keys' => array_map(
                    fn (string $locale) => "translations_{$locale}",
                    I18nTranslationService::SUPPORTED_LOCALES,
                ),
            ],
            self::EXPOSE_BRANDING => [
                'ttl_seconds' => 86400,
                'keys' => ['expose_branding_base64'],
            ],
        ];
    }

    /**
     * Forget every key of the given groups (all groups when null).
     *
     * @param  list<string>|null  $only
     * @return list<string> the groups that were cleared
     */
    public static function clear(int $companyId, ?array $only = null): array
    {
        $cleared = [];

        foreach (self::groups($companyId) as $name => $group) {
            if ($only !== null && ! in_array($name, $only, true)) {
                continue;
            }

            foreach ($group['keys'] as $key) {
                Cache::forget($key);
            }

            $cleared[] = $name;
        }

        return $cleared;
    }
}
