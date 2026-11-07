<?php

namespace Tests\Feature;

use App\Http\Controllers\CompanyDashboardAccessController;
use App\Http\Controllers\DashboardV2Controller;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Mockery;
use ReflectionClass;
use ReflectionMethod;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * The list's management endpoints and the dashboard gate that reads it.
 *
 * Like the other dashboard tests, controllers are built without their
 * constructor (it renders view state these tests don't need) and the app's
 * user()/company()/user_roles() helpers are driven through the session.
 */
class CompanyDashboardAccessControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('company_dashboard_viewers');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->string('name')->nullable();
            $table->string('email')->nullable();
            $table->string('image')->nullable();
            $table->string('status')->default('active');
            $table->timestamps();
        });

        Schema::create('company_dashboard_viewers', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();
            $table->unique(['company_id', 'user_id']);
        });

        DB::table('users')->insert([
            ['id' => 1, 'company_id' => 1, 'name' => 'Admin', 'email' => 'admin@one.test'],
            ['id' => 2, 'company_id' => 1, 'name' => 'Colleague', 'email' => 'colleague@one.test'],
            ['id' => 3, 'company_id' => 2, 'name' => 'Other company', 'email' => 'someone@two.test'],
        ]);

        $this->signInAs(1, ['admin', 'employee']);
    }

    protected function tearDown(): void
    {
        Mockery::close();
        Schema::dropIfExists('company_dashboard_viewers');
        Schema::dropIfExists('users');
        parent::tearDown();
    }

    /** @param list<string> $roles */
    private function signInAs(int $userId, array $roles): void
    {
        // Every permission() check answers "none": the Company view must not
        // depend on any permission, only on the list.
        $user = Mockery::mock(User::class)->makePartial();
        $user->setRawAttributes((array) DB::table('users')->where('id', $userId)->first());
        $user->shouldReceive('permission')->andReturn(false);

        session([
            'user' => $user,
            'company' => (object) ['id' => (int) $user->company_id],
            'user_roles' => $roles,
        ]);
    }

    private function controller(): CompanyDashboardAccessController
    {
        return (new ReflectionClass(CompanyDashboardAccessController::class))->newInstanceWithoutConstructor();
    }

    /** @return list<string> */
    private function availableViews(): array
    {
        $method = new ReflectionMethod(DashboardV2Controller::class, 'availableViews');
        $method->setAccessible(true);

        return $method->invoke((new ReflectionClass(DashboardV2Controller::class))->newInstanceWithoutConstructor());
    }

    public function test_only_admins_may_manage_the_list(): void
    {
        CompanyDashboardAccessController::ensureAdmin();

        $this->signInAs(2, ['employee']);

        $this->expectException(HttpException::class);
        CompanyDashboardAccessController::ensureAdmin();
    }

    public function test_adding_a_colleague_puts_them_on_the_list_once(): void
    {
        $request = Request::create('/', 'POST', ['user_id' => 2]);

        $first = $this->controller()->store($request);
        $this->controller()->store($request);

        $this->assertSame(1, DB::table('company_dashboard_viewers')->where('user_id', 2)->count());
        $row = DB::table('company_dashboard_viewers')->where('user_id', 2)->first();
        $this->assertSame(1, (int) $row->company_id);
        $this->assertSame(1, (int) $row->added_by);
        $this->assertSame([2], array_column($first['viewers'], 'user_id'));
    }

    public function test_someone_from_another_company_cannot_be_added(): void
    {
        $this->expectException(ValidationException::class);

        try {
            $this->controller()->store(Request::create('/', 'POST', ['user_id' => 3]));
        } finally {
            $this->assertSame(0, DB::table('company_dashboard_viewers')->count());
        }
    }

    public function test_removing_only_touches_this_companys_list(): void
    {
        DB::table('company_dashboard_viewers')->insert([
            ['company_id' => 1, 'user_id' => 2],
            ['company_id' => 2, 'user_id' => 2],
        ]);

        $response = $this->controller()->destroy(2);

        $this->assertSame(0, DB::table('company_dashboard_viewers')->where('company_id', 1)->count());
        $this->assertSame(1, DB::table('company_dashboard_viewers')->where('company_id', 2)->count());
        $this->assertSame([], $response['viewers']);
    }

    public function test_the_company_view_opens_only_for_people_on_the_list(): void
    {
        // An admin with no list entry gets no Company view.
        $this->assertNotContains('leadership', $this->availableViews());

        DB::table('company_dashboard_viewers')->insert(['company_id' => 1, 'user_id' => 2]);

        $this->signInAs(2, ['employee']);
        $this->assertContains('leadership', $this->availableViews());
    }
}
