<?php

namespace App\Models;

use App\Traits\HasCompany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class LeadLifecycleStatus extends BaseModel
{
    use HasCompany;

    public const DEFAULT_KEY = 'new';

    protected $fillable = [
        'company_id',
        'key',
        'label',
        'description',
        'sort_order',
        'label_color',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function leads(): HasMany
    {
        return $this->hasMany(Lead::class, 'lead_lifecycle_status_id');
    }

    public static function findByKey(int $companyId, string $key): ?self
    {
        return static::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->where('key', $key)
            ->first();
    }

    /**
     * Resolve a status from free text (e.g. a spreadsheet cell during import),
     * matching case-insensitively against either the display label ("Qualified")
     * or the internal key ("qualified"/"not_fit"). Returns null on no match —
     * callers should treat that as "leave unset" rather than fail the row.
     */
    public static function resolveFromText(int $companyId, ?string $value): ?self
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        $byLabel = static::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->whereRaw('LOWER(label) = ?', [mb_strtolower($value)])
            ->first();

        if ($byLabel) {
            return $byLabel;
        }

        $slug = str_replace(' ', '_', mb_strtolower($value));

        return static::findByKey($companyId, $slug);
    }

    public static function systemKeys(): array
    {
        return array_column(static::defaultStatusDefinitions(), 'key');
    }

    public function isSystemKey(): bool
    {
        return in_array($this->key, static::systemKeys(), true);
    }

    public function isDefaultForNewLeads(): bool
    {
        return $this->key === static::DEFAULT_KEY;
    }

    public static function defaultStatusDefinitions(): array
    {
        return [
            ['key' => 'new', 'label' => 'New', 'description' => 'New lead contact', 'sort_order' => 1, 'label_color' => '#6c757d'],
            ['key' => 'contacted', 'label' => 'Contacted', 'description' => 'Initial contact made', 'sort_order' => 2, 'label_color' => '#17a2b8'],
            ['key' => 'qualifying', 'label' => 'Qualifying', 'description' => 'Qualification in progress', 'sort_order' => 3, 'label_color' => '#ffc107'],
            ['key' => 'qualified', 'label' => 'Qualified', 'description' => 'Qualified for next steps', 'sort_order' => 4, 'label_color' => '#28a745'],
            ['key' => 'nurturing', 'label' => 'Nurturing', 'description' => 'Being nurtured', 'sort_order' => 5, 'label_color' => '#6610f2'],
            ['key' => 'callback', 'label' => 'Callback', 'description' => 'Callback requested', 'sort_order' => 6, 'label_color' => '#fd7e14'],
            ['key' => 'not_fit', 'label' => 'Not a Fit', 'description' => 'Not a fit', 'sort_order' => 7, 'label_color' => '#dc3545'],
            ['key' => 'converted', 'label' => 'Converted', 'description' => 'Converted to deal', 'sort_order' => 8, 'label_color' => '#20c997'],
            ['key' => 'lost', 'label' => 'Lost', 'description' => 'Lost lead', 'sort_order' => 9, 'label_color' => '#343a40'],
        ];
    }

    public static function seedDefaultsForCompany(int $companyId): void
    {
        $now = now();

        foreach (static::defaultStatusDefinitions() as $status) {
            static::withoutGlobalScopes()->updateOrCreate(
                [
                    'company_id' => $companyId,
                    'key' => $status['key'],
                ],
                array_merge($status, [
                    'created_at' => $now,
                    'updated_at' => $now,
                ])
            );
        }
    }
}
