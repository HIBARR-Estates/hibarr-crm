<?php

namespace Tests\Unit\Support;

use App\Models\Company;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\Permission;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\Task;
use App\Models\User;
use App\Models\UserPermission;
use App\Support\TaskPresenter;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * A task's category quick-action (call / email) targets a lead. When the task is
 * attached to a DEAL instead, the presenter must expose that deal's lead contact
 * so the action can still find it — and must not expose it to a user who is not
 * allowed to view that lead.
 */
class TaskPresenterDealLeadTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_exposes_the_deal_contact_as_the_action_lead(): void
    {
        $this->actingAsAdmin();
        $lead = Lead::factory()->create([
            'client_name' => 'Isaac Owolabi',
            'mobile' => '+49 30 7654321',
            'client_email' => 'isaac@example.com',
        ]);
        $deal = Deal::factory()->create(['lead_id' => $lead->id, 'name' => 'Oak Street viewing']);
        $task = $this->taskLinkedTo($deal);

        $payload = TaskPresenter::present($task);

        $this->assertCount(1, $payload['deals']);
        $this->assertSame('Oak Street viewing', $payload['deals'][0]['name']);
        $this->assertSame($lead->id, $payload['deals'][0]['lead']['id']);
        $this->assertSame('Isaac Owolabi', $payload['deals'][0]['lead']['client_name']);
        $this->assertSame('+49 30 7654321', $payload['deals'][0]['lead']['mobile']);
        $this->assertSame('isaac@example.com', $payload['deals'][0]['lead']['client_email']);
    }

    public function test_deal_without_a_contact_has_a_null_action_lead(): void
    {
        $this->actingAsAdmin();
        $deal = Deal::factory()->create(['lead_id' => null, 'name' => 'Uncontacted deal']);
        $task = $this->taskLinkedTo($deal);

        $payload = TaskPresenter::present($task);

        $this->assertNull($payload['deals'][0]['lead']);
    }

    public function test_deal_contact_is_hidden_from_a_user_who_cannot_view_that_lead(): void
    {
        $lead = Lead::factory()->create(['mobile' => '+49 30 7654321']);
        $deal = Deal::factory()->create(['lead_id' => $lead->id]);
        $task = $this->taskLinkedTo($deal);

        // view_lead scoped to 'added' and this agent added nobody — the lead is
        // someone else's, so its contact details must not ride along.
        $outsider = User::factory()->create(['company_id' => $lead->company_id]);
        // Permissions go through the app's own UserPermission table so
        // permissionMap() picks them up, and the user is then authenticated
        // plainly — actingAs() with a guard map bypasses that pipeline.
        UserPermission::create([
            'user_id' => $outsider->id,
            'permission_id' => Permission::where('name', 'view_lead')->value('id'),
            'permission_type_id' => PermissionType::where('name', 'added')->value('id'),
        ]);
        $this->actingAs($outsider);

        $payload = TaskPresenter::present($task->fresh(TaskPresenter::RELATIONS));

        $this->assertNull($payload['deals'][0]['lead']);
        $this->assertStringNotContainsString('+49 30 7654321', json_encode($payload));
    }

    private function taskLinkedTo(Deal $deal): Task
    {
        // create() rather than the factory: the heading/company_id the tests
        // assert on must be the exact values passed in, and the factory's own
        // definitions can overwrite them.
        $task = Task::create([
            'heading' => 'Call about the viewing',
            'company_id' => $deal->company_id,
        ]);
        $task->deals()->attach($deal->id);

        return $task->fresh(TaskPresenter::RELATIONS);
    }

    private function actingAsAdmin(): void
    {
        $company = Company::factory()->create();
        $admin = User::factory()->create(['company_id' => $company->id]);
        $admin->forceFill(['company_id' => $company->id])->save();

        UserPermission::create([
            'user_id' => $admin->id,
            'permission_id' => Permission::where('name', 'view_lead')->value('id'),
            'permission_type_id' => PermissionType::where('name', 'all')->value('id'),
        ]);

        // user_roles() reads this session key and user()->roles, so both need
        // the admin role for hasRole() to see it.
        $role = Role::where('name', 'admin')->first();
        $admin->roles()->attach($role->id);
        session(['user_roles' => ['admin']]);

        $this->actingAs($admin);
    }
}
