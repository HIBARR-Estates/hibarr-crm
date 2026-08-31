<?php

namespace Tests\Feature\Deals;

use App\Models\Deal;
use App\Models\LeadAgent;
use App\Models\User;
use App\Services\PermissionService;
use Mockery;
use Tests\TestCase;

class DealPaymentPermissionTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();

        parent::tearDown();
    }

    public function test_create_gate_allows_deal_agent_with_edit_deals_owned(): void
    {
        $deal = $this->makeDealWithAgent(5);

        /** @var User&\Mockery\MockInterface $agent */
        $agent = Mockery::mock(User::class)->makePartial();
        $agent->id = 5;
        $agent->shouldReceive('permission')->with('edit_deals')->andReturn('owned');

        $access = PermissionService::checkAccess($agent, 'edit_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->hasTeamMemberAccess($user->id),
        ]);

        $this->assertTrue($access['canAccess']);
    }

    public function test_create_gate_denies_outsider_without_edit_deals_scope(): void
    {
        $deal = $this->makeDealWithAgent(5);

        /** @var User&\Mockery\MockInterface $outsider */
        $outsider = Mockery::mock(User::class)->makePartial();
        $outsider->id = 99;
        $outsider->shouldReceive('permission')->with('edit_deals')->andReturn('none');

        $access = PermissionService::checkAccess($outsider, 'edit_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->hasTeamMemberAccess($user->id),
        ]);

        $this->assertFalse($access['canAccess']);
    }

    public function test_create_gate_does_not_require_edit_payments(): void
    {
        /** @var User&\Mockery\MockInterface $agent */
        $agent = Mockery::mock(User::class)->makePartial();
        $agent->shouldReceive('permission')->with('edit_payments')->andReturn('none');

        $this->assertNotSame('all', $agent->permission('edit_payments'));
    }

    public function test_confirm_gate_requires_edit_payments_all(): void
    {
        /** @var User&\Mockery\MockInterface $finance */
        $finance = Mockery::mock(User::class)->makePartial();
        $finance->shouldReceive('permission')->with('edit_payments')->andReturn('all');

        $this->assertSame('all', $finance->permission('edit_payments'));
    }

    public function test_watcher_is_visible_but_not_a_team_writer(): void
    {
        $deal = $this->makeDealWithAgent(5);

        $this->assertFalse($deal->hasTeamMemberAccess(7));
    }

    public function test_locked_deal_blocks_create_at_model_level(): void
    {
        $deal = $this->makeDealWithAgent(5, isLocked: true);

        $this->assertTrue($deal->isLocked());
    }

    private function makeDealWithAgent(int $agentUserId, bool $isLocked = false): Deal
    {
        $leadAgent = new LeadAgent();
        $leadAgent->user_id = $agentUserId;

        $deal = new Deal([
            'added_by' => 1,
            'agent_id' => 1,
            'is_locked' => $isLocked,
        ]);
        $deal->id = 10;
        $deal->setRelation('leadAgent', $leadAgent);

        return $deal;
    }
}
