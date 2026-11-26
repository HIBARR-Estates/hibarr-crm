<?php

namespace Tests\Feature\LeadFields;

use App\Models\Lead;
use App\Services\LeadFieldCatalog;
use App\Services\LeadFieldWriter;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Tests\LeadCoreFieldsTestCase;

class LeadFieldCatalogAndWriterTest extends LeadCoreFieldsTestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Cache::flush();
        Schema::dropIfExists('leads');
        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->text('hash')->nullable();
            $table->string('mobile', 20)->nullable();
            $table->text('note')->nullable();
            $table->string('occupation')->nullable();
            $table->integer('age')->nullable();
            $table->double('total_value')->nullable();
            $table->date('date_of_birth')->nullable();
            $table->string('salutation')->nullable();
            $table->json('languages')->nullable();
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('leads');
        Cache::flush();
        parent::tearDown();
    }

    private function lead(array $attributes = []): Lead
    {
        $lead = new Lead;
        $lead->forceFill(array_merge(['client_name' => 'Jane', 'client_email' => 'jane@example.com'], $attributes));
        $lead->saveQuietly();

        return $lead->fresh();
    }

    private function writer(): LeadFieldWriter
    {
        return app(LeadFieldWriter::class);
    }

    public function test_catalog_lists_writable_columns_and_hides_system_ones(): void
    {
        $keys = array_column(app(LeadFieldCatalog::class)->all(), 'key');

        $this->assertContains('note', $keys);
        $this->assertContains('occupation', $keys);
        $this->assertContains('age', $keys);
        $this->assertContains('total_value', $keys);
        $this->assertContains('date_of_birth', $keys);

        foreach (['id', 'company_id', 'agent_id', 'added_by', 'client_email', 'hash', 'created_at', 'updated_at', 'languages'] as $hidden) {
            $this->assertNotContains($hidden, $keys, "$hidden must not be offered");
        }
    }

    public function test_catalog_reports_type_label_and_the_modes_each_type_supports(): void
    {
        $byKey = app(LeadFieldCatalog::class)->byKey();

        $this->assertSame('text', $byKey['note']['type']);
        $this->assertSame(['fill', 'overwrite', 'append'], $byKey['note']['write_modes']);
        $this->assertSame('Note', $byKey['note']['label']);

        $this->assertSame('string', $byKey['occupation']['type']);
        $this->assertSame(['fill', 'overwrite'], $byKey['occupation']['write_modes']);
        $this->assertSame('Occupation', $byKey['occupation']['label']);

        $this->assertSame('integer', $byKey['age']['type']);
        $this->assertSame('date', $byKey['date_of_birth']['type']);
        // Column lengths are only reported by MySQL-class drivers (SQLite has none), so the length rule is
        // tested separately with a fixed catalog.
        $this->assertSame('string', $byKey['mobile']['type']);
    }

    /**
     * @dataProvider columnTypes
     */
    public function test_database_column_types_are_parsed(string $declared, string $type, ?int $length, ?array $enum): void
    {
        $this->assertSame(
            ['type' => $type, 'length' => $length, 'enum' => $enum],
            LeadFieldCatalog::parseColumnType($declared)
        );
    }

    public static function columnTypes(): array
    {
        return [
            'varchar' => ['varchar(255)', 'varchar', 255, null],
            'int unsigned' => ['int(10) unsigned', 'int', 10, null],
            'bigint' => ['bigint unsigned', 'bigint', null, null],
            'decimal' => ['decimal(10,2)', 'decimal', null, null],
            'tinyint bool' => ['tinyint(1)', 'tinyint', 1, null],
            'long text' => ['longtext', 'longtext', null, null],
            'json' => ['json', 'json', null, null],
            'enum' => ["enum('male','female','others')", 'enum', null, ['male', 'female', 'others']],
            'enum with a comma' => ["enum('a, b','c')", 'enum', null, ['a, b', 'c']],
        ];
    }

    public function test_a_column_added_later_shows_up_without_code_changes(): void
    {
        $catalog = app(LeadFieldCatalog::class);
        $this->assertNull($catalog->find('investment_goal'));

        Schema::table('leads', function (Blueprint $table) {
            $table->text('investment_goal')->nullable();
        });
        $catalog->forget();

        $field = $catalog->find('investment_goal');
        $this->assertNotNull($field);
        $this->assertSame('Investment Goal', $field['label']);
        $this->assertSame('text', $field['type']);
    }

    public function test_fill_writes_only_when_the_lead_has_no_value(): void
    {
        $empty = $this->lead();
        $result = $this->writer()->apply($empty, ['occupation' => 'Engineer']);
        $this->assertTrue($result['changed']);
        $this->assertSame('Engineer', $empty->occupation);

        $filled = $this->lead(['client_email' => 'other@example.com', 'occupation' => 'Doctor']);
        $result = $this->writer()->apply($filled, ['occupation' => 'Engineer']);
        $this->assertFalse($result['changed']);
        $this->assertSame('Doctor', $filled->occupation);
    }

    public function test_overwrite_replaces_a_different_value_and_ignores_an_identical_one(): void
    {
        $lead = $this->lead(['occupation' => 'Doctor']);

        $same = $this->writer()->apply($lead, ['occupation' => ['value' => 'Doctor', 'mode' => 'overwrite']]);
        $this->assertFalse($same['changed']);

        $different = $this->writer()->apply($lead, ['occupation' => ['value' => 'Engineer', 'mode' => 'overwrite']]);
        $this->assertTrue($different['changed']);
        $this->assertSame('Engineer', $lead->occupation);
    }

    public function test_append_adds_a_line_once_and_keeps_existing_text(): void
    {
        $lead = $this->lead(['note' => 'Called on Monday']);
        $line = 'Available liquidity: EUR 100,000 – 250,000';

        $first = $this->writer()->apply($lead, ['note' => ['value' => $line, 'mode' => 'append']]);
        $this->assertTrue($first['changed']);
        $this->assertSame("Called on Monday\n$line", $lead->note);

        $again = $this->writer()->apply($lead, ['note' => ['value' => $line, 'mode' => 'append']]);
        $this->assertFalse($again['changed']);
        $this->assertSame("Called on Monday\n$line", $lead->note);
    }

    public function test_append_on_an_empty_note_just_sets_it(): void
    {
        $lead = $this->lead();
        $this->writer()->apply($lead, ['note' => ['value' => 'Hello', 'mode' => 'append']]);
        $this->assertSame('Hello', $lead->note);
    }

    public function test_unavailable_fields_wrong_modes_and_bad_values_are_skipped_not_errors(): void
    {
        $lead = $this->lead();

        $result = $this->writer()->apply($lead, [
            'client_email' => 'attacker@example.com',   // blocked
            'no_such_column' => 'x',                     // unknown (e.g. dropped from the CRM)
            'occupation' => ['value' => 'x', 'mode' => 'append'], // append is for long text only
            'age' => 'not a number',
            'date_of_birth' => 'not a date',
        ]);

        $this->assertFalse($result['changed']);
        $this->assertSame([
            'client_email' => 'not_available',
            'no_such_column' => 'not_available',
            'occupation' => 'mode_not_supported',
            'age' => 'invalid_value',
            'date_of_birth' => 'invalid_value',
        ], $result['skipped']);
        $this->assertSame('jane@example.com', $lead->client_email);
    }

    public function test_a_value_longer_than_the_column_is_skipped(): void
    {
        $catalog = new class extends LeadFieldCatalog
        {
            public function all(): array
            {
                return [[
                    'key' => 'mobile', 'label' => 'Phone', 'type' => 'string', 'group' => 'lead', 'writable' => true,
                    'write_modes' => ['fill', 'overwrite'], 'max_length' => 5, 'options' => null,
                ]];
            }
        };
        $lead = $this->lead();

        $result = (new LeadFieldWriter($catalog))->apply($lead, ['mobile' => '1234567890']);

        $this->assertFalse($result['changed']);
        $this->assertSame(['mobile' => 'too_long'], $result['skipped']);
        $this->assertNull($lead->mobile);
    }

    public function test_typed_values_are_coerced(): void
    {
        $lead = $this->lead();

        $this->writer()->apply($lead, ['age' => '42', 'total_value' => '250000.5', 'date_of_birth' => '1984-03-09']);

        $this->assertSame(42, (int) $lead->age);
        $this->assertSame(250000.5, (float) $lead->total_value);
        $this->assertSame('1984-03-09', $lead->date_of_birth->format('Y-m-d'));
    }

    public function test_empty_values_are_ignored_quietly(): void
    {
        $lead = $this->lead();
        $result = $this->writer()->apply($lead, ['occupation' => '  ', 'note' => null]);

        $this->assertFalse($result['changed']);
        $this->assertSame([], $result['skipped']);
    }
}
