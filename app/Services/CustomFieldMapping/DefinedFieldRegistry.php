<?php

namespace App\Services\CustomFieldMapping;

use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Support\Facades\Schema;

/**
 * The built-in ("defined") lead and deal fields a custom field can be
 * mapped into. This is an explicit allow-list on purpose: only plain data
 * columns that are safe to bulk-write belong here (no ids, enums tied to
 * business logic, money, status or ownership columns).
 *
 * Adding a target is a one-line entry — no migration and no UI change.
 * Entries whose column does not exist in the connected database are dropped,
 * so the registry never offers a target that would fail on write.
 */
final class DefinedFieldRegistry
{
    public const KIND_STRING = 'string';
    public const KIND_DATE = 'date';
    public const KIND_INT = 'int';
    public const KIND_BOOL = 'bool';
    public const KIND_LANGUAGES = 'languages';

    /** Storage: a column on `leads`, keyed by leads.id. */
    public const STORE_LEAD = 'lead';

    /** Storage: a column on `hibarr_deal_custom_fields`, keyed by deal_id. */
    public const STORE_DEAL_EXTRA = 'deal_extra';

    /**
     * key => [label, store, column, kind, max length (string kind only)]
     *
     * @return array<string, array{key: string, label: string, store: string, column: string, kind: string, max: ?int, range: ?array, model: string}>
     */
    private static function definitions(): array
    {
        $lead = fn (string $label, string $column, string $kind, ?int $max = null, ?array $range = null) => [
            'label' => $label, 'store' => self::STORE_LEAD, 'column' => $column, 'kind' => $kind, 'max' => $max, 'range' => $range,
            'model' => Lead::CUSTOM_FIELD_MODEL,
        ];
        $deal = fn (string $label, string $column, string $kind, ?int $max = null, ?array $range = null) => [
            'label' => $label, 'store' => self::STORE_DEAL_EXTRA, 'column' => $column, 'kind' => $kind, 'max' => $max, 'range' => $range,
            'model' => Deal::CUSTOM_FIELD_MODEL,
        ];

        return [
            'lead.nationality' => $lead('Lead · Nationality', 'nationality', self::KIND_STRING, 255),
            'lead.occupation' => $lead('Lead · Occupation', 'occupation', self::KIND_STRING, 255),
            'lead.date_of_birth' => $lead('Lead · Date of birth', 'date_of_birth', self::KIND_DATE),
            'lead.age' => $lead('Lead · Age', 'age', self::KIND_INT, null, [0, 150]),
            'lead.languages' => $lead('Lead · Languages', 'languages', self::KIND_LANGUAGES),
            'lead.city' => $lead('Lead · City', 'city', self::KIND_STRING, 255),
            'lead.state' => $lead('Lead · State / region', 'state', self::KIND_STRING, 255),
            'lead.country' => $lead('Lead · Country', 'country', self::KIND_STRING, 255),
            'lead.postal_code' => $lead('Lead · Postal code', 'postal_code', self::KIND_STRING, 255),
            'lead.company_name' => $lead('Lead · Company name', 'company_name', self::KIND_STRING, 255),
            'lead.website' => $lead('Lead · Website', 'website', self::KIND_STRING, 255),

            'deal.interested_in' => $deal('Deal · Interested in', 'interested_in', self::KIND_STRING, 255),
            'deal.motivation' => $deal('Deal · Motivation', 'motivation', self::KIND_STRING, 255),
            'deal.purchase_timeline' => $deal('Deal · Purchase timeline', 'purchase_timeline', self::KIND_STRING, 255),
            'deal.budget_range' => $deal('Deal · Budget range', 'budget_range', self::KIND_STRING, 255),
            'deal.strategy_meeting_booked' => $deal('Deal · Strategy meeting booked', 'strategy_meeting_booked', self::KIND_BOOL),
            'deal.downpayment_paid' => $deal('Deal · Down payment paid', 'downpayment_paid', self::KIND_BOOL),
            'deal.inspection_trip_date' => $deal('Deal · Inspection trip date', 'inspection_trip_date', self::KIND_DATE),
        ];
    }

    /**
     * @return array<string, array{key: string, label: string, store: string, column: string, kind: string, max: ?int, range: ?array, model: string}>
     */
    public static function all(): array
    {
        $available = [];

        foreach (self::definitions() as $key => $definition) {
            $table = $definition['store'] === self::STORE_LEAD ? 'leads' : 'hibarr_deal_custom_fields';

            if (! Schema::hasTable($table) || ! Schema::hasColumn($table, $definition['column'])) {
                continue;
            }

            $available[$key] = ['key' => $key] + $definition;
        }

        return $available;
    }

    /**
     * @return array{key: string, label: string, store: string, column: string, kind: string, max: ?int, range: ?array, model: string}|null
     */
    public static function find(string $key): ?array
    {
        return self::all()[$key] ?? null;
    }

    /**
     * Shape sent to the settings page (no storage details).
     *
     * @return list<array{key: string, label: string, kind: string, model: string}>
     */
    public static function forAdmin(): array
    {
        return array_values(array_map(
            fn (array $d) => ['key' => $d['key'], 'label' => $d['label'], 'kind' => $d['kind'], 'model' => $d['model']],
            self::all(),
        ));
    }
}
