<?php

namespace Tests\Unit\Models;

use App\Models\User;
use Tests\TestCase;

class UserMassAssignmentTest extends TestCase
{
    public function test_request_style_arrays_cannot_set_tenancy_approval_or_2fa_state(): void
    {
        $user = new User([
            'name' => 'Client',
            'email' => 'client@example.com',
            'login' => 'enable',
            'status' => 'active',
            'company_id' => 9,
            'admin_approval' => 1,
            'permission_sync' => 1,
            'customised_permissions' => 1,
            'two_fa_verify_via' => 'email',
            'two_factor_confirmed' => 1,
            'remember_token' => 'forged',
        ]);

        $this->assertSame('Client', $user->name);
        $this->assertSame('enable', $user->login);
        $this->assertSame('active', $user->status);

        foreach (['company_id', 'admin_approval', 'permission_sync', 'customised_permissions', 'two_fa_verify_via', 'two_factor_confirmed', 'remember_token'] as $column) {
            $this->assertNull($user->getAttributes()[$column] ?? null, "{$column} should not be mass assignable");
        }
    }

    public function test_force_fill_still_sets_guarded_columns(): void
    {
        $user = (new User())->forceFill(['company_id' => 3, 'admin_approval' => 1]);

        $this->assertSame(3, $user->company_id);
        $this->assertSame(1, $user->admin_approval);
    }
}
