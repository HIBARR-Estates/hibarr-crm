<?php

use App\Models\LanguageSetting;
use Carbon\Carbon;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const PROMOTED_SLUGS = ['language', 'nationality', 'occupation', 'date-of-birth'];

    public function up(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        if (!Schema::hasColumn('leads', 'languages')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->json('languages')->nullable()->after('date_of_birth');
            });
        }

        if (!Schema::hasColumn('leads', 'nationality')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->string('nationality')->nullable()->after('languages');
            });
        }

        if (!Schema::hasColumn('leads', 'occupation')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->string('occupation')->nullable()->after('nationality');
            });
        }

        $this->backfillFromCustomFields();
    }

    public function down(): void
    {
        if (!Schema::hasTable('leads')) {
            return;
        }

        $columns = [];

        if (Schema::hasColumn('leads', 'occupation')) {
            $columns[] = 'occupation';
        }

        if (Schema::hasColumn('leads', 'nationality')) {
            $columns[] = 'nationality';
        }

        if (Schema::hasColumn('leads', 'languages')) {
            $columns[] = 'languages';
        }

        if ($columns !== []) {
            Schema::table('leads', function (Blueprint $table) use ($columns) {
                $table->dropColumn($columns);
            });
        }
    }

    private function backfillFromCustomFields(): void
    {
        if (
            !Schema::hasTable('custom_fields')
            || !Schema::hasTable('custom_fields_data')
            || !Schema::hasTable('custom_field_groups')
        ) {
            return;
        }

        $languageLookup = $this->buildLanguageLookup();
        $fieldRows = DB::table('custom_fields')
            ->join('custom_field_groups', 'custom_fields.custom_field_group_id', '=', 'custom_field_groups.id')
            ->where('custom_field_groups.model', 'App\Models\Lead')
            ->whereIn('custom_fields.name', self::PROMOTED_SLUGS)
            ->select(
                'custom_fields.id',
                'custom_fields.name',
                'custom_fields.company_id'
            )
            ->get();

        if ($fieldRows->isEmpty()) {
            return;
        }

        $fieldsByCompany = $fieldRows->groupBy('company_id');

        foreach ($fieldsByCompany as $companyId => $fields) {
            $fieldMap = $fields->keyBy('name');

            $leadIds = DB::table('leads')
                ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
                ->pluck('id');

            foreach ($leadIds as $leadId) {
                $lead = DB::table('leads')->where('id', $leadId)->first();
                if (!$lead) {
                    continue;
                }

                $updates = [];

                if ($fieldMap->has('language') && empty($lead->languages)) {
                    $value = $this->customFieldValue($fieldMap->get('language')->id, $leadId);
                    $normalized = $this->normalizeLanguagesValue($value, $languageLookup);
                    if ($normalized !== null) {
                        $updates['languages'] = json_encode($normalized);
                    }
                }

                if ($fieldMap->has('nationality') && empty($lead->nationality)) {
                    $value = $this->customFieldValue($fieldMap->get('nationality')->id, $leadId);
                    if ($value !== null && $value !== '') {
                        $updates['nationality'] = $value;
                    }
                }

                if ($fieldMap->has('occupation') && empty($lead->occupation)) {
                    $value = $this->customFieldValue($fieldMap->get('occupation')->id, $leadId);
                    if ($value !== null && $value !== '') {
                        $updates['occupation'] = $value;
                    }
                }

                if ($fieldMap->has('date-of-birth') && empty($lead->date_of_birth)) {
                    $value = $this->customFieldValue($fieldMap->get('date-of-birth')->id, $leadId);
                    $parsed = $this->parseDateOfBirth($value, $leadId);
                    if ($parsed !== null) {
                        $updates['date_of_birth'] = $parsed;
                    }
                }

                if ($updates !== []) {
                    DB::table('leads')->where('id', $leadId)->update($updates);
                }
            }
        }
    }

    private function customFieldValue(int $fieldId, int $leadId): ?string
    {
        $row = DB::table('custom_fields_data')
            ->where('custom_field_id', $fieldId)
            ->where('model', 'App\Models\Lead')
            ->where('model_id', $leadId)
            ->value('value');

        return $row !== null ? (string) $row : null;
    }

    private function buildLanguageLookup(): array
    {
        $lookup = [];

        if (!Schema::hasTable('language_settings')) {
            return $lookup;
        }

        $languages = LanguageSetting::select('language_code', 'language_name')->get();

        foreach ($languages as $language) {
            $code = strtolower(trim($language->language_code));
            $lookup[$code] = $code;
            $lookup[strtolower(trim($language->language_name))] = $code;
        }

        return $lookup;
    }

    private function normalizeLanguagesValue(?string $value, array $languageLookup): ?array
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        $decoded = json_decode($value, true);
        $candidates = is_array($decoded) ? $decoded : preg_split('/\s*,\s*/', $value);
        $codes = [];

        foreach ($candidates as $candidate) {
            if (!is_string($candidate) && !is_numeric($candidate)) {
                continue;
            }

            $token = strtolower(trim((string) $candidate));
            if ($token === '') {
                continue;
            }

            if (isset($languageLookup[$token])) {
                $codes[] = $languageLookup[$token];
                continue;
            }

            if (preg_match('/^[a-z]{2}(-[a-z]{2})?$/', $token)) {
                $codes[] = strtok($token, '-');
            }
        }

        $codes = array_values(array_unique(array_filter($codes)));

        return $codes === [] ? null : $codes;
    }

    private function parseDateOfBirth(?string $value, int $leadId): ?string
    {
        if ($value === null || trim($value) === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable $e) {
            Log::warning('Lead core field backfill: unparseable date_of_birth', [
                'lead_id' => $leadId,
                'value' => $value,
                'error' => $e->getMessage(),
            ]);

            return null;
        }
    }
};
