<?php

namespace Tests\Feature\Deals;

use App\Models\Deal;
use App\Services\DealCreationService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * HIB-1419 regression.
 *
 * The integration creates a deal with one name, then pushes again with a different
 * deal_name. On that second push the service recomputed the hash from the same
 * contact/name/company it had already locked before opening the transaction, then
 * tried to Cache::add that identical key - reading its own lock as "another request"
 * and aborting with:
 *
 *   Cannot change deal name: another request is already processing a deal with name '...'
 *
 * Deterministic, not a race: the recomputed hash can never differ from the one the
 * request locked, so every push that renamed a deal rolled back.
 */
class DealRenameHashLockTest extends TestCase
{
    private int $companyId = 1;

    private int $leadId = 8610;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Cache::flush();
        Deal::unsetEventDispatcher();

        $this->createMinimalSchema();
        $this->seedPipeline();
        $this->seedLead();
    }

    protected function tearDown(): void
    {
        $this->dropSchema();
        parent::tearDown();
    }

    public function test_second_push_with_a_different_deal_name_renames_the_deal(): void
    {
        $service = new DealCreationService;

        $dealId = $this->seedDeal('Ayomide Oluniyi', $service->generateDealHash($this->leadId, 'Ayomide Oluniyi', $this->companyId));

        $result = $service->processDeal($this->leadId, $this->companyId, [
            'email' => 'paradox@hibarr.de',
            'deal_name' => 'Ayomide+Oluniyi HIbarr',
        ]);

        $this->assertFalse($result['is_new'], 'the existing deal should be reused, not duplicated');

        $deal = DB::table('deals')->where('id', $dealId)->first();

        $this->assertSame('Ayomide+Oluniyi HIbarr', $deal->name);
        $this->assertSame(
            $service->generateDealHash($this->leadId, 'Ayomide+Oluniyi HIbarr', $this->companyId),
            $deal->hash,
            'the stored hash must follow the new name'
        );
        $this->assertSame(1, DB::table('deals')->count(), 'no duplicate deal may be created');
    }

    public function test_rename_releases_the_lock_so_the_next_push_also_lands(): void
    {
        $service = new DealCreationService;

        $this->seedDeal('Ayomide Oluniyi', $service->generateDealHash($this->leadId, 'Ayomide Oluniyi', $this->companyId));

        $service->processDeal($this->leadId, $this->companyId, [
            'email' => 'paradox@hibarr.de',
            'deal_name' => 'Ayomide+Oluniyi HIbarr',
        ]);

        // The production sequence retried the same push several minutes apart and
        // failed identically every time; a second rename must still go through.
        $service->processDeal($this->leadId, $this->companyId, [
            'email' => 'paradox@hibarr.de',
            'deal_name' => 'Ayomide Oluniyi Hibarr Final',
        ]);

        $deal = DB::table('deals')->first();

        $this->assertSame('Ayomide Oluniyi Hibarr Final', $deal->name);
        $this->assertSame(1, DB::table('deals')->count());
    }

    public function test_repeat_push_with_the_same_name_still_matches_by_hash(): void
    {
        $service = new DealCreationService;

        $hash = $service->generateDealHash($this->leadId, 'Ayomide Oluniyi', $this->companyId);
        $dealId = $this->seedDeal('Ayomide Oluniyi', $hash);

        $result = $service->processDeal($this->leadId, $this->companyId, [
            'email' => 'paradox@hibarr.de',
            'deal_name' => 'Ayomide Oluniyi',
        ]);

        $this->assertFalse($result['is_new']);
        $this->assertSame($dealId, $result['deal']->id);
        $this->assertSame($hash, DB::table('deals')->where('id', $dealId)->value('hash'));
    }

    private function seedDeal(string $name, string $hash): int
    {
        return DB::table('deals')->insertGetId([
            'company_id' => $this->companyId,
            'lead_id' => $this->leadId,
            'added_by' => 1,
            'name' => $name,
            'hash' => $hash,
            'lead_pipeline_id' => 1,
            'pipeline_stage_id' => 1,
            'next_follow_up' => 'yes',
            'create_client' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function seedPipeline(): void
    {
        DB::table('lead_pipelines')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'name' => 'Default',
        ]);

        DB::table('pipeline_stages')->insert([
            'id' => 1,
            'company_id' => $this->companyId,
            'lead_pipeline_id' => 1,
            'name' => 'New',
            'slug' => 'new',
            'priority' => 1,
        ]);
    }

    private function seedLead(): void
    {
        DB::table('leads')->insert([
            'id' => $this->leadId,
            'company_id' => $this->companyId,
            'client_email' => 'paradox@hibarr.de',
            'client_name' => 'Ayomide Oluniyi',
            'lead_owner' => 1,
        ]);
    }

    private function createMinimalSchema(): void
    {
        $this->dropSchema();

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->unsignedBigInteger('lead_pipeline_id')->nullable();
            $table->unsignedBigInteger('pipeline_stage_id')->nullable();
            $table->string('name')->nullable();
            $table->string('hash')->nullable();
            $table->string('next_follow_up')->nullable();
            $table->boolean('create_client')->default(0);
            $table->dateTime('close_date')->nullable();
            $table->timestamps();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->string('client_email')->nullable();
            $table->string('client_name')->nullable();
            $table->unsignedBigInteger('lead_owner')->nullable();
            $table->unsignedBigInteger('client_id')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_pipelines', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('pipeline_stages', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('company_id')->nullable();
            $table->unsignedBigInteger('lead_pipeline_id')->nullable();
            $table->string('name')->nullable();
            $table->string('slug')->nullable();
            $table->integer('priority')->default(1);
            $table->timestamps();
        });
    }

    private function dropSchema(): void
    {
        foreach (['pipeline_stages', 'lead_pipelines', 'leads', 'deals'] as $table) {
            Schema::dropIfExists($table);
        }
    }
}
