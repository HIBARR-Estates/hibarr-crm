<?php

namespace Tests\Feature;

use App\Exports\LeadExport;
use App\Http\Controllers\LeadContactController;
use App\Models\Company;
use App\Models\User;
use App\Services\LeadService;
use App\Support\LeadExportFields;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class LeadBulkExportTest extends TestCase
{
    private int $companyId = 1;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
        $this->seedCompany();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_filter_requested_keeps_allowlisted_keys_in_order(): void
    {
        $filtered = LeadExportFields::filterRequested([
            'client_name',
            'not_a_field',
            'mobile',
            'client_name',
            'source',
        ]);

        $this->assertSame(['client_name', 'mobile', 'source'], $filtered);
    }

    public function test_filter_requested_rejects_empty_selection(): void
    {
        $this->assertSame([], LeadExportFields::filterRequested([]));
        $this->assertSame([], LeadExportFields::filterRequested(['nope', 'also_nope']));
    }

    public function test_max_rows_constant(): void
    {
        $this->assertSame(10000, LeadExportFields::MAX_ROWS);
    }

    public function test_lead_export_headings_and_mapping_use_selected_fields(): void
    {
        $ownerId = $this->insertUser('Owner Person');
        $sourceId = $this->insertSource('Website');
        $leadId = $this->insertLead([
            'client_name' => 'Ada Lovelace',
            'client_email' => 'ada@example.com',
            'mobile' => '+1 555',
            'temperature' => 'hot',
            'lead_owner' => $ownerId,
            'source_id' => $sourceId,
        ]);

        $export = new LeadExport(
            [$leadId],
            ['client_name', 'client_email', 'source', 'lead_owner', 'temperature']
        );

        $this->assertSame(
            ['Lead name', 'Email', 'Source', 'Lead owner', 'Temperature'],
            $export->headings()
        );

        $rows = $export->collection();
        $this->assertCount(1, $rows);

        $mapped = $export->map($rows->first());
        $this->assertSame('Ada Lovelace', $mapped[0]);
        $this->assertSame('ada@example.com', $mapped[1]);
        $this->assertSame('Website', $mapped[2]);
        $this->assertSame('Owner Person', $mapped[3]);
        $this->assertSame('Hot', $mapped[4]);
    }

    public function test_export_forbidden_for_non_admin(): void
    {
        $this->actingAsExportUser(['employee'], 'all');
        $leadId = $this->insertLead(['client_name' => 'Lead']);

        try {
            $this->callExport([
                'row_ids' => (string) $leadId,
                'fields' => ['client_name'],
                'format' => 'xlsx',
            ]);
            $this->fail('Expected 403 HttpException');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_export_forbidden_when_view_lead_is_none(): void
    {
        $this->actingAsExportUser(['admin'], 'none');
        $leadId = $this->insertLead(['client_name' => 'Lead']);

        try {
            $this->callExport([
                'row_ids' => (string) $leadId,
                'fields' => ['client_name'],
                'format' => 'xlsx',
            ]);
            $this->fail('Expected 403 HttpException');
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());
        }
    }

    public function test_export_rejects_empty_and_unknown_fields(): void
    {
        $this->actingAsExportUser(['admin'], 'all');
        $leadId = $this->insertLead(['client_name' => 'Lead']);

        $empty = $this->callExport([
            'row_ids' => (string) $leadId,
            'fields' => [],
            'format' => 'xlsx',
        ]);
        $this->assertSame(422, $empty->getStatusCode());

        $unknown = $this->callExport([
            'row_ids' => (string) $leadId,
            'fields' => ['totally_fake'],
            'format' => 'csv',
        ]);
        $this->assertSame(422, $unknown->getStatusCode());
    }

    public function test_export_rejects_invalid_format(): void
    {
        $this->actingAsExportUser(['admin'], 'all');
        $leadId = $this->insertLead(['client_name' => 'Lead']);

        $response = $this->callExport([
            'row_ids' => (string) $leadId,
            'fields' => ['client_name'],
            'format' => 'pdf',
        ]);

        $this->assertSame(422, $response->getStatusCode());
    }

    public function test_export_select_all_matching_respects_filters(): void
    {
        $this->actingAsExportUser(['admin'], 'all');

        $hotId = $this->insertLead(['client_name' => 'Hot', 'temperature' => 'hot']);
        $this->insertLead(['client_name' => 'Cold', 'temperature' => 'cold']);

        $service = app(LeadService::class);
        $matching = $service->getMatchingLeadIds(
            Request::create('/lead-contact', 'GET', ['temperature' => 'hot'])
        );
        $this->assertSame([$hotId], $matching);

        $response = $this->callExport([
            'select_all_matching' => true,
            'temperature' => 'hot',
            'fields' => ['client_name', 'temperature'],
            'format' => 'csv',
        ]);

        $this->assertSame(200, $response->getStatusCode());
        $disposition = (string) $response->headers->get('content-disposition');
        $this->assertStringContainsString('.csv', $disposition);
    }

    public function test_export_download_succeeds_for_admin_xlsx(): void
    {
        $this->actingAsExportUser(['admin'], 'all');
        $leadId = $this->insertLead([
            'client_name' => 'Export Me',
            'client_email' => 'export@example.com',
        ]);

        $response = $this->callExport([
            'row_ids' => (string) $leadId,
            'fields' => ['client_name', 'client_email'],
            'format' => 'xlsx',
        ]);

        $this->assertSame(200, $response->getStatusCode());
        $disposition = (string) $response->headers->get('content-disposition');
        $this->assertStringContainsString('leads-export-', $disposition);
        $this->assertStringContainsString('.xlsx', $disposition);
    }

    public function test_export_rejects_when_over_row_cap(): void
    {
        $this->actingAsExportUser(['admin'], 'all');

        $now = now()->toDateTimeString();
        $chunk = [];
        for ($i = 0; $i < LeadExportFields::MAX_ROWS + 1; $i++) {
            $chunk[] = [
                'company_id' => $this->companyId,
                'client_name' => 'Lead '.$i,
                'client_email' => null,
                'temperature' => 'warm',
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if (count($chunk) >= 500) {
                DB::table('leads')->insert($chunk);
                $chunk = [];
            }
        }
        if ($chunk !== []) {
            DB::table('leads')->insert($chunk);
        }

        $response = $this->callExport([
            'select_all_matching' => true,
            'fields' => ['client_name'],
            'format' => 'csv',
        ]);

        $this->assertSame(422, $response->getStatusCode());
        $this->assertStringContainsString('10,000', (string) $response->getContent());
    }

    /**
     * @param  list<string>  $roles
     */
    private function actingAsExportUser(array $roles, string $viewLeadScope): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = 99;
        $user->company_id = $this->companyId;
        $user->admin_approval = true;
        $user->exists = true;
        $user->shouldReceive('permission')
            ->with('view_lead')
            ->andReturn($viewLeadScope);

        $company = Company::withoutGlobalScopes()->find($this->companyId);
        $this->assertNotNull($company);

        session([
            'user' => $user,
            'user_roles' => $roles,
            'company' => $company,
        ]);

        $this->actingAs($user);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function callExport(array $payload)
    {
        $request = Request::create('/account/lead-contact/export', 'POST', $payload);

        /** @var LeadContactController $controller */
        $controller = app(LeadContactController::class);

        return $controller->export($request);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('sessions');
        Schema::dropIfExists('lead_sources');
        Schema::dropIfExists('users');
        Schema::dropIfExists('leads');
        Schema::dropIfExists('companies');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->timestamps();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });

        Schema::create('lead_sources', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('type');
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('mobile')->nullable();
            $table->string('temperature')->nullable();
            $table->unsignedInteger('source_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('category_id')->nullable();
            $table->unsignedInteger('lead_lifecycle_status_id')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });
    }

    private function seedCompany(): void
    {
        DB::table('companies')->insert([
            'id' => $this->companyId,
            'company_name' => 'Test Co',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertLead(array $attributes): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => $this->companyId,
            'client_name' => 'Test Lead',
            'client_email' => null,
            'mobile' => null,
            'temperature' => null,
            'source_id' => null,
            'lead_owner' => null,
            'added_by' => null,
            'category_id' => null,
            'lead_lifecycle_status_id' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }

    private function insertUser(string $name): int
    {
        return (int) DB::table('users')->insertGetId([
            'company_id' => $this->companyId,
            'name' => $name,
            'email' => strtolower(str_replace(' ', '.', $name)).'@example.com',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertSource(string $type): int
    {
        return (int) DB::table('lead_sources')->insertGetId([
            'company_id' => $this->companyId,
            'type' => $type,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
