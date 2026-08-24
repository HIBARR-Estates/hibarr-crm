<?php

namespace Tests\Feature;

use App\Http\Controllers\LeadContactController;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * End-to-end through LeadContactController::applyQuickAction(), the endpoint the
 * bulk toolbar actually posts to. The post-action summary card renders straight
 * off this response shape, so a rename here silently empties the card.
 */
class LeadBulkSummaryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('client_name');
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('referred_by_agent_id')->nullable();
            $table->unsignedInteger('last_updated_by')->nullable();
            $table->string('temperature')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });
        Schema::create('permission_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
        });
        Schema::create('user_permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('permission_type_id');
        });

        DB::table('permissions')->insert(['id' => 1, 'name' => 'edit_lead']);
        DB::table('permission_types')->insert(['id' => 1, 'name' => 'all']);
        DB::table('user_permissions')->insert([
            'user_id' => 1, 'permission_id' => 1, 'permission_type_id' => 1,
        ]);

        // user() reads the session before touching auth; permission() only
        // needs the id, so an unsaved instance is enough.
        $actor = new User;
        $actor->id = 1;
        session(['user' => $actor, 'user_roles' => ['admin']]);
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_bulk_update_response_carries_the_summary_the_card_renders(): void
    {
        $a = $this->insertLead(['client_name' => 'A']);
        $b = $this->insertLead(['client_name' => 'B']);

        $response = $this->bulkUpdate(['temperature' => 'hot'], [$a, $b], ['temperature']);

        $this->assertSame('success', $response['status']);
        $this->assertSame(2, $response['summary']['updated']);
        foreach ($response['summary']['skipped'] as $entry) {
            $this->assertArrayHasKey('count', $entry);
            $this->assertArrayHasKey('reason', $entry);
        }

        // And the update really happened.
        $this->assertSame('hot', Lead::findOrFail($a)->temperature?->value);
    }

    public function test_leads_keeping_their_referrer_are_reported_with_that_reason(): void
    {
        $empty = $this->insertLead(['client_name' => 'No referrer']);
        $takenA = $this->insertLead(['client_name' => 'A', 'referred_by_agent_id' => 7]);
        $takenB = $this->insertLead(['client_name' => 'B', 'referred_by_agent_id' => 8]);

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });
        DB::table('lead_agents')->insert([
            'id' => 9, 'company_id' => 1, 'user_id' => 1,
            'created_at' => now(), 'updated_at' => now(),
        ]);

        $response = $this->bulkUpdate(
            ['referred_by_agent_id' => 9],
            [$empty, $takenA, $takenB],
            ['referred_by_agent_id'],
        );

        $kept = collect($response['summary']['skipped'])
            ->firstWhere('reason', 'kept their existing referrer');

        $this->assertNotNull($kept, 'referrer skips must be reported separately');
        $this->assertSame(2, $kept['count']);
        $this->assertSame(9, (int) Lead::findOrFail($empty)->referred_by_agent_id);
        $this->assertSame(7, (int) Lead::findOrFail($takenA)->referred_by_agent_id);
    }

    /**
     * @param  array<string, mixed>  $payload
     * @param  list<int>  $rowIds
     * @param  list<string>  $fields
     * @return array<string, mixed>
     */
    private function bulkUpdate(array $payload, array $rowIds, array $fields): array
    {
        $request = Request::create('/lead-contact/apply-quick-action', 'POST', array_merge($payload, [
            'action_type' => 'bulk_update',
            'fields' => $fields,
            'row_ids' => implode(',', $rowIds),
        ]));

        return app(LeadContactController::class)->applyQuickAction($request);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('permission_types');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('leads');
    }

    /**
     * @param  array<string, mixed>  $attributes
     */
    private function insertLead(array $attributes): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => 1,
            'client_name' => 'Test Lead',
            'added_by' => null,
            'referred_by_agent_id' => null,
            'temperature' => null,
            'deleted_at' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $attributes));
    }
}
