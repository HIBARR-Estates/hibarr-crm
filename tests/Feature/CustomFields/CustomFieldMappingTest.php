<?php

namespace Tests\Feature\CustomFields;

use App\Models\Company;
use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\Deal;
use App\Models\Lead;
use App\Services\CustomFieldMapping\CustomFieldMappingService;
use App\Services\CustomFieldMapping\InvalidMappingException;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

/**
 * CustomFieldMappingService: copy values between custom fields and into
 * built-in lead/deal fields, with dry-run, conflict and delete handling.
 */
class CustomFieldMappingTest extends TestCase
{
    use RefreshDatabase;

    private int $companyId;
    private CustomFieldMappingService $service;

    protected function setUp(): void
    {
        parent::setUp();

        // CustomFieldsObserver dereferences the Lead and Ticket groups on every
        // field create/update, so both must exist (same as the sibling tests).
        CustomFieldGroup::firstOrCreate(['name' => 'Lead'], ['model' => Lead::CUSTOM_FIELD_MODEL]);
        CustomFieldGroup::firstOrCreate(['name' => 'Ticket'], ['model' => 'App\\Models\\Ticket']);
        CustomFieldGroup::firstOrCreate(['name' => 'Deal'], ['model' => Deal::CUSTOM_FIELD_MODEL]);

        $company = new Company;
        $company->company_name = 'Mapping Co';
        $company->company_email = 'mapping@example.com';
        $company->company_phone = '0000000000';
        $company->address = 'Test address';
        $company->save();
        $this->companyId = $company->id;

        $this->service = app(CustomFieldMappingService::class);
    }

    private function field(string $model, string $label, string $type = 'text', ?array $options = null): CustomField
    {
        $group = CustomFieldGroup::firstOrCreate(
            ['model' => $model],
            ['name' => class_basename($model)],
        );

        return CustomField::create([
            'custom_field_group_id' => $group->id,
            'company_id' => $this->companyId,
            'label' => $label,
            'name' => str($label)->slug('_').'_'.uniqid(),
            'type' => $type,
            'required' => 'no',
            'export' => 0,
            'values' => $options === null ? null : json_encode($options),
        ]);
    }

    private function lead(array $attrs = []): Lead
    {
        $lead = new Lead;
        $lead->forceFill(array_merge(['company_id' => $this->companyId, 'client_name' => 'Test Lead'], $attrs));
        $lead->save();

        return $lead;
    }

    private function deal(Lead $lead): Deal
    {
        return Deal::factory()->create(['company_id' => $this->companyId, 'lead_id' => $lead->id]);
    }

    private function put(CustomField $field, string $model, int $id, string $value): void
    {
        DB::table('custom_fields_data')->insert([
            'custom_field_id' => $field->id, 'model' => $model, 'model_id' => $id, 'value' => $value,
        ]);
    }

    private function read(CustomField $field, string $model, int $id): ?string
    {
        return DB::table('custom_fields_data')
            ->where(['custom_field_id' => $field->id, 'model' => $model, 'model_id' => $id])
            ->value('value');
    }

    private function request(CustomField $source, CustomField $target, array $extra = []): array
    {
        return ['source_id' => $source->id, 'target_type' => 'custom', 'target_id' => $target->id] + $extra;
    }

    public function test_dry_run_reports_but_writes_nothing(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Old');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'New');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'hello');

        $report = $this->service->run($this->request($source, $target), dryRun: true);

        $this->assertSame(1, $report['mapped']);
        $this->assertNull($this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));
    }

    public function test_copies_between_custom_fields_and_keeps_source(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Old');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'New');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'hello');

        $report = $this->service->run($this->request($source, $target), dryRun: false);

        $this->assertSame(1, $report['mapped']);
        $this->assertSame('hello', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));
        $this->assertSame('hello', $this->read($source, Lead::CUSTOM_FIELD_MODEL, $lead->id));
    }

    public function test_existing_target_value_is_kept_unless_overwrite(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Old');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'New');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'from-source');
        $this->put($target, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'already-here');

        $kept = $this->service->run($this->request($source, $target), dryRun: false);
        $this->assertSame(1, $kept['skipped_conflict']);
        $this->assertSame('already-here', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));

        $this->service->run($this->request($source, $target, ['conflict' => 'overwrite']), dryRun: false);
        $this->assertSame('from-source', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));
    }

    public function test_select_values_map_by_label_and_missing_options_can_be_added(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Budget', 'select', ['Low', 'High']);
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Budget v2', 'select', ['low']);
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, '1'); // legacy index => "High"

        $refused = $this->service->run($this->request($source, $target), dryRun: false);
        $this->assertSame(1, $refused['skipped_incompatible']);

        $report = $this->service->run($this->request($source, $target, ['add_missing_options' => true]), dryRun: false);

        $this->assertSame(1, $report['mapped']);
        $this->assertSame('High', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));
        $this->assertSame(['low', 'High'], json_decode($target->fresh()->values, true));
    }

    public function test_custom_field_maps_into_defined_lead_field_and_rejects_bad_values(): void
    {
        $good = $this->lead();
        $bad = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Years');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $good->id, '42');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $bad->id, 'forty-ish');

        $report = $this->service->run(
            ['source_id' => $source->id, 'target_type' => 'defined', 'target_key' => 'lead.age'],
            dryRun: false,
        );

        $this->assertSame(1, $report['mapped']);
        $this->assertSame(1, $report['skipped_incompatible']);
        $this->assertSame(42, (int) DB::table('leads')->where('id', $good->id)->value('age'));
        $this->assertNull(DB::table('leads')->where('id', $bad->id)->value('age'));
    }

    public function test_deleting_the_source_is_refused_while_values_would_be_lost(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Years');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'forty-ish');
        $request = ['source_id' => $source->id, 'target_type' => 'defined', 'target_key' => 'lead.age', 'delete_source_field' => true];

        try {
            $this->service->run($request, dryRun: false);
            $this->fail('Expected the delete to be refused.');
        } catch (InvalidMappingException) {
            $this->assertNotNull(CustomField::find($source->id), 'Source field must survive a refused delete.');
        }

        $report = $this->service->run($request + ['allow_loss' => true], dryRun: false);

        $this->assertTrue($report['deleted_field']);
        $this->assertNull(CustomField::find($source->id));
    }

    public function test_migrate_and_delete_field_removes_source_after_a_clean_copy(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Old');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'New');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'keep-me');

        $this->service->run($this->request($source, $target, ['delete_source_field' => true]), dryRun: false);

        $this->assertNull(CustomField::find($source->id));
        $this->assertSame('keep-me', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));
    }

    public function test_lead_value_reaches_every_deal_of_the_lead(): void
    {
        $lead = $this->lead();
        $dealA = $this->deal($lead);
        $dealB = $this->deal($lead);
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Lead note');
        $target = $this->field(Deal::CUSTOM_FIELD_MODEL, 'Deal note');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'shared');

        $this->service->run($this->request($source, $target), dryRun: false);

        $this->assertSame('shared', $this->read($target, Deal::CUSTOM_FIELD_MODEL, $dealA->id));
        $this->assertSame('shared', $this->read($target, Deal::CUSTOM_FIELD_MODEL, $dealB->id));
    }

    public function test_lead_takes_value_from_its_newest_deal(): void
    {
        $lead = $this->lead();
        $older = $this->deal($lead);
        $newer = $this->deal($lead);
        $source = $this->field(Deal::CUSTOM_FIELD_MODEL, 'Deal note');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Lead note');
        $this->put($source, Deal::CUSTOM_FIELD_MODEL, $older->id, 'old');
        $this->put($source, Deal::CUSTOM_FIELD_MODEL, $newer->id, 'new');

        $report = $this->service->run($this->request($source, $target), dryRun: false);

        $this->assertSame('new', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $lead->id));
        $this->assertSame(1, $report['superseded']);
    }

    public function test_custom_field_maps_into_defined_deal_field_creating_the_row(): void
    {
        $deal = $this->deal($this->lead());
        $source = $this->field(Deal::CUSTOM_FIELD_MODEL, 'Why');
        $this->put($source, Deal::CUSTOM_FIELD_MODEL, $deal->id, 'Investment');

        $this->service->run(
            ['source_id' => $source->id, 'target_type' => 'defined', 'target_key' => 'deal.motivation'],
            dryRun: false,
        );

        $this->assertSame('Investment', DB::table('hibarr_deal_custom_fields')->where('deal_id', $deal->id)->value('motivation'));
    }

    public function test_incompatible_field_types_are_rejected_up_front(): void
    {
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Doc', 'file');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Text');

        $this->expectException(InvalidMappingException::class);
        $this->service->run($this->request($source, $target), dryRun: true);
    }

    public function test_locked_deals_are_not_written_and_block_deleting_the_source(): void
    {
        $lead = $this->lead();
        $open = $this->deal($lead);
        $locked = $this->deal($lead);
        DB::table('deals')->where('id', $locked->id)->update(['is_locked' => true]);
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Lead note');
        $target = $this->field(Deal::CUSTOM_FIELD_MODEL, 'Deal note');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, 'shared');

        $report = $this->service->run($this->request($source, $target), dryRun: false);

        $this->assertSame('shared', $this->read($target, Deal::CUSTOM_FIELD_MODEL, $open->id));
        $this->assertNull($this->read($target, Deal::CUSTOM_FIELD_MODEL, $locked->id));
        $this->assertSame(1, $report['skipped_locked']);

        $this->expectException(InvalidMappingException::class);
        $this->service->run($this->request($source, $target, ['delete_source_field' => true]), dryRun: false);
    }

    public function test_text_to_number_treats_comma_groups_as_thousands_and_rejects_prose(): void
    {
        $a = $this->lead();
        $b = $this->lead();
        $c = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Raw');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Amount', 'number');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $a->id, '1,234');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $b->id, '12,5');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $c->id, 'about ten');

        $report = $this->service->run($this->request($source, $target), dryRun: false);

        $this->assertSame('1234', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $a->id));
        $this->assertSame('12.5', $this->read($target, Lead::CUSTOM_FIELD_MODEL, $b->id));
        $this->assertNull($this->read($target, Lead::CUSTOM_FIELD_MODEL, $c->id));
        $this->assertSame(1, $report['skipped_incompatible']);
    }

    public function test_free_text_is_not_turned_into_a_date(): void
    {
        $good = $this->lead();
        $bad = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Raw date');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $good->id, '01.05.1990');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $bad->id, 'next friday');

        $report = $this->service->run(
            ['source_id' => $source->id, 'target_type' => 'defined', 'target_key' => 'lead.date_of_birth'],
            dryRun: false,
        );

        $this->assertSame(1, $report['mapped']);
        $this->assertSame(1, $report['skipped_incompatible']);
        $this->assertSame('1990-05-01', substr((string) DB::table('leads')->where('id', $good->id)->value('date_of_birth'), 0, 10));
    }

    public function test_age_outside_the_allowed_range_is_rejected(): void
    {
        $lead = $this->lead();
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Years');
        $this->put($source, Lead::CUSTOM_FIELD_MODEL, $lead->id, '900');

        $report = $this->service->run(
            ['source_id' => $source->id, 'target_type' => 'defined', 'target_key' => 'lead.age'],
            dryRun: false,
        );

        $this->assertSame(1, $report['skipped_incompatible']);
        $this->assertNull(DB::table('leads')->where('id', $lead->id)->value('age'));
    }

    public function test_text_cannot_be_mapped_into_a_country_field(): void
    {
        $source = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Where');
        $target = $this->field(Lead::CUSTOM_FIELD_MODEL, 'Country', 'country');

        $this->expectException(InvalidMappingException::class);
        $this->service->run($this->request($source, $target), dryRun: true);
    }
}
