<?php

namespace Tests\Feature\RolePermissions;

use App\Jobs\ResyncUserPermissionsJob;
use App\Models\User;
use App\Notifications\UserPermissionResyncCompleted;
use App\Services\ResyncUserPermissionsService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Schema;
use Mockery;
use ReflectionProperty;
use Tests\TestCase;

/**
 * Covers the tenant scoping and skip rules of the "resync all user
 * permissions" bulk rewrite (HIB-1728).
 */
class ResyncUserPermissionsTest extends TestCase
{
    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    private const ADMIN_ID = 99;

    /** The one permission under test; type 3 in the template, 5 in the drifted rows. */
    private const PERMISSION_ID = 1;

    private const TEMPLATE_TYPE = 3;

    private const DRIFTED_TYPE = 5;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');
        Config::set('queue.default', 'sync');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->resetSchema();
        $this->createMinimalSchema();
    }

    protected function tearDown(): void
    {
        Mockery::close();
        $this->resetSchema();

        parent::tearDown();
    }

    public function test_non_admin_cannot_trigger_a_resync(): void
    {
        Queue::fake();

        $this->withoutMiddleware();
        $this->actingAsUser('none');

        $this->postJson('/account/settings/role-permissions/resync-all-users')
            ->assertForbidden();

        Queue::assertNothingPushed();
    }

    public function test_resync_is_dispatched_for_the_actors_own_company_only(): void
    {
        Queue::fake();

        $this->withoutMiddleware();
        $this->actingAsUser('all');

        $response = $this->postJson('/account/settings/role-permissions/resync-all-users');

        $response->assertOk();
        $response->assertJsonPath('status', 'success');

        Queue::assertPushed(ResyncUserPermissionsJob::class, function ($job): bool {
            return $this->readPrivate($job, 'companyId') === self::COMPANY_ID
                && $this->readPrivate($job, 'triggeredByUserId') === self::ADMIN_ID;
        });

        $this->assertSame(
            1,
            (int) DB::table('user_activities')
                ->where('user_id', self::ADMIN_ID)
                ->where('company_id', self::COMPANY_ID)
                ->count(),
            'A bulk permission rewrite must leave an audit entry naming the actor.'
        );
    }

    public function test_resync_leaves_another_companys_users_untouched(): void
    {
        $employee = $this->insertUser(self::COMPANY_ID);
        $this->attachRole($employee, $this->insertRole(self::COMPANY_ID, 'employee'));

        $otherEmployee = $this->insertUser(self::OTHER_COMPANY_ID);
        $this->attachRole($otherEmployee, $this->insertRole(self::OTHER_COMPANY_ID, 'employee'));

        $this->insertTemplatePermission();
        $this->insertDriftedPermissionRow($employee);
        $this->insertDriftedPermissionRow($otherEmployee);

        $counts = $this->resync(self::COMPANY_ID);

        $this->assertSame(1, $counts['synced']);
        $this->assertSame(
            self::TEMPLATE_TYPE,
            $this->userPermissionType($employee),
            'Company 1 user should be rebuilt from their role template.'
        );
        $this->assertSame(
            self::DRIFTED_TYPE,
            $this->userPermissionType($otherEmployee),
            'Company 2 user must not be touched.'
        );
    }

    public function test_users_with_customised_permissions_are_skipped(): void
    {
        $customised = $this->insertUser(self::COMPANY_ID, customisedPermissions: 1);
        $this->attachRole($customised, $this->insertRole(self::COMPANY_ID, 'employee'));

        $this->insertTemplatePermission();
        $this->insertDriftedPermissionRow($customised);

        $counts = $this->resync(self::COMPANY_ID);

        $this->assertSame(0, $counts['synced']);
        $this->assertSame(
            self::DRIFTED_TYPE,
            $this->userPermissionType($customised),
            'A deliberate per-user change must survive the resync.'
        );
    }

    public function test_users_without_a_role_are_counted_as_skipped(): void
    {
        $roleless = $this->insertUser(self::COMPANY_ID);

        $counts = $this->resync(self::COMPANY_ID);

        $this->assertSame(0, $counts['synced']);
        $this->assertSame(1, $counts['skipped_no_role']);
        $this->assertSame(
            0,
            (int) DB::table('user_permissions')->where('user_id', $roleless)->count()
        );
    }

    public function test_admin_users_are_skipped(): void
    {
        $admin = $this->insertUser(self::COMPANY_ID);
        $this->attachRole($admin, $this->insertRole(self::COMPANY_ID, 'admin'));

        $this->insertTemplatePermission();
        $this->insertDriftedPermissionRow($admin);

        $counts = $this->resync(self::COMPANY_ID);

        $this->assertSame(1, $counts['skipped_admin']);
        $this->assertSame(0, $counts['synced']);
        $this->assertSame(
            self::DRIFTED_TYPE,
            $this->userPermissionType($admin),
            'Resync must not rewrite admin permissions — addMissingAdminPermission owns them.'
        );
    }

    public function test_resynced_users_are_marked_synced_and_customised_users_are_not(): void
    {
        $employee = $this->insertUser(self::COMPANY_ID);
        $this->attachRole($employee, $this->insertRole(self::COMPANY_ID, 'employee'));

        $customised = $this->insertUser(self::COMPANY_ID, customisedPermissions: 1);
        $this->attachRole($customised, $this->insertRole(self::COMPANY_ID, 'employee'));

        $this->insertTemplatePermission();

        $this->resync(self::COMPANY_ID);

        $this->assertSame(1, $this->permissionSync($employee));
        $this->assertSame(
            0,
            $this->permissionSync($customised),
            'A skipped user must stay unsynced so the scheduler retries them.'
        );
    }

    public function test_job_skips_the_rewrite_when_a_resync_is_already_running(): void
    {
        Notification::fake();

        $employee = $this->insertUser(self::COMPANY_ID);
        $this->attachRole($employee, $this->insertRole(self::COMPANY_ID, 'employee'));

        $this->insertTemplatePermission();
        $this->insertDriftedPermissionRow($employee);

        $held = cache()->lock(ResyncUserPermissionsJob::lockName(self::COMPANY_ID), 60);
        $this->assertTrue($held->get(), 'Precondition: the lock must be held by the test.');

        try {
            (new ResyncUserPermissionsJob(self::COMPANY_ID, $employee))
                ->handle(app(ResyncUserPermissionsService::class));
        } finally {
            $held->release();
        }

        $this->assertSame(
            self::DRIFTED_TYPE,
            $this->userPermissionType($employee),
            'A second concurrent resync must not rewrite anything.'
        );

        Notification::assertSentTo(
            User::withoutGlobalScopes()->find($employee),
            UserPermissionResyncCompleted::class,
            fn (UserPermissionResyncCompleted $notification): bool => $notification->toArray(null)['counts'] === null
        );
    }

    public function test_job_notifies_the_actor_with_the_counts(): void
    {
        Notification::fake();

        $actor = $this->insertUser(self::COMPANY_ID);
        $this->attachRole($actor, $this->insertRole(self::COMPANY_ID, 'employee'));
        $this->insertTemplatePermission();

        (new ResyncUserPermissionsJob(self::COMPANY_ID, $actor))
            ->handle(app(ResyncUserPermissionsService::class));

        Notification::assertSentTo(
            User::withoutGlobalScopes()->find($actor),
            UserPermissionResyncCompleted::class,
            function (UserPermissionResyncCompleted $notification): bool {
                return $notification->toArray(null)['counts']['synced'] === 1;
            }
        );
    }

    /**
     * @return array{synced: int, skipped_no_role: int, skipped_admin: int}
     */
    private function resync(int $companyId): array
    {
        return app(ResyncUserPermissionsService::class)->resync($companyId);
    }

    private function actingAsUser(string $manageRolePermissionSetting): void
    {
        /** @var User&\Mockery\MockInterface $user */
        $user = Mockery::mock(User::class)->makePartial();
        $user->id = self::ADMIN_ID;
        $user->company_id = self::COMPANY_ID;
        $user->shouldReceive('permission')
            ->with('manage_role_permission_setting')
            ->andReturn($manageRolePermissionSetting);
        $user->shouldReceive('permission')->andReturn('all');

        $this->actingAs($user);
        session([
            'user' => $user,
            'company' => (object) ['id' => self::COMPANY_ID],
            'user_roles' => ['admin'],
        ]);
    }

    private function insertUser(int $companyId, int $customisedPermissions = 0): int
    {
        static $sequence = 0;
        $sequence++;

        return (int) DB::table('users')->insertGetId([
            'company_id' => $companyId,
            'name' => "User {$sequence}",
            'email' => "user{$sequence}@example.com",
            'status' => 'active',
            'customised_permissions' => $customisedPermissions,
            'permission_sync' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function insertRole(int $companyId, string $name): int
    {
        return (int) DB::table('roles')->insertGetId([
            'company_id' => $companyId,
            'name' => $name,
            'display_name' => ucfirst($name),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function attachRole(int $userId, int $roleId): void
    {
        DB::table('role_user')->insert([
            'user_id' => $userId,
            'role_id' => $roleId,
        ]);
    }

    private function insertTemplatePermission(?int $roleId = null): void
    {
        DB::table('permissions')->insert([
            'id' => self::PERMISSION_ID,
            'name' => 'view_deals',
            'module_id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        DB::table('permission_role')->insert([
            'permission_id' => self::PERMISSION_ID,
            'role_id' => $roleId ?? (int) DB::table('roles')->min('id'),
            'permission_type_id' => self::TEMPLATE_TYPE,
        ]);
    }

    private function insertDriftedPermissionRow(int $userId): void
    {
        DB::table('user_permissions')->insert([
            'user_id' => $userId,
            'permission_id' => self::PERMISSION_ID,
            'permission_type_id' => self::DRIFTED_TYPE,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function userPermissionType(int $userId): int
    {
        return (int) DB::table('user_permissions')
            ->where('user_id', $userId)
            ->where('permission_id', self::PERMISSION_ID)
            ->value('permission_type_id');
    }

    private function permissionSync(int $userId): int
    {
        return (int) DB::table('users')->where('id', $userId)->value('permission_sync');
    }

    private function readPrivate(object $object, string $property): mixed
    {
        $reflection = new ReflectionProperty($object, $property);
        $reflection->setAccessible(true);

        return $reflection->getValue($object);
    }

    private function resetSchema(): void
    {
        Schema::dropIfExists('user_permissions');
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('users');
        Schema::dropIfExists('companies');
        Schema::dropIfExists('user_activities');
    }

    private function createMinimalSchema(): void
    {
        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('status')->default('active');
            $table->boolean('customised_permissions')->default(false);
            $table->boolean('permission_sync')->default(false);
            $table->timestamps();
        });

        Schema::create('roles', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('display_name')->nullable();
            $table->timestamps();
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('role_id');
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->unsignedInteger('module_id')->nullable();
            $table->string('display_name')->nullable();
            $table->timestamps();
        });

        Schema::create('permission_types', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('permission_role', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('role_id');
            $table->unsignedInteger('permission_type_id');
        });

        Schema::create('user_permissions', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('permission_id');
            $table->unsignedInteger('permission_type_id');
            $table->timestamps();
        });

        Schema::create('user_activities', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->text('activity');
            $table->timestamp('created_at')->nullable();
            $table->timestamp('updated_at')->nullable();
        });

        DB::table('companies')->insert([
            ['id' => self::COMPANY_ID, 'company_name' => 'Acme', 'status' => 'active'],
            ['id' => self::OTHER_COMPANY_ID, 'company_name' => 'Globex', 'status' => 'active'],
        ]);

        // The acting admin. A real row (not just a mock) because
        // UserActivityObserver resolves company_id from the persisted user.
        DB::table('users')->insert([
            'id' => self::ADMIN_ID,
            'company_id' => self::COMPANY_ID,
            'name' => 'Admin',
            'email' => 'admin@example.com',
            'status' => 'active',
            'customised_permissions' => 1,
            'permission_sync' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
