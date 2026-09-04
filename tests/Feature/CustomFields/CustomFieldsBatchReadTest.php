<?php

namespace Tests\Feature\CustomFields;

use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * Covers CustomFieldsTrait::loadCustomFieldsDataBatch() / primeCustomFieldsDataBatch()
 * — reading a deal's and its lead's (or one lead's several deals') custom
 * field values in a single query instead of one query per record.
 *
 * Lead rows here are bare in-memory instances (id set directly, never
 * persisted) rather than Lead::factory(): LeadFactory's $model property is
 * (incorrectly, pre-existing) Deal::class, so Lead::factory()->create()
 * actually inserts and returns a Deal — a separate bug, worked around here
 * rather than fixed. This is safe because the batched loader only ever
 * touches custom_fields / custom_field_groups / custom_fields_data — it
 * never joins the deals or leads tables, so a Lead instance never needs a
 * real row in `leads` for these tests, only a stable id.
 */
class CustomFieldsBatchReadTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // CustomFieldsObserver::created() unconditionally looks up 'Lead' and
        // 'Ticket' groups for every new CustomField, regardless of which
        // group it belongs to (see the sibling tests in this folder) — seed
        // them so CustomField::create() doesn't fatal on a null group.
        CustomFieldGroup::firstOrCreate(['name' => 'Lead'], ['model' => Lead::CUSTOM_FIELD_MODEL]);
        CustomFieldGroup::firstOrCreate(['name' => 'Ticket'], ['model' => 'App\\Models\\Ticket']);
    }

    private function makeLead(int $id): Lead
    {
        $lead = new Lead();
        $lead->id = $id;
        $lead->exists = true;

        return $lead;
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

    private function makeLeadField(string $label, string $name): CustomField
    {
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => Lead::CUSTOM_FIELD_MODEL],
            ['name' => 'Lead']
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

    private function insertValue(string $modelClass, int $modelId, int $fieldId, string $value): void
    {
        DB::table('custom_fields_data')->insert([
            'model' => $modelClass,
            'model_id' => $modelId,
            'custom_field_id' => $fieldId,
            'value' => $value,
        ]);
    }

    public function test_batch_read_matches_the_two_separate_chained_reads(): void
    {
        $deal = Deal::factory()->create();
        $lead = $this->makeLead(9001);

        $dealField = $this->makeDealField('Budget', 'budget');
        $leadField = $this->makeLeadField('Nationality', 'nationality');

        $this->insertValue(Deal::CUSTOM_FIELD_MODEL, $deal->id, $dealField->id, '50000');
        $this->insertValue(Lead::CUSTOM_FIELD_MODEL, $lead->id, $leadField->id, 'British');

        // Old behaviour: two separate single-record reads (one query each).
        $expectedDeal = $deal->getCustomFieldsData()->toArray();
        $expectedLead = $lead->getCustomFieldsData()->toArray();
        $deal->forgetCustomFieldValuesMemo();
        $lead->forgetCustomFieldValuesMemo();

        // New behaviour: one batched read, primed onto both instances.
        Deal::primeCustomFieldsDataBatch([$deal, $lead]);

        // assertEquals rather than assertSame: neither the old nor the new
        // query has an ORDER BY, so key order was never part of the
        // contract — only the key/value content is.
        $this->assertEquals($expectedDeal, $deal->getCustomFieldsData()->toArray());
        $this->assertEquals($expectedLead, $lead->getCustomFieldsData()->toArray());
    }

    public function test_batch_read_issues_exactly_one_query_for_the_pair(): void
    {
        $deal = Deal::factory()->create();
        $lead = $this->makeLead(9002);

        $this->makeDealField('Budget', 'budget');
        $this->makeLeadField('Nationality', 'nationality');

        DB::enableQueryLog();
        Deal::primeCustomFieldsDataBatch([$deal, $lead]);
        $queries = DB::getQueryLog();
        DB::flushQueryLog();

        $this->assertCount(
            1,
            $queries,
            'Expected exactly one query for the deal+lead pair, got: '.json_encode($queries)
        );

        // The subsequent per-instance reads are cache hits — no further queries.
        $deal->getCustomFieldsData();
        $lead->getCustomFieldsData();
        $followUpQueries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertCount(0, $followUpQueries);
    }

    public function test_unset_field_still_returns_a_null_key(): void
    {
        $deal = Deal::factory()->create();
        $field = $this->makeDealField('Preferred area', 'preferred_area');
        // Deliberately never write a custom_fields_data row for this field.

        Deal::primeCustomFieldsDataBatch([$deal]);
        $data = $deal->getCustomFieldsData();

        $this->assertArrayHasKey('field_'.$field->id, $data->toArray());
        $this->assertNull($data['field_'.$field->id]);
    }

    public function test_lead_fields_do_not_bleed_into_the_deal_map(): void
    {
        $deal = Deal::factory()->create();
        $lead = $this->makeLead(9003);

        $dealField = $this->makeDealField('Offer amount', 'offer_amount');
        $leadField = $this->makeLeadField('Passport number', 'passport_number');

        $this->insertValue(Lead::CUSTOM_FIELD_MODEL, $lead->id, $leadField->id, 'X123456');

        Deal::primeCustomFieldsDataBatch([$deal, $lead]);

        $dealData = $deal->getCustomFieldsData()->toArray();
        $leadData = $lead->getCustomFieldsData()->toArray();

        $this->assertArrayHasKey('field_'.$dealField->id, $dealData);
        $this->assertArrayNotHasKey('field_'.$leadField->id, $dealData);

        $this->assertArrayHasKey('field_'.$leadField->id, $leadData);
        $this->assertArrayNotHasKey('field_'.$dealField->id, $leadData);
    }

    public function test_batch_loader_scales_to_a_leads_whole_list_of_deals(): void
    {
        $deals = collect([
            Deal::factory()->create(),
            Deal::factory()->create(),
            Deal::factory()->create(),
        ]);

        $field = $this->makeDealField('Reservation date', 'reservation_date');

        // Only the first and third deal have a value for this field — the
        // second must still come back with a null key, not be skipped.
        $this->insertValue(Deal::CUSTOM_FIELD_MODEL, $deals[0]->id, $field->id, '2026-01-01');
        $this->insertValue(Deal::CUSTOM_FIELD_MODEL, $deals[2]->id, $field->id, '2026-03-01');

        Deal::primeCustomFieldsDataBatch($deals->all());

        $this->assertSame('2026-01-01', $deals[0]->getCustomFieldsData()['field_'.$field->id]);
        $this->assertNull($deals[1]->getCustomFieldsData()['field_'.$field->id]);
        $this->assertSame('2026-03-01', $deals[2]->getCustomFieldsData()['field_'.$field->id]);
    }

    public function test_batch_loader_returns_data_keyed_by_model_and_id(): void
    {
        $deal = Deal::factory()->create();
        $dealField = $this->makeDealField('Notary date', 'notary_date');

        $this->insertValue(Deal::CUSTOM_FIELD_MODEL, $deal->id, $dealField->id, '2026-02-14');

        $batch = Deal::loadCustomFieldsDataBatch([
            Deal::CUSTOM_FIELD_MODEL => [$deal->id],
        ]);

        $this->assertSame(
            '2026-02-14',
            $batch[Deal::CUSTOM_FIELD_MODEL][$deal->id]['field_'.$dealField->id]
        );
    }
}
