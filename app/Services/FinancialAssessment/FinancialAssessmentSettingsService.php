<?php

namespace App\Services\FinancialAssessment;

use App\Enums\FinancialKindRole;
use App\Enums\FinancialLineCertainty;
use App\Enums\FinancialLineFrequency;
use App\Models\FinancialAssessmentKind;
use App\Models\FinancialAssessmentLineType;
use App\Models\FinancialCryptoAsset;
use App\Models\LeadFinancialSummary;
use App\Models\LeadSetting;
use App\Services\FinancialAssessment\Rates\CryptoRateService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * What the lead settings "Financial assessments" tab reads and writes: the
 * kinds and types of line, the crypto assets, and the company defaults.
 *
 * Nothing here deletes a kind or type. They are deactivated instead, so a
 * historic assessment can always be read; keys never change, so API mappings
 * keep working; a kind's role never changes, because totals depend on it.
 */
class FinancialAssessmentSettingsService
{
    public function __construct(
        private readonly AssessmentService $assessments,
        private readonly CryptoRateService $crypto,
    ) {}

    /** @return array<string, mixed> */
    public function payload(int $companyId): array
    {
        $kinds = FinancialAssessmentKind::withoutGlobalScopes()->where('company_id', $companyId)
            ->orderBy('sort_order')->orderBy('id')->get();
        $types = FinancialAssessmentLineType::withoutGlobalScopes()->where('company_id', $companyId)
            ->orderBy('sort_order')->orderBy('id')->get();

        $lineCounts = DB::table('financial_assessment_lines')
            ->where('company_id', $companyId)->whereNull('deleted_at')
            ->selectRaw('type_id, count(*) as aggregate')->groupBy('type_id')
            ->pluck('aggregate', 'type_id');

        $typesByKind = $types->groupBy('kind_id');

        $provider = $this->crypto->provider();

        return [
            'kinds' => $kinds->map(fn (FinancialAssessmentKind $kind) => $this->serializeKind(
                $kind,
                ($typesByKind[$kind->id] ?? collect())->map(fn (FinancialAssessmentLineType $type) => $this->serializeType($type, (int) ($lineCounts[$type->id] ?? 0)))->values()->all(),
            ))->values()->all(),
            'crypto_assets' => FinancialCryptoAsset::withoutGlobalScopes()->where('company_id', $companyId)
                ->orderBy('ticker')->get()->map(fn (FinancialCryptoAsset $asset) => $this->serializeAsset($asset))->values()->all(),
            'defaults' => [
                'reporting_currency' => $this->assessments->reportingCurrency($companyId),
                'refresh_after_days' => $this->assessments->refreshAfterDays($companyId),
                'currencies' => $this->companyCurrencies($companyId),
            ],
            'provider' => [
                'name' => $provider?->name(),
                'configured' => (bool) $provider?->isConfigured(),
            ],
            'options' => [
                'roles' => array_map(fn (FinancialKindRole $role) => $role->value, FinancialKindRole::cases()),
                'frequencies' => array_map(fn (FinancialLineFrequency $f) => $f->value, FinancialLineFrequency::cases()),
                'certainties' => array_map(fn (FinancialLineCertainty $c) => $c->value, FinancialLineCertainty::cases()),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public function createKind(int $companyId, string $label, string $role): array
    {
        $label = $this->cleanLabel($label);
        $this->validate(['role' => $role], ['role' => ['required', Rule::enum(FinancialKindRole::class)]]);

        $kind = FinancialAssessmentKind::withoutGlobalScopes()->create([
            'company_id' => $companyId,
            'key' => $this->uniqueKey('financial_assessment_kinds', $companyId, $label),
            'label' => $label,
            'role' => $role,
            'sort_order' => ((int) FinancialAssessmentKind::withoutGlobalScopes()->where('company_id', $companyId)->max('sort_order')) + 10,
            'is_active' => true,
            'is_system' => false,
        ]);

        return $this->serializeKind($kind, []);
    }

    /** @param array{label?: string, is_active?: bool} $changes */
    public function updateKind(int $companyId, int $kindId, array $changes): array
    {
        $kind = FinancialAssessmentKind::withoutGlobalScopes()->where('company_id', $companyId)->findOrFail($kindId);

        if (array_key_exists('label', $changes)) {
            $kind->label = $this->cleanLabel($changes['label']);
        }
        if (array_key_exists('is_active', $changes)) {
            $kind->is_active = (bool) $changes['is_active'];
        }
        $kind->save();

        return $this->serializeKind($kind, $kind->types()->withoutGlobalScopes()->get()->map(fn ($type) => $this->serializeType($type, $this->lineCount($type)))->all());
    }

    /** @return array<string, mixed> */
    public function createType(int $companyId, int $kindId, string $label, ?string $frequency, ?string $certainty): array
    {
        $kind = FinancialAssessmentKind::withoutGlobalScopes()->where('company_id', $companyId)->findOrFail($kindId);
        $label = $this->cleanLabel($label);
        $this->validate(
            ['frequency' => $frequency, 'certainty' => $certainty],
            [
                'frequency' => ['nullable', Rule::enum(FinancialLineFrequency::class)],
                'certainty' => ['nullable', Rule::enum(FinancialLineCertainty::class)],
            ],
        );

        $type = FinancialAssessmentLineType::withoutGlobalScopes()->create([
            'company_id' => $companyId,
            'kind_id' => $kind->id,
            'key' => $this->uniqueKey('financial_assessment_line_types', $companyId, $label),
            'label' => $label,
            'default_frequency' => $frequency ?: null,
            'default_certainty' => $certainty ?: null,
            'sort_order' => ((int) FinancialAssessmentLineType::withoutGlobalScopes()->where('company_id', $companyId)->max('sort_order')) + 10,
            'is_active' => true,
            'is_system' => false,
        ]);

        return $this->serializeType($type, 0);
    }

    /** @param array{label?: string, default_frequency?: ?string, default_certainty?: ?string, is_active?: bool} $changes */
    public function updateType(int $companyId, int $typeId, array $changes): array
    {
        $type = FinancialAssessmentLineType::withoutGlobalScopes()->where('company_id', $companyId)->findOrFail($typeId);

        $this->validate($changes, [
            'default_frequency' => ['nullable', Rule::enum(FinancialLineFrequency::class)],
            'default_certainty' => ['nullable', Rule::enum(FinancialLineCertainty::class)],
        ]);

        if (array_key_exists('label', $changes)) {
            $type->label = $this->cleanLabel($changes['label']);
        }
        if (array_key_exists('default_frequency', $changes)) {
            $type->default_frequency = $changes['default_frequency'] ?: null;
        }
        if (array_key_exists('default_certainty', $changes)) {
            $type->default_certainty = $changes['default_certainty'] ?: null;
        }
        if (array_key_exists('is_active', $changes)) {
            $type->is_active = (bool) $changes['is_active'];
        }
        $type->save();

        return $this->serializeType($type, $this->lineCount($type));
    }

    /** @return array<string, mixed> */
    public function createCryptoAsset(int $companyId, string $ticker, string $providerId, string $name): array
    {
        $ticker = strtoupper(trim($ticker));

        $this->validate(
            ['ticker' => $ticker, 'provider_id' => trim($providerId), 'name' => trim($name)],
            [
                'ticker' => [
                    'required', 'regex:/^[A-Z0-9]{2,10}$/',
                    Rule::unique('financial_crypto_assets', 'ticker')->where('company_id', $companyId),
                    // A ticker that is also a currency code would be priced as crypto instead of fiat.
                    Rule::notIn($this->companyCurrencies($companyId)),
                ],
                'provider_id' => ['required', 'string', 'max:120'],
                'name' => ['required', 'string', 'max:120'],
            ],
        );

        $asset = FinancialCryptoAsset::withoutGlobalScopes()->create([
            'company_id' => $companyId,
            'ticker' => $ticker,
            'provider_id' => trim($providerId),
            'name' => trim($name),
            'is_active' => true,
        ]);

        return $this->serializeAsset($asset);
    }

    /** @param array{provider_id?: string, name?: string, is_active?: bool} $changes */
    public function updateCryptoAsset(int $companyId, int $assetId, array $changes): array
    {
        $asset = FinancialCryptoAsset::withoutGlobalScopes()->where('company_id', $companyId)->findOrFail($assetId);

        $this->validate($changes, [
            'provider_id' => ['sometimes', 'required', 'string', 'max:120'],
            'name' => ['sometimes', 'required', 'string', 'max:120'],
        ]);

        foreach (['provider_id', 'name'] as $field) {
            if (array_key_exists($field, $changes)) {
                $asset->{$field} = trim((string) $changes[$field]);
            }
        }
        if (array_key_exists('is_active', $changes)) {
            $asset->is_active = (bool) $changes['is_active'];
        }
        $asset->save();

        return $this->serializeAsset($asset);
    }

    /** @return array{reporting_currency: string, refresh_after_days: int} */
    public function updateDefaults(int $companyId, int $userId, string $reportingCurrency, int|string $refreshAfterDays): array
    {
        $reportingCurrency = strtoupper(trim($reportingCurrency));

        $this->validate(
            ['reporting_currency' => $reportingCurrency, 'refresh_after_days' => $refreshAfterDays],
            [
                'reporting_currency' => ['required', 'regex:/^[A-Z]{3}$/', Rule::in($this->companyCurrencies($companyId)), Rule::notIn($this->crypto->activeTickers($companyId))],
                'refresh_after_days' => ['required', 'integer', 'min:7', 'max:730'],
            ],
        );
        $days = (int) $refreshAfterDays;

        $row = LeadSetting::withoutGlobalScopes()->where('company_id', $companyId)->first();
        if (! $row) {
            $row = new LeadSetting;
            $row->company_id = $companyId;
            $row->user_id = $userId;
        }
        $row->financial_reporting_currency = $reportingCurrency;
        $row->financial_refresh_after_days = $days;
        $row->save();

        // Existing summaries carry their own due date; move them to the new interval.
        LeadFinancialSummary::withoutGlobalScopes()->where('company_id', $companyId)
            ->chunkById(500, function ($summaries) use ($days) {
                foreach ($summaries as $summary) {
                    $summary->forceFill(['refresh_due_on' => $summary->as_of_date->copy()->addDays($days)->toDateString()])->save();
                }
            }, 'lead_id');

        return ['reporting_currency' => $reportingCurrency, 'refresh_after_days' => $days];
    }

    /**
     * Try one live rate so an admin can tell whether the provider key works.
     *
     * @return array{ok: bool, ticker: string|null, rate: float|null, source: string|null, currency: string, reason: string|null}
     */
    public function testRateFetch(int $companyId): array
    {
        $currency = $this->assessments->reportingCurrency($companyId);
        $base = ['ok' => false, 'ticker' => null, 'rate' => null, 'source' => null, 'currency' => $currency, 'reason' => null];

        if (! $this->crypto->isConfigured()) {
            return ['reason' => 'no_api_key'] + $base;
        }

        $ticker = $this->crypto->activeTickers($companyId)[0] ?? null;
        if ($ticker === null) {
            return ['reason' => 'no_assets'] + $base;
        }

        $quote = $this->crypto->quotes($companyId, [$ticker], $currency)[$ticker] ?? null;

        return $quote === null
            ? ['ticker' => $ticker, 'reason' => 'no_rate'] + $base
            : ['ok' => true, 'ticker' => $ticker, 'rate' => $quote->rate, 'source' => $quote->source, 'reason' => null] + $base;
    }

    // ------------------------------------------------------------------ helpers

    /** @return list<string> */
    private function companyCurrencies(int $companyId): array
    {
        // Fiat only: the app's currency list can also hold cryptocurrencies, which are not reporting currencies.
        $codes = DB::table('currencies')->where('company_id', $companyId)->where('is_cryptocurrency', '!=', 'yes')->pluck('currency_code')
            ->map(fn ($code) => strtoupper((string) $code));

        $codes->push($this->assessments->reportingCurrency($companyId));

        return $codes->unique()->sort()->values()->all();
    }

    private function cleanLabel(string $label): string
    {
        $label = trim(preg_replace('/\s+/', ' ', $label) ?? '');

        $this->validate(['label' => $label], ['label' => ['required', 'string', 'max:120']]);

        return $label;
    }

    private function uniqueKey(string $table, int $companyId, string $label): string
    {
        $base = Str::slug($label, '_') ?: 'item';
        $base = mb_substr($base, 0, 56);
        $key = $base;
        $suffix = 2;

        while (DB::table($table)->where('company_id', $companyId)->where('key', $key)->exists()) {
            $key = $base.'_'.$suffix++;
        }

        return $key;
    }

    private function lineCount(FinancialAssessmentLineType $type): int
    {
        return (int) DB::table('financial_assessment_lines')->where('type_id', $type->id)->whereNull('deleted_at')->count();
    }

    /** @param array<string, mixed> $data @param array<string, mixed> $rules */
    private function validate(array $data, array $rules): void
    {
        $validator = validator($data, $rules);

        if ($validator->fails()) {
            throw new ValidationException($validator);
        }
    }

    /** @param list<array<string, mixed>> $types */
    private function serializeKind(FinancialAssessmentKind $kind, array $types): array
    {
        return [
            'id' => (int) $kind->id,
            'key' => $kind->key,
            'label' => $kind->label,
            'role' => $kind->role->value,
            'sort_order' => (int) $kind->sort_order,
            'is_active' => (bool) $kind->is_active,
            'is_system' => (bool) $kind->is_system,
            'types' => $types,
        ];
    }

    private function serializeType(FinancialAssessmentLineType $type, int $lineCount): array
    {
        return [
            'id' => (int) $type->id,
            'kind_id' => (int) $type->kind_id,
            'key' => $type->key,
            'label' => $type->label,
            'default_frequency' => $type->default_frequency?->value,
            'default_certainty' => $type->default_certainty?->value,
            'sort_order' => (int) $type->sort_order,
            'is_active' => (bool) $type->is_active,
            'is_system' => (bool) $type->is_system,
            'line_count' => $lineCount,
        ];
    }

    private function serializeAsset(FinancialCryptoAsset $asset): array
    {
        return [
            'id' => (int) $asset->id,
            'ticker' => $asset->ticker,
            'provider_id' => $asset->provider_id,
            'name' => $asset->name,
            'is_active' => (bool) $asset->is_active,
        ];
    }
}
