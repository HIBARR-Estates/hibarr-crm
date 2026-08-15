<?php

namespace App\Support;

use App\Models\Deal;
use BackedEnum;
use Carbon\CarbonInterface;

/**
 * Allowlist + value resolvers for admin deal bulk export.
 * Keys must stay in sync with resources/js/Features/Deals/BulkActions/dealExportFieldConfig.ts.
 */
class DealExportFields
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

            // Deal
            'name' => ['label' => 'Deal name', 'group' => 'Deal'],
            'value' => ['label' => 'Value', 'group' => 'Deal'],
            'currency' => ['label' => 'Currency', 'group' => 'Deal', 'relations' => ['currency']],
            'outcome_status' => ['label' => 'Outcome', 'group' => 'Deal'],
            'is_locked' => ['label' => 'Locked', 'group' => 'Deal'],
            'close_date' => ['label' => 'Close date', 'group' => 'Deal'],
            'next_follow_up' => ['label' => 'Next follow-up', 'group' => 'Deal'],

            // Pipeline
            'pipeline' => ['label' => 'Pipeline', 'group' => 'Pipeline', 'relations' => ['pipeline']],
            'stage' => ['label' => 'Stage', 'group' => 'Pipeline', 'relations' => ['leadStage']],
            'category' => ['label' => 'Category', 'group' => 'Pipeline', 'relations' => ['category']],

            // Assignment
            'agent' => ['label' => 'Agent', 'group' => 'Assignment', 'relations' => ['leadAgent.user']],
            'added_by' => ['label' => 'Added by', 'group' => 'Assignment', 'relations' => ['addedBy']],

            // Contact (the linked lead)
            'contact_name' => ['label' => 'Contact name', 'group' => 'Contact', 'relations' => ['contact']],
            'contact_email' => ['label' => 'Contact email', 'group' => 'Contact', 'relations' => ['contact']],
            'contact_mobile' => ['label' => 'Contact mobile', 'group' => 'Contact', 'relations' => ['contact']],
            'contact_company' => ['label' => 'Contact company', 'group' => 'Contact', 'relations' => ['contact']],
            'contact_source' => [
                'label' => 'Lead source',
                'group' => 'Contact',
                'relations' => ['contact.leadSource'],
            ],

            // Products
            'packages' => ['label' => 'Packages', 'group' => 'Products', 'relations' => ['packages']],
            'properties' => ['label' => 'Properties', 'group' => 'Products', 'relations' => ['products']],
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
            if (! isset($allowed[$key]) || in_array($key, $out, true)) {
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
    public static function mapDeal(Deal $deal, array $fieldKeys): array
    {
        return array_map(
            static fn (string $key) => self::resolve($deal, $key),
            $fieldKeys
        );
    }

    public static function resolve(Deal $deal, string $key): mixed
    {
        return match ($key) {
            'id' => $deal->id,
            'created_at' => self::formatDate($deal->created_at),
            'updated_at' => self::formatDate($deal->updated_at),

            'name' => $deal->name,
            'value' => $deal->value,
            'currency' => $deal->currency?->currency_code,
            'outcome_status' => self::enumLabel($deal->outcome_status),
            'is_locked' => $deal->is_locked ? 'Yes' : 'No',
            'close_date' => self::formatDate($deal->close_date),
            'next_follow_up' => self::formatDate($deal->next_follow_up),

            'pipeline' => $deal->pipeline?->name,
            'stage' => $deal->leadStage?->name,
            'category' => $deal->category?->category_name,

            'agent' => $deal->leadAgent?->user?->name,
            'added_by' => $deal->addedBy?->name,

            'contact_name' => $deal->contact?->client_name,
            'contact_email' => $deal->contact?->client_email,
            'contact_mobile' => $deal->contact?->mobile_with_phonecode ?: $deal->contact?->mobile,
            'contact_company' => $deal->contact?->company_name,
            'contact_source' => $deal->contact?->leadSource?->type,

            'packages' => $deal->packages->pluck('name')->filter()->implode(', '),
            'properties' => $deal->products->pluck('name')->filter()->implode(', '),

            default => null,
        };
    }

    private static function enumLabel(mixed $value): ?string
    {
        if ($value instanceof BackedEnum) {
            return (string) $value->value;
        }

        return $value === null ? null : (string) $value;
    }

    private static function formatDate(mixed $value): ?string
    {
        return $value instanceof CarbonInterface
            ? $value->toDateTimeString()
            : ($value === null ? null : (string) $value);
    }
}
