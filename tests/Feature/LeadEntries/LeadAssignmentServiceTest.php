<?php

namespace Tests\Feature\LeadEntries;

use App\Models\Lead;
use App\Models\LeadAssignmentPool;
use App\Services\LeadAssignmentService;

class LeadAssignmentServiceTest extends LeadEntryTestCase
{
    private LeadAssignmentService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->service = app(LeadAssignmentService::class);
        config(['services.ol.default_lead_owner_id' => 1]);
        // The seeded lead belongs to user 1; most tests start from an unowned lead.
        $this->lead()->forceFill(['lead_owner' => null])->saveQuietly();
    }

    private function lead(): Lead
    {
        return Lead::withoutGlobalScopes()->findOrFail($this->leadId);
    }

    private function pool(array $memberUserIds, array $attrs = []): LeadAssignmentPool
    {
        $pool = LeadAssignmentPool::withoutGlobalScopes()->create(array_merge([
            'company_id' => $this->companyId,
            'name' => 'Webinar team',
            'active' => true,
        ], $attrs));
        foreach ($memberUserIds as $userId => $active) {
            if (is_int($active)) {
                [$userId, $active] = [$active, true];
            }
            $pool->members()->create(['user_id' => $userId, 'active' => $active]);
        }

        return $pool;
    }

    private function roundRobin(LeadAssignmentPool $pool, string $whenOwned = 'skip'): array
    {
        return $this->service->assign($this->lead(), [
            'strategy' => 'round_robin',
            'pool_id' => $pool->id,
            'when_owned' => $whenOwned,
        ]);
    }

    public function test_round_robin_hands_leads_out_in_turn_and_wraps(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $pool = $this->pool([2, 3]);

        $owners = [];
        foreach (range(1, 4) as $_) {
            $this->lead()->forceFill(['lead_owner' => null])->saveQuietly();
            $result = $this->roundRobin($pool);
            $this->assertSame('assigned', $result['outcome']);
            $owners[] = $this->lead()->lead_owner;
        }

        $this->assertSame([2, 3, 2, 3], $owners);
    }

    public function test_assigning_stamps_the_assignment_time(): void
    {
        $this->makeUser(2);
        $this->service->assign($this->lead(), ['strategy' => 'specific_user', 'user_id' => 2]);

        $this->assertNotNull($this->lead()->assigned_at);
    }

    public function test_members_who_are_away_or_inactive_are_skipped_without_losing_their_place(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $this->makeUser(4, 'deactivated');
        $this->makeUser(5);
        // 3 is away, 4's user is no longer active: only 2 and 5 are eligible.
        $pool = $this->pool([2 => true, 3 => false, 4 => true, 5 => true]);

        $owners = [];
        foreach (range(1, 3) as $_) {
            $this->lead()->forceFill(['lead_owner' => null])->saveQuietly();
            $this->roundRobin($pool);
            $owners[] = $this->lead()->lead_owner;
        }

        $this->assertSame([2, 5, 2], $owners);
    }

    public function test_a_cursor_pointing_at_a_removed_member_starts_the_rotation_over(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $pool = $this->pool([2, 3], ['last_member_id' => 9999]);

        $this->assertSame('assigned', $this->roundRobin($pool)['outcome']);
        $this->assertSame(2, $this->lead()->lead_owner);
    }

    public function test_a_lead_that_already_has_an_owner_is_left_alone_by_default(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $this->lead()->forceFill(['lead_owner' => 3])->saveQuietly();
        $pool = $this->pool([2]);

        $result = $this->roundRobin($pool);

        $this->assertSame('skipped', $result['outcome']);
        $this->assertSame(3, $result['previous_owner_id']);
        $this->assertSame(3, $this->lead()->lead_owner);
        // Nothing was handed out, so the pool's turn did not move.
        $this->assertNull($pool->fresh()->last_member_id);
    }

    public function test_overwrite_replaces_any_owner(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $this->lead()->forceFill(['lead_owner' => 3])->saveQuietly();

        $this->assertSame('assigned', $this->roundRobin($this->pool([2]), 'overwrite')['outcome']);
        $this->assertSame(2, $this->lead()->lead_owner);
    }

    public function test_overwrite_if_default_owner_replaces_only_the_default_owner(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $pool = $this->pool([2]);

        // Owned by the default owner (user 1): somebody nobody chose, so it is replaced.
        $this->lead()->forceFill(['lead_owner' => 1])->saveQuietly();
        $this->assertSame('assigned', $this->roundRobin($pool, 'overwrite_if_default_owner')['outcome']);
        $this->assertSame(2, $this->lead()->lead_owner);

        // Owned by a real person: left alone.
        $this->lead()->forceFill(['lead_owner' => 3])->saveQuietly();
        $this->assertSame('skipped', $this->roundRobin($pool, 'overwrite_if_default_owner')['outcome']);
        $this->assertSame(3, $this->lead()->lead_owner);
    }

    public function test_a_specific_user_must_exist_and_be_active(): void
    {
        $this->makeUser(2, 'deactivated');

        $inactive = $this->service->assign($this->lead(), ['strategy' => 'specific_user', 'user_id' => 2]);
        $missing = $this->service->assign($this->lead(), ['strategy' => 'specific_user', 'user_id' => 404]);
        $unset = $this->service->assign($this->lead(), ['strategy' => 'specific_user']);

        foreach ([$inactive, $missing, $unset] as $result) {
            $this->assertSame('failed', $result['outcome']);
        }
        $this->assertNull($this->lead()->lead_owner);
    }

    public function test_a_paused_empty_unknown_or_foreign_pool_assigns_nobody(): void
    {
        $this->makeUser(2);

        $cases = [
            'paused' => $this->pool([2], ['active' => false])->id,
            'empty' => $this->pool([])->id,
            'unknown' => 9999,
            'other company' => $this->pool([2], ['company_id' => 99])->id,
        ];

        foreach ($cases as $label => $poolId) {
            $result = $this->service->assign($this->lead(), ['strategy' => 'round_robin', 'pool_id' => $poolId]);
            $this->assertSame('failed', $result['outcome'], $label);
        }
        $this->assertNull($this->lead()->lead_owner);
    }

    private function foreignUser(int $id): int
    {
        \Illuminate\Support\Facades\DB::table('users')->insert([
            'id' => $id,
            'company_id' => $this->companyId + 1,
            'name' => "Outsider {$id}",
            'email' => "outsider{$id}@example.com",
            'status' => 'active',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $id;
    }

    public function test_a_named_user_from_another_company_is_never_assigned(): void
    {
        $outsider = $this->foreignUser(40);

        $result = $this->service->assign($this->lead(), ['strategy' => 'specific_user', 'user_id' => $outsider]);

        $this->assertSame('failed', $result['outcome']);
        $this->assertNull($this->lead()->lead_owner);
    }

    public function test_pool_members_from_another_company_are_skipped(): void
    {
        $this->makeUser(2);
        $outsider = $this->foreignUser(41);
        $pool = $this->pool([$outsider, 2]);

        $owners = [];
        foreach (range(1, 3) as $_) {
            $this->lead()->forceFill(['lead_owner' => null])->saveQuietly();
            $owners[] = $this->roundRobin($pool)['user_id'];
        }

        $this->assertSame([2, 2, 2], $owners);
    }

    public function test_the_owner_is_rechecked_on_the_locked_row_not_the_copy_the_caller_holds(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        // The caller loaded the lead while it was unowned...
        $stale = $this->lead();
        // ...and another run owned it before this one got to write.
        $this->lead()->forceFill(['lead_owner' => 3])->saveQuietly();

        $result = $this->service->assign($stale, ['strategy' => 'specific_user', 'user_id' => 2, 'when_owned' => 'skip']);

        $this->assertSame('skipped', $result['outcome']);
        $this->assertSame(3, $result['previous_owner_id']);
        $this->assertSame(3, (int) $this->lead()->lead_owner);
    }

    public function test_the_chosen_owner_is_written_even_when_it_equals_the_one_the_stale_copy_started_with(): void
    {
        $this->makeUser(2);
        $this->makeUser(3);
        $this->lead()->forceFill(['lead_owner' => 2])->saveQuietly();
        $stale = $this->lead();
        // Someone else took the lead meanwhile; this run overwrites it and picks the user the stale copy holds.
        $this->lead()->forceFill(['lead_owner' => 3])->saveQuietly();

        $result = $this->service->assign($stale, ['strategy' => 'specific_user', 'user_id' => 2, 'when_owned' => 'overwrite']);

        $this->assertSame('assigned', $result['outcome']);
        $this->assertSame(3, $result['previous_owner_id']);
        $this->assertSame(2, (int) $this->lead()->lead_owner);
        $this->assertSame(2, (int) $stale->lead_owner);
    }
}
