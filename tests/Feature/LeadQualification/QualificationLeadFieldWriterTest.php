<?php

namespace Tests\Feature\LeadQualification;

use App\Models\Lead;
use App\Models\LeadQualification;
use App\Models\QualificationFieldMapping;
use App\Models\QualificationScriptSetting;
use App\Services\Qualification\QualificationLeadFieldWriter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\LeadQualificationTestCase;

class QualificationLeadFieldWriterTest extends LeadQualificationTestCase
{
    private QualificationLeadFieldWriter $writer;

    protected function setUp(): void
    {
        parent::setUp();
        $this->actingAsSessionUser();

        Schema::table('leads', function (Blueprint $table) {
            $table->string('city')->nullable();
            $table->string('occupation')->nullable();
            $table->unsignedInteger('category_id')->nullable();
        });

        Schema::create('lead_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('category_name');
            $table->timestamps();
        });

        Schema::create('lead_lead_category', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id');
            $table->unsignedInteger('lead_category_id');
            $table->timestamps();
        });

        Schema::create('custom_field_groups', function (Blueprint $table) {
            $table->increments('id');
            $table->string('model')->nullable();
        });

        Schema::create('custom_fields', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('custom_field_group_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->string('label')->nullable();
            $table->string('name')->nullable();
            $table->string('type')->nullable();
            $table->text('values')->nullable();
        });

        $this->writer = app(QualificationLeadFieldWriter::class);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('custom_fields');
        Schema::dropIfExists('custom_field_groups');
        Schema::dropIfExists('lead_lead_category');
        Schema::dropIfExists('lead_category');
        parent::tearDown();
    }

    public function test_option_map_translates_the_answer_into_the_lead_field(): void
    {
        $this->createMappingSchema();
        $this->mapping('q_city', 'city', QualificationFieldMapping::MODE_FILL_EMPTY, [
            'opt_north' => 'Kyrenia',
        ]);

        $qualification = $this->qualificationWithAnswers([
            ['segment_key' => 'q_city', 'answer_values' => ['opt_north'], 'answer_text' => 'up north somewhere'],
        ]);

        $written = $this->writer->apply($qualification, $this->lead());

        $this->assertSame(['city'], $written);
        $this->assertSame('Kyrenia', $this->lead()->city);
    }

    public function test_unmapped_answer_falls_back_to_the_free_text(): void
    {
        $this->createMappingSchema();
        $this->mapping('q_job', 'occupation');

        $qualification = $this->qualificationWithAnswers([
            ['segment_key' => 'q_job', 'answer_values' => [], 'answer_text' => 'Architect'],
        ]);

        $this->writer->apply($qualification, $this->lead());

        $this->assertSame('Architect', $this->lead()->occupation);
    }

    public function test_fill_empty_leaves_an_existing_value_alone_but_overwrite_replaces_it(): void
    {
        $this->createMappingSchema();
        DB::table('leads')->where('id', $this->leadId)->update(['city' => 'Berlin']);

        $this->mapping('q_city', 'city', QualificationFieldMapping::MODE_FILL_EMPTY);
        $qualification = $this->qualificationWithAnswers([
            ['segment_key' => 'q_city', 'answer_values' => [], 'answer_text' => 'Nicosia'],
        ]);

        $this->assertSame([], $this->writer->apply($qualification, $this->lead()));
        $this->assertSame('Berlin', $this->lead()->city);

        QualificationFieldMapping::query()->update(['write_mode' => QualificationFieldMapping::MODE_OVERWRITE]);

        $this->assertSame(['city'], $this->writer->apply($qualification, $this->lead()));
        $this->assertSame('Nicosia', $this->lead()->city);
    }

    public function test_nothing_is_written_when_auto_write_is_off(): void
    {
        $this->createMappingSchema(autoWrite: false);
        $this->mapping('q_city', 'city', QualificationFieldMapping::MODE_OVERWRITE);

        $qualification = $this->qualificationWithAnswers([
            ['segment_key' => 'q_city', 'answer_values' => [], 'answer_text' => 'Nicosia'],
        ]);

        $this->assertSame([], $this->writer->apply($qualification, $this->lead()));
        $this->assertNull($this->lead()->city);
    }

    public function test_category_option_map_syncs_the_lead_category(): void
    {
        $this->createMappingSchema();
        $categoryId = DB::table('lead_category')->insertGetId([
            'company_id' => $this->companyId,
            'category_name' => 'Investor',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->mapping('q_type', 'category', QualificationFieldMapping::MODE_FILL_EMPTY, [
            'opt_investor' => (string) $categoryId,
        ]);

        $qualification = $this->qualificationWithAnswers([
            ['segment_key' => 'q_type', 'answer_values' => ['opt_investor'], 'answer_text' => null],
        ]);

        $written = $this->writer->apply($qualification, $this->lead());

        $this->assertSame(['category'], $written);
        $this->assertSame($categoryId, (int) $this->lead()->category_id);
        $this->assertTrue(
            DB::table('lead_lead_category')
                ->where('lead_id', $this->leadId)
                ->where('lead_category_id', $categoryId)
                ->exists()
        );
    }

    public function test_category_free_text_resolves_by_name(): void
    {
        $this->createMappingSchema();
        $categoryId = DB::table('lead_category')->insertGetId([
            'company_id' => $this->companyId,
            'category_name' => 'End User',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->mapping('q_type', 'category', QualificationFieldMapping::MODE_OVERWRITE);

        $qualification = $this->qualificationWithAnswers([
            ['segment_key' => 'q_type', 'answer_values' => [], 'answer_text' => 'end user'],
        ]);

        $this->writer->apply($qualification, $this->lead());

        $this->assertSame($categoryId, (int) $this->lead()->category_id);
    }

    private function createMappingSchema(bool $autoWrite = true): void
    {
        QualificationScriptSetting::withoutGlobalScopes()->create([
            'company_id' => $this->companyId,
            'template_id' => '3',
            'template_name' => 'Test Script',
            'auto_write' => $autoWrite,
        ]);
    }

    /** @param  array<string, string>  $optionMap */
    private function mapping(
        string $segmentKey,
        string $leadField,
        string $mode = QualificationFieldMapping::MODE_FILL_EMPTY,
        array $optionMap = []
    ): void {
        QualificationFieldMapping::create([
            'script_setting_id' => QualificationScriptSetting::withoutGlobalScopes()->first()->id,
            'segment_key' => $segmentKey,
            'lead_field' => $leadField,
            'write_mode' => $mode,
            'option_map' => $optionMap,
        ]);
    }

    /** @param  list<array{segment_key: string, answer_values: list<string>, answer_text: ?string}>  $answers */
    private function qualificationWithAnswers(array $answers): LeadQualification
    {
        $qualification = LeadQualification::withoutGlobalScopes()->create([
            'company_id' => $this->companyId,
            'lead_id' => $this->leadId,
            'template_id' => '3',
            'template_version' => 1,
            'agent_id' => $this->userId,
            'started_at' => now(),
        ]);

        foreach ($answers as $answer) {
            $qualification->answers()->create($answer);
        }

        return $qualification->load('answers');
    }

    private function lead(): Lead
    {
        return Lead::withoutGlobalScopes()->find($this->leadId);
    }
}
