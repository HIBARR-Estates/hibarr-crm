<?php

namespace Tests\Unit\Support;

use App\Models\User;
use App\Support\CallAccess;
use Mockery;
use Tests\TestCase;

/**
 * Who may make calls, manage calls and play a recording.
 *
 * manage_calls is its own grant: being allowed to make calls (even `all`)
 * must never let someone play colleagues' recordings.
 */
class CallAccessTest extends TestCase
{
    protected function tearDown(): void
    {
        Mockery::close();
        parent::tearDown();
    }

    public function test_admins_make_and_manage_calls(): void
    {
        $admin = $this->user(99, [], admin: true);

        $this->assertTrue(CallAccess::canMakeCalls($admin));
        $this->assertTrue(CallAccess::canManageCalls($admin));
        $this->assertTrue(CallAccess::canPlayRecording($admin, 100));
    }

    public function test_an_agent_plays_only_their_own_recordings(): void
    {
        $agent = $this->user(99, ['make_softphone_calls' => 'added']);

        $this->assertTrue(CallAccess::canPlayRecording($agent, 99));
        $this->assertFalse(CallAccess::canPlayRecording($agent, 100));
        $this->assertFalse(CallAccess::canPlayRecording($agent, null));
        $this->assertFalse(CallAccess::canManageCalls($agent));
    }

    public function test_make_softphone_calls_all_is_not_call_management(): void
    {
        $lineManager = $this->user(99, ['make_softphone_calls' => 'all']);

        $this->assertFalse(CallAccess::canManageCalls($lineManager));
        $this->assertFalse(CallAccess::canPlayRecording($lineManager, 100));
    }

    public function test_a_call_manager_plays_every_recording_without_call_permission(): void
    {
        $manager = $this->user(99, ['manage_calls' => 'all']);

        $this->assertFalse(CallAccess::canMakeCalls($manager));
        $this->assertTrue(CallAccess::canManageCalls($manager));
        $this->assertTrue(CallAccess::canPlayRecording($manager, 100));
    }

    public function test_someone_without_call_permission_plays_nothing_even_their_own(): void
    {
        $viewer = $this->user(99, []);

        $this->assertFalse(CallAccess::canPlayRecording($viewer, 99));
        $this->assertFalse(CallAccess::canPlayRecording(null, 99));
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function user(int $id, array $permissions, bool $admin = false): User
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = $id;
        $user->shouldReceive('permission')->andReturnUsing(fn (string $name) => $permissions[$name] ?? 'none');
        $user->shouldReceive('hasRole')->andReturnUsing(fn (string $role) => $admin && $role === 'admin');

        return $user;
    }
}
