<?php

namespace Tests\Feature\CustomFields;

use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers the currency custom field's negative-value clamp added to
 * CustomFieldsTrait::updateCustomFieldData(). The frontend's CurrencyInput
 * already blocks typing/pasting a minus sign, but that's UI-only — this
 * confirms the server-side trust boundary rejects it too.
 */
class CurrencyFieldNegativeValueTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        CustomFieldGroup::firstOrCreate(['name' => 'Lead'], ['model' => 'App\\Models\\Lead']);
        CustomFieldGroup::firstOrCreate(['name' => 'Ticket'], ['model' => 'App\\Models\\Ticket']);
    }

    private function makeCurrencyField(): CustomField
    {
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => Deal::CUSTOM_FIELD_MODEL],
            ['name' => 'Deal']
        );

        return CustomField::create([
            'custom_field_group_id' => $group->id,
            'label' => 'Total budget',
            'name' => 'total_budget',
            'type' => 'currency',
            'required' => 'no',
            'export' => 1,
        ]);
    }

    public function test_negative_currency_amount_is_clamped_to_zero(): void
    {
        $deal = Deal::factory()->create();
        $field = $this->makeCurrencyField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['amount' => -500, 'currency' => 'USD'],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('model_id', $deal->id)
            ->where('custom_field_id', $field->id)
            ->value('value');

        $decoded = json_decode($stored, true);

        $this->assertSame(0.0, $decoded['amount']);
        $this->assertSame('USD', $decoded['currency']);
    }

    public function test_positive_currency_amount_is_unaffected(): void
    {
        $deal = Deal::factory()->create();
        $field = $this->makeCurrencyField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['amount' => 1250.5, 'currency' => 'USD'],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('custom_field_id', $field->id)
            ->value('value');

        $decoded = json_decode($stored, true);

        $this->assertSame(1250.5, $decoded['amount']);
    }
}
