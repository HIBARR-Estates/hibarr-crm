<?php

namespace Tests\Feature;

use App\Imports\LeadImport;
use App\Jobs\ImportLeadJob;
use App\Models\Company;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\LeadNote;
use App\Services\CrmEventService;
use Illuminate\Contracts\Queue\Job as QueueJobContract;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

class ImportLeadJobNotesTest extends TestCase
{
    protected int $companyId = 1;

    protected int $userId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->assertSame('sqlite', Config::get('database.default'));
        $this->assertSame(':memory:', Config::get('database.connections.sqlite.database'));

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedBaseData();

        Lead::flushEventListeners();
        Deal::flushEventListeners();
        LeadNote::flushEventListeners();

        $this->mock(CrmEventService::class, function ($mock) {
            $mock->shouldReceive('record')->andReturn(null)->byDefault();
            $mock->shouldReceive('startCorrelation')->andReturn('test-correlation')->byDefault();
        });
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    protected function resetSchema(): void
    {
        Schema::dropIfExists('universal_search');
        Schema::dropIfExists('lead_notes');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('pipeline_stages');
        Schema::dropIfExists('lead_pipelines');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('client_contacts');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
    }

    protected function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->unsignedInteger('is_client_contact')->nullable();
            $table->timestamps();
        });

        Schema::create('client_contacts', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->unsignedInteger('user_id')->nullable();
            $table->text('payload')->nullable();
            $table->integer('last_activity')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name')->nullable();
            $table->string('client_email')->nullable();
            $table->string('salutation')->nullable();
            $table->string('gender')->nullable();
            $table->text('note')->nullable();
            $table->string('company_name')->nullable();
            $table->string('website')->nullable();
            $table->string('mobile')->nullable();
            $table->string('office')->nullable();
            $table->string('country')->nullable();
            $table->string('state')->nullable();
            $table->string('city')->nullable();
            $table->string('postal_code')->nullable();
            $table->text('address')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->unsignedBigInteger('lead_lifecycle_status_id')->nullable();
            $table->string('hash')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->integer('default')->default(0);
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->string('name')->nullable();
            $table->integer('default')->default(0);
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('name')->nullable();
            $table->unsignedInteger('lead_pipeline_id')->nullable();
            $table->unsignedInteger('pipeline_stage_id')->nullable();
            $table->decimal('value', 15, 2)->nullable();
            $table->unsignedInteger('currency_id')->nullable();
            $table->string('hash')->nullable();
            $table->string('next_follow_up')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_notes', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->string('title')->nullable();
            $table->boolean('type')->default(0);
            $table->text('details')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->timestamps();
        });

        Schema::create('universal_search', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('searchable_id')->nullable();
            $table->string('title')->nullable();
            $table->string('route_name')->nullable();
            $table->string('module_type')->nullable();
            $table->timestamps();
        });
    }

    protected function seedBaseData(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'currency_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('users')->insert([
            'id' => $this->userId,
            'company_id' => $this->companyId,
            'name' => 'Importer',
            'email' => 'importer@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('lead_pipelines')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'name' => 'Default',
            'default' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('pipeline_stages')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'lead_pipeline_id' => 1,
            'name' => 'New',
            'default' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    protected function actingAsImporter(): Company
    {
        $company = Company::withoutGlobalScopes()->find($this->companyId);

        // Avoid User::$with (session / clientContact). company() reads session('company') first.
        session([
            'user' => (object) ['id' => $this->userId, 'company_id' => $this->companyId],
            'company' => $company,
        ]);

        return $company;
    }

    /**
     * @param  array<int, string|null>  $columns
     * @param  array<int, mixed>  $row
     */
    protected function runImport(array $columns, array $row): ImportLeadJob
    {
        $company = $this->actingAsImporter();
        $job = new ImportLeadJob($row, $columns, $company);

        $failMessage = null;
        $queueJob = Mockery::mock(QueueJobContract::class);
        $queueJob->shouldReceive('fail')->andReturnUsing(function ($message) use (&$failMessage) {
            $failMessage = $message;
        });
        $job->setJob($queueJob);

        $job->handle();

        if ($failMessage !== null) {
            $this->fail('ImportLeadJob unexpectedly failed: ' . $failMessage);
        }

        return $job;
    }

    public function test_fields_includes_optional_notes_without_changing_note(): void
    {
        $fields = collect(LeadImport::fields());

        $this->assertTrue($fields->contains(fn ($f) => $f['id'] === 'notes' && $f['name'] === 'Notes' && $f['required'] === 'No'));
        $this->assertTrue($fields->contains(fn ($f) => $f['id'] === 'note'));
    }

    public function test_creates_lead_note_with_cell_value_and_imported_title(): void
    {
        $this->mock(CrmEventService::class, function ($mock) {
            $mock->shouldReceive('record')
                ->once()
                ->withArgs(function (array $params) {
                    return ($params['event_type_slug'] ?? null) === 'lead_updated'
                        && ($params['metadata']['action'] ?? null) === 'note_added'
                        && ($params['metadata']['note_title'] ?? null) === 'Imported note'
                        && ($params['user_id'] ?? null) === $this->userId;
                })
                ->andReturn(null);
            $mock->shouldReceive('startCorrelation')->andReturn('test-correlation')->byDefault();
        });

        $this->runImport(
            [0 => 'name', 1 => 'notes'],
            [0 => 'Ada Lovelace', 1 => 'Met at conference']
        );

        $lead = Lead::withoutGlobalScopes()->where('client_name', 'Ada Lovelace')->first();
        $this->assertNotNull($lead);

        $note = LeadNote::where('lead_id', $lead->id)->first();
        $this->assertNotNull($note);
        $this->assertSame('Imported note', $note->title);
        $this->assertSame('Met at conference', $note->details);
        $this->assertSame(0, (int) $note->type);
        $this->assertSame($this->userId, (int) $note->added_by);
    }

    public function test_does_not_create_lead_note_when_notes_cell_empty(): void
    {
        $this->runImport(
            [0 => 'name', 1 => 'notes'],
            [0 => 'Empty Notes Lead', 1 => '   ']
        );

        $lead = Lead::withoutGlobalScopes()->where('client_name', 'Empty Notes Lead')->first();
        $this->assertNotNull($lead);
        $this->assertSame(0, LeadNote::where('lead_id', $lead->id)->count());
    }

    public function test_does_not_create_lead_note_when_notes_column_absent(): void
    {
        $this->runImport(
            [0 => 'name'],
            [0 => 'No Notes Column Lead']
        );

        $lead = Lead::withoutGlobalScopes()->where('client_name', 'No Notes Column Lead')->first();
        $this->assertNotNull($lead);
        $this->assertSame(0, LeadNote::where('lead_id', $lead->id)->count());
    }

    public function test_legacy_note_column_writes_independently_of_notes(): void
    {
        $this->runImport(
            [0 => 'name', 1 => 'note', 2 => 'notes'],
            [0 => 'Both Columns Lead', 1 => 'Flat field note', 2 => 'Structured note body']
        );

        $lead = Lead::withoutGlobalScopes()->where('client_name', 'Both Columns Lead')->first();
        $this->assertNotNull($lead);
        $this->assertSame('Flat field note', $lead->note);

        $note = LeadNote::where('lead_id', $lead->id)->first();
        $this->assertNotNull($note);
        $this->assertSame('Structured note body', $note->details);
        $this->assertSame('Imported note', $note->title);
    }

    public function test_hard_fails_row_when_lead_note_creation_throws(): void
    {
        LeadNote::saving(function () {
            throw new \RuntimeException('forced note failure');
        });

        $company = $this->actingAsImporter();
        $job = new ImportLeadJob(
            [0 => 'Ada Fail', 1 => 'Should roll back'],
            [0 => 'name', 1 => 'notes'],
            $company
        );

        $queueJob = Mockery::mock(QueueJobContract::class);
        $queueJob->shouldReceive('fail')->once()->withArgs(function ($message) {
            return is_string($message) && str_contains($message, 'forced note failure');
        });
        $job->setJob($queueJob);

        $job->handle();

        $this->assertSame(0, Lead::withoutGlobalScopes()->where('client_name', 'Ada Fail')->count());
        $this->assertSame(0, LeadNote::count());
        $this->assertSame(0, Deal::withoutGlobalScopes()->count());
    }
}
