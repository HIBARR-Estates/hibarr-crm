<?php

namespace App\Services\LeadMerge;

use App\Models\Currency;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadSource;
use App\Models\LeadStatus;
use App\Models\User;
use App\Scopes\ActiveScope;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Support\Facades\Schema;
use Throwable;

/**
 * The lead columns a merge compares, grouped the way the merge modal shows
 * them, and how to turn each stored value into something a person can read.
 *
 * Every column here is merged the same way: an empty value on the kept lead is
 * filled from the duplicate, and where both hold different values the person
 * merging picks one (the kept lead's by default). Columns missing from the
 * schema are skipped, so older databases keep working.
 */
final class LeadMergeFields
{
    /** @var array<string, list<string>> */
    public const GROUPS = [
        'contact' => [
            'client_name',
            'client_email',
            'mobile',
            'cell',
            'office',
            'company_name',
            'website',
            'address',
            'city',
            'state',
            'country',
            'postal_code',
            'client_whatsapp',
            'client_telegram',
            'client_instagram',
        ],
        'personal' => [
            'salutation',
            'gender',
            'date_of_birth',
            'age_range',
            'nationality',
            'occupation',
            'primary_language',
            'preferred_contact_time',
        ],
        'status' => [
            'source_id',
            'status_id',
            'lead_lifecycle_status_id',
            'temperature',
            'value',
            'currency_id',
        ],
        'ownership' => [
            'lead_owner',
            'added_by',
            'client_id',
            'agent_id',
            'referred_by_agent_id',
        ],
    ];

    /** Readable English names, used in the merge note. @var array<string, string> */
    public const LABELS = [
        'client_name' => 'Name',
        'client_email' => 'Email',
        'mobile' => 'Mobile',
        'cell' => 'Phone',
        'office' => 'Office phone',
        'company_name' => 'Company',
        'website' => 'Website',
        'address' => 'Address',
        'city' => 'City',
        'state' => 'State',
        'country' => 'Country',
        'postal_code' => 'Postal code',
        'client_whatsapp' => 'WhatsApp',
        'client_telegram' => 'Telegram',
        'client_instagram' => 'Instagram',
        'salutation' => 'Salutation',
        'gender' => 'Gender',
        'date_of_birth' => 'Date of birth',
        'age_range' => 'Age range',
        'nationality' => 'Nationality',
        'occupation' => 'Occupation',
        'primary_language' => 'Primary language',
        'preferred_contact_time' => 'Preferred contact time',
        'source_id' => 'Source',
        'status_id' => 'Pipeline status',
        'lead_lifecycle_status_id' => 'Lifecycle status',
        'temperature' => 'Temperature',
        'value' => 'Value',
        'currency_id' => 'Currency',
        'lead_owner' => 'Lead owner',
        'added_by' => 'Added by',
        'client_id' => 'Client',
        'agent_id' => 'Agent',
        'referred_by_agent_id' => 'Referred by',
        'contact_score' => 'Lead score',
        'traffic_source_id' => 'Traffic source',
    ];

    /** Contact columns whose losing value is kept as an alternate contact method. @var list<string> */
    public const ALTERNATE_CONTACT_FIELDS = ['client_email', 'mobile', 'cell', 'office'];

    /**
     * Write-once columns: an empty value is filled from the duplicate, but a
     * value already set is never replaced (LeadObserver::saving rejects it).
     *
     * @var list<string>
     */
    public const LOCKED_FIELDS = ['referred_by_agent_id'];

    /** @var array<string, true>|null */
    private static ?array $columns = null;

    /** Looked-up display names by "table:id". @var array<string, string|null> */
    private static array $labels = [];

    /**
     * Every merged column that exists on this database's leads table.
     *
     * @return array<string, list<string>>
     */
    public static function groups(): array
    {
        $existing = self::leadColumns();

        $groups = [];
        foreach (self::GROUPS as $group => $fields) {
            $groups[$group] = array_values(array_filter($fields, fn ($f) => isset($existing[$f])));
        }

        return $groups;
    }

    /** @return list<string> */
    public static function fields(): array
    {
        return array_merge(...array_values(self::groups()));
    }

    public static function hasLeadColumn(string $column): bool
    {
        return isset(self::leadColumns()[$column]);
    }

    /** Forget the cached column list (tests rebuild the schema per test). */
    public static function flush(): void
    {
        self::$columns = null;
        self::$labels = [];
    }

    /** @return array<string, true> */
    private static function leadColumns(): array
    {
        if (self::$columns === null) {
            try {
                self::$columns = array_fill_keys(Schema::getColumnListing('leads'), true);
            } catch (Throwable) {
                self::$columns = [];
            }
        }

        return self::$columns;
    }

    /** The stored value, as a string for comparing two leads (null when empty). */
    public static function raw(Lead $lead, string $field): ?string
    {
        $value = $lead->getAttributes()[$field] ?? null;

        if ($value === null) {
            return null;
        }

        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }

    /** What a person sees for a lead's value, e.g. a user's name for lead_owner. */
    public static function display(Lead $lead, string $field): ?string
    {
        if (self::raw($lead, $field) === null) {
            return null;
        }

        $id = (int) self::raw($lead, $field);

        // Lookups are cached per table and id for the review or merge: both
        // leads often share an owner, source or currency.
        $lookup = match ($field) {
            'lead_owner', 'added_by', 'client_id' => 'user',
            'agent_id', 'referred_by_agent_id' => 'agent',
            'source_id', 'status_id', 'lead_lifecycle_status_id', 'currency_id' => $field,
            default => null,
        };
        if ($lookup !== null && array_key_exists($lookup.':'.$id, self::$labels)) {
            return self::$labels[$lookup.':'.$id] ?? self::raw($lead, $field);
        }

        try {
            $label = match ($field) {
                'lead_owner', 'added_by', 'client_id' => User::withoutGlobalScope(ActiveScope::class)->whereKey($id)->value('name'),
                'agent_id', 'referred_by_agent_id' => LeadAgent::query()->find($id)?->user?->name,
                'source_id' => LeadSource::withoutGlobalScopes()->whereKey($id)->value('type'),
                'status_id' => LeadStatus::withoutGlobalScopes()->whereKey($id)->value('type'),
                'lead_lifecycle_status_id' => LeadLifecycleStatus::withoutGlobalScopes()->whereKey($id)->value('label'),
                'currency_id' => Currency::withoutGlobalScopes()->whereKey($id)->value('currency_code'),
                default => self::format($lead->{$field}),
            };
        } catch (Throwable) {
            $label = null;
        }

        if ($lookup !== null) {
            self::$labels[$lookup.':'.$id] = $label;
        }

        return $label ?? self::raw($lead, $field);
    }

    public static function format(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        if ($value instanceof BackedEnum) {
            return method_exists($value, 'label') ? (string) $value->label() : (string) $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format('j M Y');
        }

        if (is_array($value)) {
            return implode(', ', array_map(fn ($v) => (string) (is_scalar($v) ? $v : json_encode($v)), $value));
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        return (string) $value;
    }
}
