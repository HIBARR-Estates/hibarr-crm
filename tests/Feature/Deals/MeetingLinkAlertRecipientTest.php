<?php

namespace Tests\Feature\Deals;

use App\Http\Controllers\DealController;
use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use ReflectionMethod;
use Tests\TestCase;

/**
 * Who is told when a meeting's Zoho link fails, and so who may ask for it
 * again: the deal's agent, else the lead owner, else the first active
 * watcher by name (then id), else the meeting's creator.
 */
class MeetingLinkAlertRecipientTest extends TestCase
{
    use RefreshDatabase;

    private function recipient(DealFollowUp $followUp): ?int
    {
        $method = new ReflectionMethod(DealController::class, 'meetingLinkAlertRecipientId');
        $method->setAccessible(true);

        return $method->invoke(app(DealController::class), $followUp->fresh());
    }

    private function dealWithoutOwner(): Deal
    {
        $lead = Lead::factory()->create(['company_id' => 1, 'lead_owner' => null]);

        return Deal::factory()->create(['company_id' => 1, 'lead_id' => $lead->id, 'agent_id' => null]);
    }

    private function meeting(Deal $deal, ?int $addedBy = null): DealFollowUp
    {
        $followUp = new DealFollowUp;
        $followUp->deal_id = $deal->id;
        $followUp->added_by = $addedBy;
        $followUp->save();

        return $followUp;
    }

    private function watch(Deal $deal, User ...$users): void
    {
        foreach ($users as $user) {
            DB::table('deal_watchers')->insert(['deal_id' => $deal->id, 'user_id' => $user->id]);
        }
    }

    public function test_the_first_active_watcher_by_name_then_id_is_alerted(): void
    {
        $deal = $this->dealWithoutOwner();
        $first = User::factory()->create(['name' => 'Anna Berg', 'status' => 'active']);
        $twin = User::factory()->create(['name' => 'Anna Berg', 'status' => 'active']);
        $later = User::factory()->create(['name' => 'Zeynep Kaya', 'status' => 'active']);
        $deactivated = User::factory()->create(['name' => 'Aaron Ash', 'status' => 'deactive']);
        $this->watch($deal, $later, $twin, $deactivated, $first);

        $this->assertSame($first->id, $this->recipient($this->meeting($deal)));
    }

    public function test_the_creator_is_alerted_when_there_is_no_agent_owner_or_watcher(): void
    {
        $deal = $this->dealWithoutOwner();
        $creator = User::factory()->create(['status' => 'active']);

        $this->assertSame($creator->id, $this->recipient($this->meeting($deal, $creator->id)));
    }

    public function test_the_lead_owner_comes_before_watchers(): void
    {
        $owner = User::factory()->create(['status' => 'active']);
        $lead = Lead::factory()->create(['company_id' => 1, 'lead_owner' => $owner->id]);
        $deal = Deal::factory()->create(['company_id' => 1, 'lead_id' => $lead->id, 'agent_id' => null]);
        $this->watch($deal, User::factory()->create(['name' => 'Aaron', 'status' => 'active']));

        $this->assertSame($owner->id, $this->recipient($this->meeting($deal)));
    }
}
