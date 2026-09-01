<?php

namespace Tests\Feature\CustomFields;

use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers CustomFieldsTrait::updateCustomFieldData()'s query-storm reduction
 * (hoisted CustomField lookup, snapshot-based insert-vs-update decision,
 * reused field map for history entries) — correctness first, since a
 * regression here would silently corrupt custom field data, not just cost
 * more queries.
 *
 * Deal::factory()->create() gets an explicit company_id: DealObserver's
 * unconditional 'deal_created'/'deal_custom_field_updated' CRM event writes
 * require a non-null company_id, which only auto-fills from an authenticated
 * user — never true here. See BenchmarkCustomFieldsBatchRead for the same fix.
 */
class CustomFieldsWriteOptimizationTest extends TestCase
{
    use RefreshDatabase;

    private int $companyId;

    protected function setUp(): void
    {
        parent::setUp();

        CustomFieldGroup::firstOrCreate(['name' => 'Lead'], ['model' => 'App\\Models\\Lead']);
        CustomFieldGroup::firstOrCreate(['name' => 'Ticket'], ['model' => 'App\\Models\\Ticket']);

        $this->companyId = (int) Company::query()->value('id');
    }

    private function makeDeal(): Deal
    {
        return Deal::factory()->create(['company_id' => $this->companyId]);
    }

    private function makeDealField(string $label, string $name): CustomField
    {
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => Deal::CUSTOM_FIELD_MODEL],
            ['name' => 'Deal']
        );

        return CustomField::create([
            'custom_field_group_id' => $group->id,
            'label' => $label,
            'name' => $name,
            'type' => 'text',
            'required' => 'no',
            'export' => 0,
        ]);
    }

    public function test_writing_several_new_fields_inserts_every_one_correctly(): void
    {
        $deal = $this->makeDeal();
        $fields = collect(range(1, 5))->map(fn ($i) => $this->makeDealField("Field {$i}", "field_{$i}_".uniqid()));

        $payload = $fields->mapWithKeys(fn ($f) => ['field_'.$f->id => "value-{$f->id}"])->all();
        $deal->updateCustomFieldData($payload);

        foreach ($fields as $field) {
            $stored = DB::table('custom_fields_data')
                ->where('model', Deal::CUSTOM_FIELD_MODEL)
                ->where('model_id', $deal->id)
                ->where('custom_field_id', $field->id)
                ->value('value');

            $this->assertSame("value-{$field->id}", $stored);
        }
    }

    public function test_writing_a_mix_of_new_and_existing_fields_inserts_and_updates_correctly(): void
    {
        $deal = $this->makeDeal();
        $existingField = $this->makeDealField('Existing', 'existing_'.uniqid());
        $newField = $this->makeDealField('New', 'new_'.uniqid());

        // Seed one field with a pre-existing row; the other has none yet.
        DB::table('custom_fields_data')->insert([
            'model' => Deal::CUSTOM_FIELD_MODEL,
            'model_id' => $deal->id,
            'custom_field_id' => $existingField->id,
            'value' => 'old-value',
        ]);
        $deal->forgetCustomFieldValuesMemo();

        $deal->updateCustomFieldData([
            'field_'.$existingField->id => 'updated-value',
            'field_'.$newField->id => 'brand-new-value',
        ]);

        $rows = DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('model_id', $deal->id)
            ->whereIn('custom_field_id', [$existingField->id, $newField->id])
            ->get()
            ->keyBy('custom_field_id');

        // Exactly one row each — a wrong insert-vs-update decision would
        // either duplicate the existing row or leave the new one missing.
        $this->assertCount(2, $rows);
        $this->assertSame('updated-value', $rows[$existingField->id]->value);
        $this->assertSame('brand-new-value', $rows[$newField->id]->value);
    }

    public function test_an_unknown_field_id_still_throws_model_not_found(): void
    {
        $deal = $this->makeDeal();

        $this->expectException(ModelNotFoundException::class);

        $deal->updateCustomFieldData(['field_999999' => 'whatever']);
    }

    public function test_a_lenient_key_shape_still_resolves_to_the_right_field(): void
    {
        // The write loop accepts any key ending in _<digits> (not just the
        // strict `field_\d+` the change-tracking key list uses) — a
        // regression here would make the hoisted CustomField pre-fetch miss
        // ids the loop itself still tries to process, wrongly 404ing a
        // legitimate field. See extractCustomFieldIdFromKey()'s docblock.
        $deal = $this->makeDeal();
        $field = $this->makeDealField('Odd key', 'odd_key_'.uniqid());

        $deal->updateCustomFieldData(['some_odd_prefix_'.$field->id => 'still-works']);

        $stored = DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('model_id', $deal->id)
            ->where('custom_field_id', $field->id)
            ->value('value');

        $this->assertSame('still-works', $stored);
    }

    public function test_history_entry_builder_uses_the_provided_field_map_for_labels(): void
    {
        // Targets buildDealCustomFieldChangeEntries() directly rather than
        // through the full CRM event pipeline (unknown seeding/config
        // requirements I can't verify here) — this is the exact method that
        // switched from CustomField::find() per changed field to reading the
        // map updateCustomFieldData() already built.
        $deal = $this->makeDeal();
        $field = $this->makeDealField('Reflected field', 'reflected_'.uniqid());
        $customFieldsById = collect([$field->id => $field]);

        $method = new \ReflectionMethod($deal, 'buildDealCustomFieldChangeEntries');
        $method->setAccessible(true);

        $changes = $method->invoke(
            $deal,
            ['field_'.$field->id => 'old'],
            ['field_'.$field->id => 'new'],
            ['field_'.$field->id],
            $customFieldsById
        );

        $this->assertCount(1, $changes);
        $this->assertSame($field->id, $changes[0]['custom_field_id']);
        $this->assertSame('Reflected field', $changes[0]['field_label']);
        $this->assertSame('text', $changes[0]['field_type']);
        $this->assertSame('old', $changes[0]['old_value']);
        $this->assertSame('new', $changes[0]['new_value']);
    }

    // No query-count assertion here: for a Deal, DealActivityEventService's
    // own per-changed-field CRM-event writes (unmodified, unrelated to this
    // optimization) would dominate any total and make a threshold either
    // meaningless or flaky without actually running it to calibrate. Query
    // counts for the write path are better measured with a real DB via
    // `php artisan custom-fields:benchmark-batch-read` (read-side only
    // today; extending it to the write side would need the same treatment).
}
