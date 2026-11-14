<?php

namespace Tests\Feature;

use App\Models\User;
use App\Support\CompanyDashboardAccess;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * The Company dashboard opens only for the people on their company's list.
 * Being an admin is not enough.
 */
class CompanyDashboardAccessTest extends TestCase
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
            ['id' => 1, 'company_id' => 1, 'name' => 'On the list'],
            ['id' => 2, 'company_id' => 1, 'name' => 'Admin, not on the list'],
            ['id' => 3, 'company_id' => 2, 'name' => 'Listed in another company'],
        ]);
        DB::table('company_dashboard_viewers')->insert([
            ['company_id' => 1, 'user_id' => 1, 'added_by' => 2],
            // A row for user 3 under company 1 must not let them in to company 2.
            ['company_id' => 1, 'user_id' => 3, 'added_by' => 2],
        ]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('company_dashboard_viewers');
        Schema::dropIfExists('users');
        parent::tearDown();
    }

    private function user(int $id): User
    {
        /** @var User $user */
        $user = User::withoutGlobalScopes()->findOrFail($id);

        return $user;
    }

    public function test_a_person_on_the_list_can_see_the_company_dashboard(): void
    {
        $this->assertTrue(CompanyDashboardAccess::allows($this->user(1)));
    }

    public function test_someone_not_on_the_list_cannot_even_as_an_admin(): void
    {
        // Admin or not, only list membership counts; the check never reads roles.
        $this->assertFalse(CompanyDashboardAccess::allows($this->user(2)));
    }

    public function test_the_list_is_per_company(): void
    {
        $this->assertFalse(CompanyDashboardAccess::allows($this->user(3)));
    }

    public function test_nobody_is_let_in_before_the_table_exists(): void
    {
        Schema::drop('company_dashboard_viewers');

        $this->assertFalse(CompanyDashboardAccess::allows($this->user(1)));
        $this->assertFalse(CompanyDashboardAccess::allows(null));
    }
}
