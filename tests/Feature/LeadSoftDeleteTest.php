<?php

namespace Tests\Feature;

use App\Models\Lead;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class LeadSoftDeleteTest extends TestCase
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
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_default_eloquent_queries_exclude_soft_deleted_leads(): void
    {
        $activeId = $this->insertLead(['client_name' => 'Active Lead', 'client_email' => 'active@example.com']);
        $deletedId = $this->insertLead(['client_name' => 'Deleted Lead', 'client_email' => 'deleted@example.com']);

        $lead = Lead::findOrFail($deletedId);
        $lead->delete();

        $this->assertNull(Lead::find($deletedId));
        $this->assertNotNull(Lead::find($activeId));
        $this->assertSame(1, Lead::count());
    }

    public function test_with_trashed_retrieves_soft_deleted_lead(): void
    {
        $deletedId = $this->insertLead(['client_name' => 'Soft Deleted', 'client_email' => 'soft@example.com']);

        Lead::findOrFail($deletedId)->delete();

        $trashed = Lead::withTrashed()->find($deletedId);

        $this->assertNotNull($trashed);
        $this->assertTrue($trashed->trashed());
        $this->assertSame('Soft Deleted', $trashed->client_name);
    }

    public function test_soft_deleted_lead_absent_from_index_style_listing(): void
    {
        $this->insertLead(['client_name' => 'Listed Lead', 'client_email' => 'listed@example.com']);
        $deletedId = $this->insertLead(['client_name' => 'Hidden Lead', 'client_email' => 'hidden@example.com']);

        Lead::findOrFail($deletedId)->delete();

        $indexIds = Lead::query()
            ->orderBy('client_name')
            ->pluck('id')
            ->all();

        $this->assertNotContains($deletedId, $indexIds);
        $this->assertCount(1, $indexIds);
    }

    public function test_soft_deleted_lead_absent_from_report_style_count(): void
    {
        $this->insertLead([
            'client_name' => 'Report Active',
            'client_email' => 'report-active@example.com',
            'created_at' => now()->subDay(),
        ]);
        $deletedId = $this->insertLead([
            'client_name' => 'Report Deleted',
            'client_email' => 'report-deleted@example.com',
            'created_at' => now()->subDay(),
        ]);

        Lead::findOrFail($deletedId)->delete();

        $count = Lead::query()
            ->whereDate('created_at', '>=', now()->subDays(7)->toDateString())
            ->count();

        $this->assertSame(1, $count);
    }

    public function test_merged_into_lead_id_readable_via_with_trashed_and_helper(): void
    {
        $survivorId = $this->insertLead(['client_name' => 'Survivor', 'client_email' => 'survivor@example.com']);
        $mergedId = $this->insertLead(['client_name' => 'Merged Away', 'client_email' => 'merged@example.com']);

        $merged = Lead::findOrFail($mergedId);
        $merged->merged_into_lead_id = $survivorId;
        $merged->save();
        $merged->delete();

        $loaded = Lead::withTrashed()->find($mergedId);

        $this->assertNotNull($loaded);
        $this->assertSame($survivorId, $loaded->merged_into_lead_id);
        $this->assertTrue($loaded->trashed());

        $resolved = Lead::findWithMergeTarget($mergedId);

        $this->assertNotNull($resolved);
        $this->assertSame($survivorId, $resolved->id);
        $this->assertFalse($resolved->trashed());
    }

    public function test_force_delete_hard_deletes_lead_row(): void
    {
        $leadId = $this->insertLead(['client_name' => 'Hard Delete', 'client_email' => 'hard@example.com']);

        Lead::findOrFail($leadId)->forceDelete();

        $this->assertNull(Lead::withTrashed()->find($leadId));
        $this->assertSame(0, DB::table('leads')->where('id', $leadId)->count());
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('notifications');
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

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->string('client_email')->nullable();
            $table->string('mobile')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('merged_into_lead_id')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->string('type');
            $table->morphs('notifiable');
            $table->text('data');
            $table->timestamp('read_at')->nullable();
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
            'lead_owner' => null,
            'added_by' => null,
            'merged_into_lead_id' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
