<?php

namespace Tests\Unit\Leads;

use App\Models\Deal;
use App\Models\User;
use App\Services\PermissionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Mockery;
use Tests\TestCase;

/**
 * The Lead page lists a lead's deals, and a Deal carries its own read scope
 * (`view_deals`) — agent, participant and watcher visibility included. These
 * tests pin the per-instance check the Lead page applies, so a linked deal is
 * never readable through the lead when it could not be opened directly.
 */
class LeadLinkedDealVisibilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('deal_watchers');
        Schema::dropIfExists('deal_participants');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->id();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            // The User model's ActiveScope filters on this.
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('lead_agents', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable();
            $table->timestamps();
        });

        Schema::create('deals', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_id')->nullable();
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedBigInteger('added_by')->nullable();
            $table->unsignedBigInteger('agent_id')->nullable();
            $table->string('name')->nullable();
            $table->timestamps();
        });

        Schema::create('deal_participants', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
        });

        Schema::create('deal_watchers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('deal_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
        });
    }

    protected function tearDown(): void
    {
        Mockery::close();

        Schema::dropIfExists('deal_watchers');
        Schema::dropIfExists('deal_participants');
        Schema::dropIfExists('lead_agents');
        Schema::dropIfExists('deals');
        Schema::dropIfExists('users');

        parent::tearDown();
    }

    public function test_none_scope_returns_no_deals(): void
    {
        $this->seedDeals();

        $visible = $this->visibleDeals($this->viewer('none'));

        $this->assertCount(0, $visible);
    }

    public function test_added_scope_returns_only_own_deals(): void
    {
        $this->seedDeals();

        $visible = $this->visibleDeals($this->viewer('added'));

        $this->assertCount(1, $visible);
        $this->assertSame('Mine', $visible->first()->name);
    }

    public function test_owned_scope_includes_participant_and_watcher_deals(): void
    {
        $this->seedDeals();

        // User 10 is a participant on "Shared" and a watcher on "Watched".
        $visible = $this->visibleDeals($this->viewer('owned'));

        $this->assertEqualsCanonicalizing(
            ['Shared', 'Watched'],
            $visible->pluck('name')->all()
        );
    }

    public function test_both_scope_returns_own_and_visible_deals(): void
    {
        $this->seedDeals();

        $visible = $this->visibleDeals($this->viewer('both'));

        $this->assertEqualsCanonicalizing(
            ['Mine', 'Shared', 'Watched'],
            $visible->pluck('name')->all()
        );
    }

    public function test_all_scope_returns_every_deal(): void
    {
        $this->seedDeals();

        $visible = $this->visibleDeals($this->viewer('all'));

        $this->assertCount(4, $visible);
    }

    /**
     * @return \Illuminate\Support\Collection<int, Deal>
     */
    private function visibleDeals(User $viewer)
    {
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];

        return Deal::where('lead_id', 1)
            ->get()
            ->filter(fn (Deal $deal) => PermissionService::checkAccess($viewer, 'view_deals', $deal, $dealRules)['canAccess'])
            ->values();
    }

    private function seedDeals(): void
    {
        DB::table('users')->insert(['id' => 10, 'name' => 'Agent', 'status' => 'active']);

        $mine = $this->insertDeal('Mine', 10);
        $shared = $this->insertDeal('Shared', 20);
        $watched = $this->insertDeal('Watched', 20);
        $this->insertDeal('Theirs', 20);

        DB::table('deal_participants')->insert(['deal_id' => $shared, 'user_id' => 10]);
        DB::table('deal_watchers')->insert(['deal_id' => $watched, 'user_id' => 10]);
    }

    private function insertDeal(string $name, int $addedBy): int
    {
        return (int) DB::table('deals')->insertGetId([
            'lead_id' => 1,
            'company_id' => 1,
            'added_by' => $addedBy,
            'name' => $name,
        ]);
    }

    /**
     * A viewer with the given `view_deals` scope.
     */
    private function viewer(string $scope, int $userId = 10): User
    {
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = $userId;

        $user->shouldReceive('permission')
            ->with('view_deals')
            ->andReturn($scope);

        return $user;
    }
}
