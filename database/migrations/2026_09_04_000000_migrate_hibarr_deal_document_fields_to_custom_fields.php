<?php

use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\HibarrDealFields;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

return new class extends Migration
{
    /**
     * label => [hibarr_deal_custom_fields raw column, its resolved-URL accessor]
     *
     * The resolved URL (HibarrDealFields::getXUrlAttribute(), already
     * handling both an external URL and the legacy local/S3 path under
     * `hibarr_fields/`) is what gets copied — not the raw column — because
     * the generic custom-field file UI resolves a bare filename under
     * `custom_fields/` instead (see useDealDocuments.ts's resolveFileUrl).
     * Storing the already-resolved absolute URL sidesteps that directory
     * mismatch entirely: the frontend recognizes it as a URL and uses it as-is.
     */
    private const FIELDS = [
        'Deposit confirmation' => ['deposit_confirmation', 'deposit_confirmation_url'],
        'Reservation agreement' => ['reservation_agreement', 'reservation_agreement_url'],
        'Sales contract' => ['sales_contract', 'sales_contract_url'],
    ];

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Company::query()->pluck('id')->each(function ($companyId) {
            $group = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)
                ->where('company_id', $companyId)
                ->first();

            if (!$group) {
                Log::warning('[MigrateHibarrDealDocumentFields] No Deal custom field group for company — skipped.', [
                    'company_id' => $companyId,
                ]);

                return;
            }

            $fieldIdsByColumn = [];

            foreach (self::FIELDS as $label => [$column, $urlAccessor]) {
                // CustomFieldsObserver::creating() only sets company_id from
                // the *currently authenticated* company() — which is always
                // empty here (console, no session/user) — so it must be set
                // explicitly, per company, rather than left to that observer.
                $field = CustomField::firstOrCreate(
                    ['custom_field_group_id' => $group->id, 'label' => $label],
                    [
                        'company_id' => $companyId,
                        'name' => CustomField::generateUniqueSlug($label, $group->id),
                        'type' => 'file',
                        'required' => 'no',
                        'export' => 0,
                        'visible' => 'false',
                        'display_order' => 0,
                    ]
                );

                $fieldIdsByColumn[$column] = ['field_id' => $field->id, 'url_accessor' => $urlAccessor];
            }

            HibarrDealFields::whereHas('deal', function ($q) use ($companyId) {
                $q->where('company_id', $companyId);
            })->chunkById(200, function ($rows) use ($fieldIdsByColumn) {
                foreach ($rows as $row) {
                    foreach ($fieldIdsByColumn as $column => $meta) {
                        if (empty($row->{$column})) {
                            continue;
                        }

                        $value = $row->{$meta['url_accessor']};
                        if (empty($value)) {
                            continue;
                        }

                        $exists = DB::table('custom_fields_data')
                            ->where('model', Deal::CUSTOM_FIELD_MODEL)
                            ->where('model_id', $row->deal_id)
                            ->where('custom_field_id', $meta['field_id'])
                            ->exists();

                        if ($exists) {
                            continue;
                        }

                        DB::table('custom_fields_data')->insert([
                            'model' => Deal::CUSTOM_FIELD_MODEL,
                            'model_id' => $row->deal_id,
                            'custom_field_id' => $meta['field_id'],
                            'value' => $value,
                        ]);
                    }
                }
            });
        });
    }

    /**
     * Reverse the migrations.
     *
     * Deletes only what this migration itself would have created (matched
     * by group + label, the same lookup `up()` uses) — never touches the
     * original hibarr_deal_custom_fields columns, which this migration
     * never modifies.
     */
    public function down(): void
    {
        foreach (array_keys(self::FIELDS) as $label) {
            $fieldIds = CustomField::whereHas('fieldGroup', function ($q) {
                $q->where('model', Deal::CUSTOM_FIELD_MODEL);
            })->where('label', $label)->pluck('id');

            if ($fieldIds->isEmpty()) {
                continue;
            }

            DB::table('custom_fields_data')
                ->where('model', Deal::CUSTOM_FIELD_MODEL)
                ->whereIn('custom_field_id', $fieldIds)
                ->delete();

            CustomField::whereIn('id', $fieldIds)->delete();
        }
    }
};
