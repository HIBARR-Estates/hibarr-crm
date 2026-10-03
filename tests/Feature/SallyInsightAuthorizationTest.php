<?php

namespace Tests\Feature;

use App\Http\Controllers\LeadContactController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * An insight is reachable from both the lead and the deal workspace, so the
 * read route (visibleDealsOnly) hides it when the user may not view the deal.
 * The edit route has to agree: otherwise a lead editor with no access to the
 * attached deal can write a summary they cannot read.
 *
 * Controller methods are called directly — the gates under test are
 * PermissionService plus the deal/lead ownership rules, not routing.
 */
class SallyInsightAuthorizationTest extends TestCase
{
    /** Actor: has both permissions, but owns nothing relevant yet. */
    private const ACTOR_ID = 1;

    /** Holds edit_lead = all and edit_deals = owned. */
    private const LEAD_OWNER_ID = 2;

    /** Holds edit_lead = all and edit_deals = owned, assigned to the deal. */
    private const DEAL_AGENT_ID = 3;

    /** Holds edit_deals = owned, assigned to the deal, but no edit_lead. */
    private const DEAL_ONLY_AGENT_ID = 4;

    /** Watches the deal: edit_deals = owned, but not a team member. */
    private const DEAL_WATCHER_ID = 5;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->buildSchema();
        $this->seedPermissions();
    }

    protected function tearDown(): void
    {
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_lead_editor_without_deal_access_cannot_edit_a_deal_scoped_insight(): void
    {
        // edit_lead = all, edit_deals = owned, and this user owns no deal.
        $this->grant(self::LEAD_OWNER_ID, 'edit_lead', 'all');
        $this->grant(self::LEAD_OWNER_ID, 'edit_deals', 'owned');

        $insightId = $this->makeInsight(1, 1);

        $this->actingAsUser(self::LEAD_OWNER_ID);

        $this->assertForbidden(
            fn () => $this->update($insightId, 'hijacked'),
            'edit_lead alone must not grant write access to a deal-scoped insight',
        );

        $this->assertSame('original', $this->storedSummary($insightId));
    }

    public function test_deal_agent_without_lead_permission_cannot_edit_a_deal_and_lead_insight(): void
    {
        // edit_deals = owned and assigned, but no edit_lead at all.
        $this->grant(self::DEAL_ONLY_AGENT_ID, 'edit_deals', 'owned');

        $insightId = $this->makeInsight(1, 1);

        $this->actingAsUser(self::DEAL_ONLY_AGENT_ID);

        $this->assertForbidden(
            fn () => $this->update($insightId, 'hijacked'),
            'the lead gate must still apply to an insight that also has a lead',
        );

        $this->assertSame('original', $this->storedSummary($insightId));
    }

    public function test_deal_watcher_cannot_edit_a_deal_scoped_insight(): void
    {
        // Watchers may read a deal but never write to it, so the write gate
        // uses hasTeamMemberAccess() rather than isVisibleToUser().
        $this->grant(self::DEAL_WATCHER_ID, 'edit_lead', 'all');
        $this->grant(self::DEAL_WATCHER_ID, 'edit_deals', 'owned');
        DB::table('deal_watchers')->insert([
            'deal_id' => 1, 'user_id' => self::DEAL_WATCHER_ID,
        ]);

        $insightId = $this->makeInsight(1, 1);

        $this->actingAsUser(self::DEAL_WATCHER_ID);

        $this->assertForbidden(
            fn () => $this->update($insightId, 'hijacked'),
            'a deal watcher may read a summary but must not write to it',
        );

        $this->assertSame('original', $this->storedSummary($insightId));
    }

    public function test_user_holding_both_gates_may_edit_a_deal_scoped_insight(): void
    {
        $this->grant(self::DEAL_AGENT_ID, 'edit_lead', 'all');
        $this->grant(self::DEAL_AGENT_ID, 'edit_deals', 'owned');

        $insightId = $this->makeInsight(1, 1);

        $this->actingAsUser(self::DEAL_AGENT_ID);

        $response = $this->update($insightId, '<p>corrected summary</p>');

        $this->assertSame('success', $response['status']);
        $this->assertStringContainsString('corrected summary', $this->storedSummary($insightId));
    }

    public function test_lead_only_insight_still_editable_with_edit_lead_alone(): void
    {
        $this->grant(self::LEAD_OWNER_ID, 'edit_lead', 'all');

        $insightId = $this->makeInsight(1, null);

        $this->actingAsUser(self::LEAD_OWNER_ID);

        $response = $this->update($insightId, '<p>lead only</p>');

        $this->assertSame('success', $response['status']);
        $this->assertStringContainsString('lead only', $this->storedSummary($insightId));
    }

    private function assertForbidden(callable $call, string $message): void
    {
        try {
            $call();
            $this->fail($message);
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $e) {
            $this->assertSame(403, $e->getStatusCode(), $message);
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function update(int $insightId, string $summary): array
    {
        $request = Request::create('/account/sally-insights/'.$insightId, 'PATCH', [
            'summary' => $summary,
        ]);

        return json_decode(
            app(LeadContactController::class)->updateSallyInsight($request, $insightId)->getContent(),
            true,
        );
    }

    private function storedSummary(int $insightId): string
    {
        return (string) DB::table('sally_meeting_insights')->where('id', $insightId)->value('summary');
    }

    /**
     * user() reads the session before auth(); permission() only needs the id.
     */
    private function actingAsUser(int $userId): void
    {
        $actor = new User;
        $actor->id = $userId;

        session(['user' => $actor, 'user_roles' => ['admin']]);
    }

    private function makeInsight(?int $leadId, ?int $dealId): int
    {
        $meetingId = DB::table('lead_follow_up')->insertGetId([
            'deal_id' => $dealId,
            'lead_id' => $leadId,
            'remark' => 'Call',
            'location' => 'zoom',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return DB::table('sally_meeting_insights')->insertGetId([
            'company_id' => 1,
            'meeting_follow_up_id' => $meetingId,
            'lead_id' => $leadId,
            'deal_id' => $dealId,
            'summary' => 'original',
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function buildSchema(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            // The User model's global scope filters on these.
            $table->string('status')->default('active');
            $table->unsignedInteger('added_by')->nullable();
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

        Schema::create('leads', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_owner')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->softDeletes();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            // hasTeamMemberAccess() reads the deal's agent through this.
            $table->unsignedInteger('agent_id')->nullable();
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_participants', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('user_id');
        });

        Schema::create('deal_watchers', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id');
            $table->unsignedInteger('user_id');
        });

        Schema::create('lead_follow_up', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('deal_id')->nullable();
            $table->unsignedInteger('lead_id')->nullable();
            $table->text('remark')->nullable();
            $table->string('location')->nullable();
            $table->string('timezone')->nullable();
            $table->timestamp('next_follow_up_date')->nullable();
            $table->timestamps();
        });

        Schema::create('sally_meeting_insights', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('meeting_follow_up_id');
            $table->unsignedInteger('lead_id')->nullable();
            $table->unsignedBigInteger('deal_id')->nullable();
            $table->text('summary')->nullable();
            $table->longText('transcript')->nullable();
            $table->json('transcript_segments')->nullable();
            $table->json('bullet_points')->nullable();
            $table->timestamps();
        });

        DB::table('leads')->insert(['id' => 1, 'company_id' => 1]);
        DB::table('deals')->insert(['id' => 1, 'company_id' => 1, 'lead_id' => 1]);

        // Rows are required: hasTeamMemberAccess() reaches participants through
        // belongsToMany(User::class), which joins the users table, so an empty
        // table would silently deny every participant-based check.
        DB::table('users')->insert(array_map(
            fn (int $id) => ['id' => $id, 'company_id' => 1, 'status' => 'active'],
            [self::ACTOR_ID, self::LEAD_OWNER_ID, self::DEAL_AGENT_ID, self::DEAL_ONLY_AGENT_ID, self::DEAL_WATCHER_ID],
        ));

        // The deal's agent: DEAL_AGENT_ID and DEAL_ONLY_AGENT_ID have team
        // access, LEAD_OWNER_ID (and the default actor) do not.
        DB::table('lead_agents')->insert([
            'id' => 1, 'company_id' => 1, 'user_id' => self::DEAL_AGENT_ID,
            'created_at' => now(), 'updated_at' => now(),
        ]);
        DB::table('deals')->update(['agent_id' => 1]);
        DB::table('deal_participants')->insert([
            ['deal_id' => 1, 'user_id' => self::DEAL_AGENT_ID],
            ['deal_id' => 1, 'user_id' => self::DEAL_ONLY_AGENT_ID],
        ]);
    }

    private function seedPermissions(): void
    {
        DB::table('permissions')->insert([
            ['id' => 1, 'name' => 'edit_lead'],
            ['id' => 2, 'name' => 'edit_deals'],
            ['id' => 3, 'name' => 'view_lead'],
            ['id' => 4, 'name' => 'view_deals'],
        ]);

        DB::table('permission_types')->insert([
            ['id' => 1, 'name' => 'all'],
            ['id' => 2, 'name' => 'owned'],
        ]);
    }

    private function grant(int $userId, string $permission, string $type): void
    {
        DB::table('user_permissions')->insert([
            'user_id' => $userId,
            'permission_id' => DB::table('permissions')->where('name', $permission)->value('id'),
            'permission_type_id' => DB::table('permission_types')->where('name', $type)->value('id'),
        ]);
    }

    private function resetSchema(): void
    {
        foreach ([
            'sally_meeting_insights', 'lead_follow_up', 'deal_watchers',
            'deal_participants', 'lead_agents', 'deals', 'leads',
            'user_permissions', 'permission_types', 'permissions', 'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }
    }
}