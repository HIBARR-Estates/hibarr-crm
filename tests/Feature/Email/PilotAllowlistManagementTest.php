<?php

namespace Tests\Feature\Email;

use App\Email\EmailFeature;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Company;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class PilotAllowlistManagementTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $admin;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->buildRolesSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        $this->admin = $this->makeEmailUser($this->company);
        $this->agent = $this->makeEmailUser($this->company);
        $this->grantAdmin($this->admin);

        $this->withoutMiddleware(HandleInertiaRequests::class);
    }

    public function test_admin_can_manage_the_list_before_being_allowlisted(): void
    {
        $this->signIn($this->admin);

        $this->get('/account/settings/email-pilot', $this->inertia())
            ->assertOk()
            ->assertJsonPath('component', 'Settings/EmailPilot');

        $this->postJson('/email/pilot-allowlist', [
            'scope' => 'user',
            'user_id' => $this->agent->id,
        ])->assertCreated()
            ->assertJsonPath('entries.0.user_id', $this->agent->id);

        $this->assertTrue(EmailPilotAllowlistEntry::allows($this->agent));
        $this->assertFalse(EmailPilotAllowlistEntry::allows($this->admin));

        $this->postJson('/email/pilot-allowlist', ['scope' => 'company'])
            ->assertCreated();

        $this->assertTrue(EmailPilotAllowlistEntry::allows($this->admin));
    }

    public function test_non_admin_cannot_manage_and_entries_stay_company_scoped(): void
    {
        $this->signIn($this->agent);
        $this->get('/account/settings/email-pilot')->assertStatus(403);
        $this->getJson('/email/pilot-allowlist')->assertStatus(403);

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();

        $outsiderCompany = $this->makeEmailCompany();
        $outsiderAdmin = $this->makeEmailUser($outsiderCompany);
        $this->grantAdmin($outsiderAdmin);
        $this->signIn($outsiderAdmin);

        // Even if the outsider is an admin elsewhere, addUser rejects other-company ids.
        try {
            app(\App\Email\Pilot\PilotAllowlist::class)->addUser($outsiderAdmin, $this->agent->id);
            $this->fail('Expected ValidationException for a foreign user id.');
        } catch (\Illuminate\Validation\ValidationException $exception) {
            $this->assertArrayHasKey('user_id', $exception->errors());
        }

        $this->assertSame(1, EmailPilotAllowlistEntry::withoutGlobalScopes()->count());
    }

    public function test_flag_off_answers_404_and_remove_is_company_scoped(): void
    {
        $entry = EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create([
            'added_by' => $this->admin->id,
        ]);

        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->signIn($this->admin);
        $this->get('/account/settings/email-pilot')->assertStatus(404);
        $this->deleteJson('/email/pilot-allowlist/'.$entry->id)->assertStatus(404);

        $this->setFeatureFlag(EmailFeature::FLAG, true);
        $this->deleteJson('/email/pilot-allowlist/'.$entry->id)
            ->assertOk()
            ->assertJsonPath('entries', []);

        $this->assertSame(0, EmailPilotAllowlistEntry::withoutGlobalScopes()->count());
    }

    public function test_candidates_exclude_already_listed_users(): void
    {
        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
        $this->signIn($this->admin);

        $items = $this->getJson('/email/pilot-allowlist/candidates?q='.urlencode($this->agent->email))
            ->assertOk()
            ->json('items');

        $this->assertSame([], $items);

        $fresh = $this->makeEmailUser($this->company);
        $found = $this->getJson('/email/pilot-allowlist/candidates?q='.urlencode($fresh->email))
            ->assertOk()
            ->json('items');

        $this->assertSame([$fresh->id], array_column($found, 'id'));
    }

    /** @return array<string, string> */
    private function inertia(): array
    {
        return ['X-Inertia' => 'true', 'Accept' => 'text/html, application/xhtml+xml'];
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }

    private function buildRolesSchema(): void
    {
        Schema::create('roles', function (Blueprint $table) {
            $table->increments('id');
            $table->string('name');
            $table->unsignedInteger('company_id')->nullable();
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->unsignedInteger('user_id');
            $table->unsignedInteger('role_id');
        });
    }

    private function grantAdmin(User $user): void
    {
        $roleId = DB::table('roles')->insertGetId([
            'name' => 'admin',
            'company_id' => $user->company_id,
        ]);

        DB::table('role_user')->insert([
            'user_id' => $user->id,
            'role_id' => $roleId,
        ]);
    }
}
