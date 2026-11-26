<?php

namespace App\Services\FinancialAssessment;

use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use App\Models\FinancialAssessmentKind;
use App\Models\FinancialAssessmentLineType;
use App\Models\Lead;
use App\Scopes\CompanyScope;
use App\Services\FinancialAssessment\Rates\CryptoRateService;
use App\Services\LeadFieldCatalog;
use App\Support\FeatureFlags;
use Illuminate\Support\Facades\DB;

/**
 * The financial assessment fields external systems can see and map against,
 * built per company from its *active* kinds and types, so a type an admin adds
 * later shows up with no deploy.
 *
 *  - Line fields  `assessment.{type_key}`            writable: an amount for that type
 *  - Metrics      `assessment.metric.{name}`         read only: figures from the current final assessment
 *  - Type totals  `assessment.metric.total.{type}`   read only: what counts toward that type
 *
 * Descriptors follow the shape of {@see LeadFieldCatalog} entries
 * (key, label, type, group, writable, write_modes, max_length, options) plus a few
 * additive keys (`accepts`, `defaults`, `kind`, `role`) that only these fields carry.
 * The whole registry is empty while the feature flag is off.
 */
class AssessmentFieldRegistry
{
    public const PREFIX = 'assessment.';

    public const METRIC_PREFIX = 'assessment.metric.';

    public const GROUP = 'financial_assessment';

    /** Companion values a line write may carry next to the amount. */
    public const ACCEPTS = ['currency', 'frequency', 'certainty', 'available_from', 'note'];

    public const MODES = ['fill', 'overwrite', 'append'];

    /** name => [label, type] */
    private const METRICS = [
        'available_now' => ['Available now', 'number'],
        'available_projected' => ['Projected including likely', 'number'],
        'uncertain_total' => ['Uncertain, not counted', 'number'],
        'income_monthly' => ['Monthly income', 'number'],
        'commitments_monthly' => ['Monthly commitments', 'number'],
        'disposable_monthly' => ['Disposable per month', 'number'],
        'assets_total' => ['Assets total', 'number'],
        'funding_total' => ['Funding total', 'number'],
        'verified' => ['Verified', 'boolean'],
        'verified_at' => ['Verified at', 'date'],
        'as_of_date' => ['Assessed as of', 'date'],
        'refresh_due_on' => ['Refresh due on', 'date'],
        'age_days' => ['Days since assessed', 'integer'],
        'is_refresh_due' => ['Refresh overdue', 'boolean'],
        'has_assessment' => ['Has a finalised assessment', 'boolean'],
        'has_draft' => ['Has a draft in progress', 'boolean'],
    ];

    public function enabled(): bool
    {
        return FeatureFlags::enabled('crm.lead-financial-assessments');
    }

    /**
     * Every assessment field for the company, line fields first.
     *
     * @return list<array<string, mixed>>
     */
    public function fields(int $companyId): array
    {
        if (! $this->enabled()) {
            return [];
        }

        return [...$this->lineFields($companyId), ...$this->metricFields($companyId)];
    }

    /** @return array<string, mixed>|null */
    public function find(int $companyId, string $key): ?array
    {
        foreach ($this->fields($companyId) as $field) {
            if ($field['key'] === $key) {
                return $field;
            }
        }

        return null;
    }

    /**
     * The line fields as targets for the custom-field "map & migrate" dialog: one per active type,
     * on the Lead model, with the type's defaults so the dialog can pre-fill them.
     *
     * @return list<array{key: string, label: string, kind: string, model: string, defaults: array<string, string|null>}>
     */
    public function mappingTargets(int $companyId): array
    {
        $targets = [];
        foreach ($this->fields($companyId) as $field) {
            if (! $field['writable']) {
                continue;
            }

            $targets[] = [
                'key' => $field['key'],
                'label' => 'Financial · '.($field['type_label'] ?? $field['label']),
                'kind' => 'amount',
                'model' => Lead::CUSTOM_FIELD_MODEL,
                'defaults' => $field['defaults'],
            ];
        }

        return $targets;
    }

    /**
     * What a mapping UI needs to offer next to an assessment target: the currencies, frequencies and
     * certainties a mapping can fix, and the company's reporting currency (the sensible default).
     *
     * @return array{currencies: list<string>, frequencies: list<string>, certainties: list<string>, reporting_currency: string}
     */
    public function mappingOptions(int $companyId): array
    {
        $service = app(AssessmentService::class);
        $fiat = DB::table('currencies')->where('company_id', $companyId)
            ->where('is_cryptocurrency', '!=', 'yes')->pluck('currency_code')
            ->map(fn ($code) => strtoupper((string) $code))
            ->push($service->reportingCurrency($companyId))
            ->unique()->sort()->values()->all();

        return [
            'currencies' => [...$fiat, ...app(CryptoRateService::class)->activeTickers($companyId)],
            'frequencies' => array_map(fn ($case) => $case->value, FinancialLineFrequency::cases()),
            'certainties' => array_map(fn ($case) => $case->value, FinancialLineCertainty::cases()),
            'reporting_currency' => $service->reportingCurrency($companyId),
        ];
    }

    /** The active type key of a writable line field, or null for anything else. */
    public static function typeKeyOf(string $fieldKey): ?string
    {
        if (! str_starts_with($fieldKey, self::PREFIX) || str_starts_with($fieldKey, self::METRIC_PREFIX)) {
            return null;
        }

        $key = substr($fieldKey, strlen(self::PREFIX));

        return $key === '' ? null : $key;
    }

    /** @return list<array<string, mixed>> */
    private function lineFields(int $companyId): array
    {
        $kinds = FinancialAssessmentKind::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('is_active', true)
            ->orderBy('sort_order')->orderBy('id')->get()->keyBy('id');

        $types = FinancialAssessmentLineType::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('is_active', true)
            ->orderBy('sort_order')->orderBy('id')->get();

        $fields = [];
        foreach ($kinds as $kind) {
            foreach ($types->where('kind_id', $kind->id) as $type) {
                $fields[] = [
                    'key' => self::PREFIX.$type->key,
                    'label' => 'Financial · '.$type->label,
                    'type' => 'number',
                    'group' => self::GROUP,
                    'writable' => true,
                    'write_modes' => self::MODES,
                    'max_length' => null,
                    'options' => null,
                    'accepts' => self::ACCEPTS,
                    'defaults' => [
                        'frequency' => $type->default_frequency?->value,
                        'certainty' => $type->default_certainty?->value,
                    ],
                    'kind' => $kind->key,
                    'role' => $kind->role->value,
                    'type_label' => $type->label,
                ];
            }
        }

        return $fields;
    }

    /** @return list<array<string, mixed>> */
    private function metricFields(int $companyId): array
    {
        $fields = [];
        foreach (self::METRICS as $name => [$label, $type]) {
            $fields[] = $this->metric(self::METRIC_PREFIX.$name, 'Financial · '.$label, $type);
        }

        $types = FinancialAssessmentLineType::withoutGlobalScope(CompanyScope::class)
            ->where('company_id', $companyId)->where('is_active', true)
            ->orderBy('sort_order')->orderBy('id')->get();

        foreach ($types as $type) {
            $fields[] = $this->metric(self::METRIC_PREFIX.'total.'.$type->key, 'Financial · Total of '.$type->label, 'number');
        }

        return $fields;
    }

    /** @return array<string, mixed> */
    private function metric(string $key, string $label, string $type): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'type' => $type,
            'group' => self::GROUP,
            'writable' => false,
            'write_modes' => [],
            'max_length' => null,
            'options' => null,
        ];
    }
}
