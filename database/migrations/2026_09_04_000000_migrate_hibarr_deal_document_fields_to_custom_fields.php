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
     * Stamped into display_config on fields this migration creates, so down()
     * only ever deletes its own — never a field that already existed under
     * the same group + label before this ran.
     */
    private const OWNER_KEY = 'created_by_migration_2026_09_04_hibarr_deal_documents';

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
                        // Durable ownership marker, so down() can tell a field
                        // this migration created apart from a pre-existing one
                        // firstOrCreate() merely matched. display_config is
                        // only read for `repeatable` fields (see
                        // CustomFieldController), so it is inert on this
                        // file-typed field.
                        'display_config' => [self::OWNER_KEY => true],
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
     * `up()`'s firstOrCreate() can match a field that already existed before
     * this migration ran (same group + label) — a blanket delete-by-label
     * here would then destroy a pre-existing field and *all* of its data,
     * not just what this migration added. So each custom_fields_data row is
     * only removed if its value matches the exact URL up() would have
     * written for it, and the field itself is only removed when it carries
     * this migration's own OWNER_KEY marker — never on a label match, and
     * never because it happens to have no data left.
     */
    public function down(): void
    {
        Company::query()->pluck('id')->each(function ($companyId) {
            $group = CustomFieldGroup::where('model', Deal::CUSTOM_FIELD_MODEL)
                ->where('company_id', $companyId)
                ->first();

            if (!$group) {
                return;
            }

            foreach (self::FIELDS as $label => [$column, $urlAccessor]) {
                $field = CustomField::where('custom_field_group_id', $group->id)
                    ->where('label', $label)
                    ->first();

                if (!$field) {
                    continue;
                }

                HibarrDealFields::whereHas('deal', function ($q) use ($companyId) {
                    $q->where('company_id', $companyId);
                })->chunkById(200, function ($rows) use ($field, $column, $urlAccessor) {
                    foreach ($rows as $row) {
                        if (empty($row->{$column})) {
                            continue;
                        }

                        $value = $row->{$urlAccessor};
                        if (empty($value)) {
                            continue;
                        }

                        DB::table('custom_fields_data')
                            ->where('model', Deal::CUSTOM_FIELD_MODEL)
                            ->where('model_id', $row->deal_id)
                            ->where('custom_field_id', $field->id)
                            ->where('value', $value)
                            ->delete();
                    }
                });

                // Only a field this migration actually created is ours to
                // remove. A pre-existing field that up()'s firstOrCreate()
                // merely matched carries no marker and is always kept, with
                // whatever data it had before (the migrated values were
                // already removed above, by exact value match).
                $config = $field->display_config;
                if (is_string($config)) {
                    $config = json_decode($config, true);
                }

                if (is_array($config) && ($config[self::OWNER_KEY] ?? false)) {
                    $field->delete();
                }
            }
        });
    }
};
