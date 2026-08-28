<?php

namespace Tests\Feature\Dashboard;

use App\Models\DealFollowUp;
use App\Services\MeetingVisibilityService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * host_id defaults to the deal's agent (or the lead's owner), falling back
 * to the meeting's creator — the same resolution assignedAgentUserId() uses
 * for reminders/attendance-confirmation — and is backfilled onto existing
 * rows the same way by the 2026_08_27_120000 migration.
 */
class FollowUpHostTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();
        parent::tearDown();
    }

    public function test_default_host_prefers_the_deals_agent(): void
    {
        $this->makeUser(5, 'Agent User');
        $this->makeUser(6, 'Creator User');
        $this->makeLeadAgent(1, 5);
        $this->makeDeal(1, 1);

        $followUp = $this->makeFollowUp(1, dealId: 1, leadId: null, addedBy: 6);

        $this->assertSame(5, $followUp->defaultHostUserId());
    }

    public function test_default_host_falls_back_to_the_leads_owner(): void
    {
        $this->makeUser(9, 'Lead Owner');
        $this->makeUser(6, 'Creator User');
        $this->makeLead(1, 9);

        $followUp = $this->makeFollowUp(1, dealId: null, leadId: 1, addedBy: 6);

        $this->assertSame(9, $followUp->defaultHostUserId());
    }

    public function test_default_host_falls_back_to_the_creator_when_no_agent_or_owner(): void
    {
        $this->makeUser(6, 'Creator User');

        $followUp = $this->makeFollowUp(1, dealId: null, leadId: null, addedBy: 6);

        $this->assertSame(6, $followUp->defaultHostUserId());
    }

    public function test_ensure_host_owner_is_participant_is_a_no_op_when_owner_is_host(): void
    {
        $result = MeetingVisibilityService::ensureHostOwnerIsParticipant([6, 7], 5, 5);

        $this->assertSame([6, 7], $result);
    }

    public function test_ensure_host_owner_is_participant_prepends_owner_when_not_host(): void
    {
        $result = MeetingVisibilityService::ensureHostOwnerIsParticipant([6, 7], 8, 5);

        $this->assertSame([5, 6, 7], $result);
    }

    public function test_ensure_host_owner_is_participant_does_not_duplicate_an_already_present_owner(): void
    {
        $result = MeetingVisibilityService::ensureHostOwnerIsParticipant([5, 6], 8, 5);

        $this->assertSame([5, 6], $result);
    }

    public function test_ensure_host_owner_is_participant_is_a_no_op_when_owner_is_unresolvable(): void
    {
        $result = MeetingVisibilityService::ensureHostOwnerIsParticipant([6, 7], 8, null);

        $this->assertSame([6, 7], $result);
    }

    /**
     * Mirrors the exact per-row expression the 2026_08_27_120000 migration's
     * backfill uses, across all three resolution tiers.
     */
    public function test_backfill_resolution_matches_across_deal_lead_and_creator_only_rows(): void
    {
        $this->makeUser(5, 'Agent User');
        $this->makeUser(9, 'Lead Owner');
        $this->makeUser(6, 'Creator User');
        $this->makeLeadAgent(1, 5);
        $this->makeDeal(1, 1);
        $this->makeLead(2, 9);

        $dealFollowUp = $this->makeFollowUp(1, dealId: 1, leadId: null, addedBy: 6);
        $leadFollowUp = $this->makeFollowUp(2, dealId: null, leadId: 2, addedBy: 6);
        $creatorOnlyFollowUp = $this->makeFollowUp(3, dealId: null, leadId: null, addedBy: 6);

        // Same expression the migration's backfill uses per row.
        $resolve = fn (DealFollowUp $f) => $f->assignedAgentUserId() ?? $f->added_by;

        $this->assertSame(5, $resolve($dealFollowUp));
        $this->assertSame(9, $resolve($leadFollowUp));
        $this->assertSame(6, $resolve($creatorOnlyFollowUp));
    }

    private function makeUser(int $id, string $name): void
    {
        DB::table('users')->insert([
            'id' => $id,
            'name' => $name,
            'status' => 'active',
            'email' => strtolower(str_replace(' ', '.', $name)).'@example.test',
        ]);
    }

    private function makeLeadAgent(int $id, int $userId): void
    {
        DB::table('lead_agents')->insert(['id' => $id, 'user_id' => $userId]);
    }

    private function makeLead(int $id, int $ownerId): void
    {
        DB::table('leads')->insert(['id' => $id, 'client_name' => "Lead {$id}", 'lead_owner' => $ownerId]);
    }

    private function makeDeal(int $id, int $agentId): void
    {
        DB::table('deals')->insert(['id' => $id, 'agent_id' => $agentId]);
    }

    private function makeFollowUp(int $id, ?int $dealId, ?int $leadId, int $addedBy): DealFollowUp
    {
        DB::table('lead_follow_up')->insert([
            'id' => $id,
            'deal_id' => $dealId,
            'lead_id' => $leadId,
            'added_by' => $addedBy,
            'status' => 'scheduled',
            'next_follow_up_date' => '2026-08-10 10:00:00',
        ]);

        return DealFollowUp::query()->findOrFail($id);
    }

    private function resetSchema(): void
    {
        foreach (['lead_follow_up', 'deals', 'leads', 'lead_agents', 'users'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function createMinimalSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->string('status')->default('active');
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id')->nullable();
        });

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->string('client_name')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->softDeletes();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('agent_id')->nullable();
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->unsignedInteger('host_id')->nullable();
            $table->string('status')->nullable();
            $table->integer('duration')->nullable();
            $table->dateTime('next_follow_up_date')->nullable();
            $table->timestamps();
        });
    }
}
