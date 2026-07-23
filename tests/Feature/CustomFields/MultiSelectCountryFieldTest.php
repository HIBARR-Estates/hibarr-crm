<?php

namespace Tests\Feature\CustomFields;

use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers the multiSelectCountry custom field type: JSON-array persistence
 * (chosen over checkbox's comma-separated convention because several country
 * nicenames contain literal commas, e.g. "Congo, Democratic Republic of the"),
 * read-back, and the DataTables display formatter.
 */
class MultiSelectCountryFieldTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // CustomFieldsObserver::created() unconditionally looks up 'Lead' and
        // 'Ticket' groups for every new CustomField, regardless of which
        // group it belongs to. Seed them so CustomField::create() doesn't
        // fatal on a null group in this isolated test DB.
        CustomFieldGroup::firstOrCreate(['name' => 'Lead'], ['model' => 'App\\Models\\Lead']);
        CustomFieldGroup::firstOrCreate(['name' => 'Ticket'], ['model' => 'App\\Models\\Ticket']);
    }

    private function makeMultiSelectCountryField(bool $required = false): CustomField
    {
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => Deal::CUSTOM_FIELD_MODEL],
            ['name' => 'Deal']
        );

        return CustomField::create([
            'custom_field_group_id' => $group->id,
            'label' => 'Target Markets',
            'name' => 'target_markets',
            'type' => 'multiSelectCountry',
            'required' => $required ? 'yes' : 'no',
            'export' => 1,
        ]);
    }

    public function test_it_persists_multiple_selected_countries_as_json()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['United States', 'Canada', 'Turkey'],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('model', Deal::CUSTOM_FIELD_MODEL)
            ->where('model_id', $deal->id)
            ->where('custom_field_id', $field->id)
            ->value('value');

        $this->assertSame(json_encode(['United States', 'Canada', 'Turkey']), $stored);
    }

    public function test_it_persists_a_single_selected_country_without_error()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['Turkey'],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('custom_field_id', $field->id)
            ->value('value');

        $this->assertSame(json_encode(['Turkey']), $stored);
    }

    public function test_it_does_not_corrupt_country_names_containing_commas()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['Congo, Democratic Republic of the', 'Turkey'],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('custom_field_id', $field->id)
            ->value('value');

        $decoded = json_decode($stored, true);

        $this->assertIsArray($decoded);
        $this->assertCount(2, $decoded);
        $this->assertContains('Congo, Democratic Republic of the', $decoded);
        $this->assertContains('Turkey', $decoded);
    }

    public function test_it_returns_all_previously_selected_countries_on_read()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['United States', 'Canada'],
        ]);

        $data = $deal->getCustomFieldsData();

        $this->assertEquals(json_encode(['United States', 'Canada']), $data['field_' . $field->id]);
    }

    public function test_it_allows_removing_one_country_without_affecting_others()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => ['United States', 'Canada', 'Turkey'],
        ]);
        $deal->updateCustomFieldData([
            'field_' . $field->id => ['United States', 'Turkey'],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('custom_field_id', $field->id)
            ->value('value');

        $this->assertSame(json_encode(['United States', 'Turkey']), $stored);
    }

    public function test_it_returns_empty_array_json_when_no_countries_selected()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        $deal->updateCustomFieldData([
            'field_' . $field->id => [],
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('custom_field_id', $field->id)
            ->value('value');

        $this->assertSame(json_encode([]), $stored);
    }

    public function test_data_table_formatter_displays_comma_separated_countries()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        DB::table('custom_fields_data')->insert([
            'model' => Deal::CUSTOM_FIELD_MODEL,
            'model_id' => $deal->id,
            'custom_field_id' => $field->id,
            'value' => json_encode(['United States', 'Canada']),
        ]);

        $fakeDatatables = new class {
            public $callback;

            public function addColumn($name, $callback)
            {
                $this->callback = $callback;
            }
        };

        CustomField::customFieldData($fakeDatatables, Deal::CUSTOM_FIELD_MODEL);

        $row = (object) ['id' => $deal->id];
        $result = ($fakeDatatables->callback)($row);

        $this->assertSame('United States, Canada', $result);
    }

    public function test_data_table_formatter_returns_placeholder_when_empty()
    {
        $deal = Deal::factory()->create();
        $field = $this->makeMultiSelectCountryField();

        DB::table('custom_fields_data')->insert([
            'model' => Deal::CUSTOM_FIELD_MODEL,
            'model_id' => $deal->id,
            'custom_field_id' => $field->id,
            'value' => '',
        ]);

        $fakeDatatables = new class {
            public $callback;

            public function addColumn($name, $callback)
            {
                $this->callback = $callback;
            }
        };

        CustomField::customFieldData($fakeDatatables, Deal::CUSTOM_FIELD_MODEL);

        $row = (object) ['id' => $deal->id];
        $result = ($fakeDatatables->callback)($row);

        $this->assertSame('--', $result);
    }

    public function test_existing_single_select_country_field_is_unaffected()
    {
        $deal = Deal::factory()->create();
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => Deal::CUSTOM_FIELD_MODEL],
            ['name' => 'Deal']
        );

        $countryField = CustomField::create([
            'custom_field_group_id' => $group->id,
            'label' => 'Nationality',
            'name' => 'nationality',
            'type' => 'country',
            'required' => 'no',
        ]);

        $deal->updateCustomFieldData([
            'field_' . $countryField->id => 'Turkey',
        ]);

        $stored = DB::table('custom_fields_data')
            ->where('custom_field_id', $countryField->id)
            ->value('value');

        // Single-select country still stores a plain string, never JSON-encoded.
        $this->assertSame('Turkey', $stored);
    }
}
