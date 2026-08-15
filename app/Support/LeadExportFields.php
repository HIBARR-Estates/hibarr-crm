<?php

namespace App\Support;

use App\Enums\PreferredContactTime;
use App\Models\Lead;
use BackedEnum;
use Carbon\CarbonInterface;

/**
 * Allowlist + value resolvers for admin lead bulk export.
 * Keys must stay in sync with resources/js/Features/Leads/BulkActions/exportFieldConfig.ts.
 */
class LeadExportFields
{
    public const MAX_ROWS = 10000;

    /**
     * @return array<string, array{label: string, group: string, relations?: list<string>}>
     */
    public static function definitions(): array
    {
        return [
            // Meta
            'id' => ['label' => 'ID', 'group' => 'Meta'],
            'created_at' => ['label' => 'Created at', 'group' => 'Meta'],
            'updated_at' => ['label' => 'Updated at', 'group' => 'Meta'],

            // Contact
            'client_name' => ['label' => 'Lead name', 'group' => 'Contact'],
            'salutation' => ['label' => 'Salutation', 'group' => 'Contact'],
            'client_email' => ['label' => 'Email', 'group' => 'Contact'],
            'mobile' => ['label' => 'Mobile', 'group' => 'Contact'],
            'office' => ['label' => 'Office phone', 'group' => 'Contact'],
            'client_whatsapp' => ['label' => 'WhatsApp', 'group' => 'Contact'],
            'client_telegram' => ['label' => 'Telegram', 'group' => 'Contact'],
            'client_instagram' => ['label' => 'Instagram', 'group' => 'Contact'],
            'company_name' => ['label' => 'Company', 'group' => 'Contact'],

            // Profile
            'gender' => ['label' => 'Gender', 'group' => 'Profile'],
            'date_of_birth' => ['label' => 'Date of birth', 'group' => 'Profile'],
            'nationality' => ['label' => 'Nationality', 'group' => 'Profile'],
            'occupation' => ['label' => 'Occupation', 'group' => 'Profile'],
            'languages' => ['label' => 'Languages', 'group' => 'Profile'],
            'temperature' => ['label' => 'Temperature', 'group' => 'Profile'],
            'preferred_contact_time' => ['label' => 'Preferred contact time', 'group' => 'Profile'],
            'value' => ['label' => 'Lead value', 'group' => 'Profile'],
            'currency' => ['label' => 'Currency', 'group' => 'Profile', 'relations' => ['currency']],

            // Address
            'address' => ['label' => 'Street address', 'group' => 'Address'],
            'postal_code' => ['label' => 'Postal code', 'group' => 'Address'],
            'city' => ['label' => 'City', 'group' => 'Address'],
            'state' => ['label' => 'State', 'group' => 'Address'],
            'country' => ['label' => 'Country', 'group' => 'Address'],

            // Assignment (display names)
            'source' => ['label' => 'Source', 'group' => 'Assignment', 'relations' => ['leadSource']],
            'categories' => ['label' => 'Categories', 'group' => 'Assignment', 'relations' => ['categories']],
            'lead_owner' => ['label' => 'Lead owner', 'group' => 'Assignment', 'relations' => ['leadOwner']],
            'added_by' => ['label' => 'Added by', 'group' => 'Assignment', 'relations' => ['addedBy']],
            'lifecycle_status' => [
                'label' => 'Lifecycle status',
                'group' => 'Assignment',
                'relations' => ['lifecycleStatus'],
            ],

            // Marketing
            'utm_source' => ['label' => 'UTM source', 'group' => 'Marketing', 'relations' => ['marketing']],
            'utm_medium' => ['label' => 'UTM medium', 'group' => 'Marketing', 'relations' => ['marketing']],
            'utm_campaign' => ['label' => 'UTM campaign', 'group' => 'Marketing', 'relations' => ['marketing']],
            'utm_content' => ['label' => 'UTM content', 'group' => 'Marketing', 'relations' => ['marketing']],
            'utm_term' => ['label' => 'UTM term', 'group' => 'Marketing', 'relations' => ['marketing']],
            'utm_audience' => ['label' => 'UTM audience', 'group' => 'Marketing', 'relations' => ['marketing']],
            'contact_score' => ['label' => 'Contact score', 'group' => 'Marketing', 'relations' => ['marketing']],
            'has_registered_for_the_webinar' => [
                'label' => 'Webinar registered',
                'group' => 'Marketing',
                'relations' => ['marketing'],
            ],
            'has_attended_the_webinar' => [
                'label' => 'Webinar attended',
                'group' => 'Marketing',
                'relations' => ['marketing'],
            ],
            'last_webinar_date' => [
                'label' => 'Last webinar',
                'group' => 'Marketing',
                'relations' => ['marketing'],
            ],
            'has_downloaded_the_ebook' => [
                'label' => 'Ebook downloaded',
                'group' => 'Marketing',
                'relations' => ['marketing'],
            ],
            'has_joined_the_facebook_group' => [
                'label' => 'FB group',
                'group' => 'Marketing',
                'relations' => ['marketing'],
            ],
            'has_joined_the_whatsapp_group' => [
                'label' => 'WhatsApp group',
                'group' => 'Marketing',
                'relations' => ['marketing'],
            ],
        ];
    }

    /**
     * @return list<string>
     */
    public static function allowedKeys(): array
    {
        return array_keys(self::definitions());
    }

    /**
     * Keep only allowlisted keys; preserve client order; drop duplicates.
     *
     * @param  list<mixed>  $requested
     * @return list<string>
     */
    public static function filterRequested(array $requested): array
    {
        $allowed = array_flip(self::allowedKeys());
        $out = [];

        foreach ($requested as $key) {
            $key = (string) $key;
            if (! isset($allowed[$key])) {
                continue;
            }
            if (in_array($key, $out, true)) {
                continue;
            }
            $out[] = $key;
        }

        return $out;
    }

    /**
     * @param  list<string>  $fieldKeys
     * @return list<string>
     */
    public static function relationsFor(array $fieldKeys): array
    {
        $defs = self::definitions();
        $relations = [];

        foreach ($fieldKeys as $key) {
            foreach ($defs[$key]['relations'] ?? [] as $relation) {
                $relations[$relation] = true;
            }
        }

        return array_keys($relations);
    }

    /**
     * @param  list<string>  $fieldKeys
     * @return list<string>
     */
    public static function headings(array $fieldKeys): array
    {
        $defs = self::definitions();

        return array_map(
            static fn (string $key) => $defs[$key]['label'] ?? $key,
            $fieldKeys
        );
    }

    /**
     * @param  list<string>  $fieldKeys
     * @return list<mixed>
     */
    public static function mapLead(Lead $lead, array $fieldKeys): array
    {
        return array_map(
            static fn (string $key) => self::resolve($lead, $key),
            $fieldKeys
        );
    }

    public static function resolve(Lead $lead, string $key): mixed
    {
        return match ($key) {
            'id' => $lead->id,
            'client_name' => $lead->client_name,
            'salutation' => self::enumLabel($lead->salutation),
            'client_email' => $lead->client_email,
            'mobile' => self::phoneDisplay($lead->mobile, $lead->mobile_with_phonecode ?? null),
            'office' => self::phoneDisplay($lead->office, $lead->office_phone_formatted ?? null),
            'client_whatsapp' => $lead->client_whatsapp,
            'client_telegram' => $lead->client_telegram,
            'client_instagram' => $lead->client_instagram,
            'company_name' => $lead->company_name,
            'gender' => self::enumLabel($lead->gender),
            'date_of_birth' => self::formatDate($lead->date_of_birth),
            'nationality' => $lead->nationality,
            'occupation' => $lead->occupation,
            'languages' => self::formatList($lead->languages),
            'temperature' => self::enumLabel($lead->temperature),
            'preferred_contact_time' => collect($lead->resolvedPreferredContactTimes())
                ->map(fn (string $value) => PreferredContactTime::tryFrom($value)?->label() ?? $value)
                ->implode(', '),
            'value' => $lead->value,
            'currency' => $lead->currency?->currency_code ?? $lead->currency?->currency_name,
            'address' => $lead->address,
            'postal_code' => $lead->postal_code,
            'city' => $lead->city,
            'state' => $lead->state,
            'country' => $lead->country,
            'source' => $lead->leadSource?->type,
            'categories' => $lead->categories
                ? $lead->categories->pluck('category_name')->filter()->implode(', ')
                : ($lead->category?->category_name),
            'lead_owner' => $lead->leadOwner?->name,
            'added_by' => $lead->addedBy?->name,
            'lifecycle_status' => $lead->lifecycleStatus?->label,
            'created_at' => self::formatDateTime($lead->created_at),
            'updated_at' => self::formatDateTime($lead->updated_at),
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_content',
            'utm_term',
            'utm_audience' => $lead->marketing?->{$key},
            'contact_score' => $lead->marketing?->contact_score,
            'has_registered_for_the_webinar',
            'has_attended_the_webinar',
            'has_downloaded_the_ebook',
            'has_joined_the_facebook_group',
            'has_joined_the_whatsapp_group' => self::formatBool($lead->marketing?->{$key}),
            'last_webinar_date' => self::formatDate($lead->marketing?->last_webinar_date),
            default => null,
        };
    }

    private static function enumLabel(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_object($value) && method_exists($value, 'label')) {
            return (string) $value->label();
        }

        if ($value instanceof BackedEnum) {
            return (string) $value->value;
        }

        return (string) $value;
    }

    private static function formatDate(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value->format('Y-m-d');
        }

        return (string) $value;
    }

    private static function formatDateTime(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if ($value instanceof CarbonInterface) {
            return $value->format('Y-m-d H:i:s');
        }

        return (string) $value;
    }

    private static function formatList(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_array($value)) {
            return implode(', ', array_map('strval', $value));
        }

        return (string) $value;
    }

    private static function formatBool(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        return $value ? 'Yes' : 'No';
    }

    private static function phoneDisplay(mixed $raw, mixed $formatted): ?string
    {
        if (is_string($formatted) && $formatted !== '' && $formatted !== '--') {
            return $formatted;
        }

        if ($raw === null || $raw === '') {
            return null;
        }

        if (is_string($raw)) {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $code = $decoded['phoneCode'] ?? $decoded['countryCode'] ?? '';
                $number = $decoded['phoneNumber'] ?? $decoded['number'] ?? '';
                $combined = trim(($code ? '+'.ltrim((string) $code, '+').' ' : '').(string) $number);

                return $combined !== '' ? $combined : $raw;
            }
        }

        return (string) $raw;
    }
}
