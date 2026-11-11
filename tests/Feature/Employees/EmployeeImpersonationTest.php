<?php

namespace Tests\Feature\Employees;

use App\Http\Controllers\EmployeeDirectoryController;
use App\Models\User;
use App\Services\EmployeeDirectoryService;
use App\Services\EmployeeImpersonationService;
use App\Support\KeycloakLogout;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class EmployeeImpersonationTest extends TestCase
{
    private int $companyId = 1;

    private int $otherCompanyId = 2;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        Config::set('cache.default', 'array');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::create('companies', function (Blueprint $table) {
            $table->increments('id');
            $table->string('company_name')->nullable();
            $table->timestamps();
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('password')->nullable();
            $table->string('status')->default('active');
            $table->string('login')->default('enable');
            $table->unsignedTinyInteger('admin_approval')->default(1);
            $table->timestamp('last_login')->nullable();
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
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('role_id');
            $table->primary(['user_id', 'role_id']);
        });

        Schema::create('teams', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('team_name');
            $table->timestamps();
        });

        Schema::create('designations', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name');
            $table->timestamps();
        });

        Schema::create('employee_details', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('employee_id')->nullable();
            $table->unsignedInteger('department_id')->nullable();
            $table->unsignedInteger('designation_id')->nullable();
            $table->timestamps();
        });

        DB::table('companies')->insert([
            ['id' => $this->companyId, 'company_name' => 'Acme', 'created_at' => now(), 'updated_at' => now()],
            ['id' => $this->otherCompanyId, 'company_name' => 'Other', 'created_at' => now(), 'updated_at' => now()],
        ]);

        $this->role('admin', 'Admin');
        $this->role('employee', 'Employee');
        $this->role('manager', 'Manager');
        $this->role('client', 'Client');

        session(['company' => (object) ['id' => $this->companyId]]);
    }

    protected function tearDown(): void
    {
        Schema::dropAllTables();
        parent::tearDown();
    }

    public function test_directory_filters_by_search_status_department_designation_and_role(): void
    {
        $admin = $this->user('Ada Admin', 'admin');
        $sales = $this->team('Sales');
        $support = $this->team('Support');
        $agent = $this->designation('Agent');
        $lead = $this->designation('Lead');

        $ada = $this->user('Ada Lovelace', 'employee', [
            'email' => 'ada@acme.test',
            'employee_id' => 'E-100',
            'department_id' => $sales,
            'designation_id' => $agent,
            'extra_role' => 'manager',
        ]);
        $this->user('Grace Hopper', 'employee', [
            'email' => 'grace@acme.test',
            'employee_id' => 'E-200',
            'department_id' => $support,
            'designation_id' => $lead,
        ]);
        $this->user('Inactive Ian', 'employee', [
            'status' => 'deactive',
            'department_id' => $sales,
        ]);
        $this->user('Other Co', 'employee', ['company_id' => $this->otherCompanyId]);
        $this->user('Client Cara', 'client');

        $directory = app(EmployeeDirectoryService::class);

        $names = fn (array $filters) => collect($directory->paginate($admin, $this->filters($filters))->items())
            ->pluck('name')
            ->all();

        $this->assertSame(['Ada Lovelace', 'Grace Hopper'], $names([]));
        $this->assertSame(['Ada Lovelace'], $names(['search' => 'ada@acme']));
        $this->assertSame(['Grace Hopper'], $names(['search' => 'E-200']));
        $this->assertSame(['Ada Lovelace'], $names(['department_id' => $sales]));
        $this->assertSame(['Grace Hopper'], $names(['designation_id' => $lead]));
        $this->assertSame(['Ada Lovelace'], $names(['role_id' => $this->roleId('manager')]));
        $this->assertSame(
            ['Ada Lovelace', 'Grace Hopper', 'Inactive Ian'],
            $names(['status' => 'all'])
        );
        $this->assertSame(['Inactive Ian'], $names(['status' => 'deactive']));
    }

    public function test_impersonate_is_withheld_for_self_admins_and_inactive_employees(): void
    {
        $admin = $this->user('Ada Admin', 'admin', ['extra_role' => 'employee']);
        $otherAdmin = $this->user('Other Admin', 'admin', ['extra_role' => 'employee']);
        $inactive = $this->user('Inactive Ian', 'employee', ['status' => 'deactive']);
        $locked = $this->user('Locked Lea', 'employee', ['login' => 'disable']);
        $open = $this->user('Open Opal', 'employee');

        $rows = collect(app(EmployeeDirectoryService::class)->paginate($admin, $this->filters(['status' => 'all']))->items())
            ->keyBy('name');

        $this->assertFalse($rows['Ada Admin']['can_impersonate']);
        $this->assertSame('self', $rows['Ada Admin']['impersonate_block']);
        $this->assertSame('admin', $rows['Other Admin']['impersonate_block']);
        $this->assertSame('inactive', $rows['Inactive Ian']['impersonate_block']);
        $this->assertSame('login_disabled', $rows['Locked Lea']['impersonate_block']);
        $this->assertTrue($rows['Open Opal']['can_impersonate']);

        $this->assertNotNull($inactive);
        $this->assertNotNull($locked);
        $this->assertNotNull($otherAdmin);
        $this->assertNotNull($open);
    }

    public function test_admin_can_impersonate_an_employee_and_return(): void
    {
        $admin = $this->user('Ada Admin', 'admin', ['password' => 'admin-secret']);
        $employee = $this->user('Grace Hopper', 'employee', ['password' => 'employee-secret']);
        $request = $this->bindRequest($admin);
        $request->session()->put(KeycloakLogout::REFRESH_TOKEN_SESSION_KEY, 'refresh-1');

        $controller = app(EmployeeDirectoryController::class);
        $response = $controller->store($request, $employee->id);

        $this->assertSame(route('dashboard'), $response->getTargetUrl());
        $this->assertSame($employee->id, Auth::id());
        $this->assertSame($admin->id, session(EmployeeImpersonationService::SESSION_ID));
        $this->assertFalse(session()->has('user'));
        $this->assertFalse(session()->has('user_roles'));
        $this->assertSame('employee-secret', session('password_hash_web'));
        $this->assertSame('refresh-1', session(KeycloakLogout::REFRESH_TOKEN_SESSION_KEY));
        $this->assertNull(DB::table('users')->where('id', $employee->id)->value('last_login'));

        $return = $controller->leave($request);

        $this->assertSame(route('settings-employees.index'), $return->getTargetUrl());
        $this->assertSame($admin->id, Auth::id());
        $this->assertFalse(session()->has(EmployeeImpersonationService::SESSION_ID));
        $this->assertSame('admin-secret', session('password_hash_web'));
        $this->assertSame('refresh-1', session(KeycloakLogout::REFRESH_TOKEN_SESSION_KEY));
    }

    public function test_impersonation_is_refused_for_the_cases_that_would_break_the_session(): void
    {
        $admin = $this->user('Ada Admin', 'admin');
        $employee = $this->user('Grace Hopper', 'employee');
        $inactive = $this->user('Inactive Ian', 'employee', ['status' => 'deactive']);
        $outsider = $this->user('Other Co', 'employee', ['company_id' => $this->otherCompanyId]);
        $staff = $this->user('Staff Sam', 'employee');
        $controller = app(EmployeeDirectoryController::class);

        $this->assertHttpStatus(403, fn () => $controller->store($this->bindRequest($staff), $employee->id));
        $this->assertSame($staff->id, Auth::id());

        $this->assertHttpStatus(403, fn () => $controller->store($this->bindRequest($admin), $admin->id));
        $this->assertHttpStatus(403, fn () => $controller->store($this->bindRequest($admin), $inactive->id));
        $this->assertSame($admin->id, Auth::id());

        $this->assertHttpStatus(404, fn () => $controller->store($this->bindRequest($admin), $outsider->id));

        $request = $this->bindRequest($admin);
        $controller->store($request, $employee->id);
        $this->assertHttpStatus(403, fn () => $controller->store($request, $staff->id));
        $this->assertSame($employee->id, Auth::id());
    }

    public function test_leaving_without_an_impersonation_is_refused(): void
    {
        $employee = $this->user('Grace Hopper', 'employee');

        $this->assertHttpStatus(
            403,
            fn () => app(EmployeeDirectoryController::class)->leave($this->bindRequest($employee))
        );
    }

    public function test_only_an_admin_can_open_the_directory(): void
    {
        $admin = $this->user('Ada Admin', 'admin');
        $employee = $this->user('Grace Hopper', 'employee', ['email' => 'grace@acme.test']);
        $controller = app(EmployeeDirectoryController::class);

        $this->assertHttpStatus(403, fn () => $controller->index($this->bindRequest($employee)));

        $request = $this->bindRequest($admin);
        $request->headers->set('X-Inertia', 'true');
        $page = $controller->index($request)->toResponse($request)->getData(true);

        $this->assertSame('Settings/Employees/Index', $page['component']);
        $this->assertSame(['Grace Hopper'], collect($page['props']['employees']['data'])->pluck('name')->all());
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function filters(array $overrides = []): array
    {
        return array_merge([
            'search' => '',
            'status' => 'active',
            'department_id' => null,
            'designation_id' => null,
            'role_id' => null,
            'per_page' => 25,
        ], $overrides);
    }

    private function bindRequest(User $user): Request
    {
        $request = Request::create('/account/settings/employees', 'POST');
        $store = session()->driver();

        if (! $store->isStarted()) {
            $store->start();
        }

        $request->setLaravelSession($store);
        $request->setUserResolver(fn ($guard = null) => Auth::guard($guard)->user());
        Auth::guard()->setUser($user);
        $this->app->instance('request', $request);

        return $request;
    }

    private function assertHttpStatus(int $status, callable $callback): void
    {
        try {
            $callback();
            $this->fail("Expected HTTP {$status}.");
        } catch (ModelNotFoundException) {
            $this->assertSame(404, $status);
        } catch (HttpException $exception) {
            $this->assertSame($status, $exception->getStatusCode());
        }
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function user(string $name, string $role, array $extra = []): User
    {
        $companyId = $extra['company_id'] ?? $this->companyId;

        $id = DB::table('users')->insertGetId([
            'company_id' => $companyId,
            'name' => $name,
            'email' => $extra['email'] ?? strtolower(str_replace(' ', '.', $name)).'@acme.test',
            'password' => $extra['password'] ?? 'secret',
            'status' => $extra['status'] ?? 'active',
            'login' => $extra['login'] ?? 'enable',
            'admin_approval' => $extra['admin_approval'] ?? 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $this->attach($id, $role, $companyId);

        if (isset($extra['extra_role'])) {
            $this->attach($id, $extra['extra_role'], $companyId);
        }

        if ($role === 'employee' || ($extra['extra_role'] ?? null) === 'employee') {
            DB::table('employee_details')->insert([
                'company_id' => $companyId,
                'user_id' => $id,
                'employee_id' => $extra['employee_id'] ?? null,
                'department_id' => $extra['department_id'] ?? null,
                'designation_id' => $extra['designation_id'] ?? null,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        return User::withoutGlobalScopes()->findOrFail($id);
    }

    private function attach(int $userId, string $role, int $companyId): void
    {
        $roleId = DB::table('roles')
            ->where('company_id', $companyId)
            ->where('name', $role)
            ->value('id');

        DB::table('role_user')->insert([
            'user_id' => $userId,
            'role_id' => $roleId,
        ]);
    }

    private function role(string $name, string $displayName): void
    {
        foreach ([$this->companyId, $this->otherCompanyId] as $companyId) {
            DB::table('roles')->insert([
                'company_id' => $companyId,
                'name' => $name,
                'display_name' => $displayName,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    private function roleId(string $name): int
    {
        return (int) DB::table('roles')
            ->where('company_id', $this->companyId)
            ->where('name', $name)
            ->value('id');
    }

    private function team(string $name): int
    {
        return DB::table('teams')->insertGetId([
            'company_id' => $this->companyId,
            'team_name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    private function designation(string $name): int
    {
        return DB::table('designations')->insertGetId([
            'company_id' => $this->companyId,
            'name' => $name,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
