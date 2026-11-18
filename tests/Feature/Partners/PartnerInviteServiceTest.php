<?php

namespace Tests\Feature\Partners;

use App\Contracts\KeycloakIdentityClient;
use App\Http\Controllers\PartnerAdminController;
use App\Exceptions\OlKeycloakException;
use App\Models\LeadAgent;
use App\Models\Permission;
use App\Models\PermissionType;
use App\Models\Role;
use App\Models\Social;
use App\Models\User;
use App\Notifications\PartnerInvited;
use App\Services\Keycloak\FakeOlKeycloakIdentityClient;
use App\Services\PartnerInviteService;
use App\Support\PartnerRole;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class PartnerInviteServiceTest extends TestCase
{
    use SetsFeatureFlags;

    private FakeOlKeycloakIdentityClient $keycloak;

    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');
        DB::purge('sqlite');
        DB::reconnect('sqlite');

        $this->createSchema();
        LeadAgent::unsetEventDispatcher();

        $this->keycloak = new FakeOlKeycloakIdentityClient;
        $this->app->instance(KeycloakIdentityClient::class, $this->keycloak);

        Notification::fake();

        $this->admin = $this->insertUser('Admin', 'admin@example.test');
        $adminRole = new Role;
        $adminRole->name = 'admin';
        $adminRole->company_id = 1;
        $adminRole->display_name = 'Admin';
        $adminRole->saveQuietly();
        DB::table('role_user')->insert(['user_id' => $this->admin->id, 'role_id' => $adminRole->id]);

        $employeeRole = new Role;
        $employeeRole->name = 'employee';
        $employeeRole->company_id = 1;
        $employeeRole->display_name = 'Employee';
        $employeeRole->saveQuietly();

        Permission::query()->create(['name' => 'view_partner_dashboard']);
        Permission::query()->create(['name' => 'view_lead']);
    }

    public function test_split_name_uses_first_token_and_rest(): void
    {
        $this->assertSame(['Ada', 'Lovelace'], PartnerInviteService::splitName('Ada Lovelace'));
        $this->assertSame(['Madonna', 'Madonna'], PartnerInviteService::splitName('Madonna'));
    }

    public function test_invite_with_flag_on_provisions_and_links_social(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $service = app(PartnerInviteService::class);
        $result = $service->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertTrue($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $user->partner_invite_status);
        $this->assertNotNull($user->partner_invited_at);

        $social = Social::where('user_id', $user->id)->first();
        $this->assertNotNull($social);
        $this->assertSame('keycloak', $social->social_service);
        $this->assertSame($this->keycloak->idForEmail('ada@example.test'), $social->social_id);

        $this->assertTrue($result['agent']->can_resend);
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $result['agent']->partner_invite_status);

        Notification::assertSentTo($user, PartnerInvited::class);
        $this->assertCount(1, $this->keycloak->actionsEmails);
    }

    public function test_invite_is_idempotent_when_keycloak_user_already_exists(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $existing = $this->keycloak->provision('ada@example.test', 'Ada', 'Lovelace', false);

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertTrue($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertSame($existing->keycloakUserId, Social::where('user_id', $user->id)->value('social_id'));
        $this->assertFalse(
            $this->keycloak->provision('ada@example.test', 'Ada', 'Lovelace', false)->created
        );
    }

    public function test_invite_keeps_local_user_when_provision_fails(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $this->keycloak->failNextProvision(new OlKeycloakException('Keycloak down'));

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertFalse($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertSame(PartnerInviteService::STATUS_FAILED, $user->partner_invite_status);
        $this->assertNull(Social::where('user_id', $user->id)->first());
        $this->assertTrue($result['agent']->can_resend);
        Notification::assertNothingSent();
    }

    public function test_resend_uses_actions_email_when_identity_exists(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->keycloak->actionsEmails = [];

        $result = app(PartnerInviteService::class)->resend($invite['agent']->fresh(['user', 'user.roles']), $this->admin);

        $this->assertTrue($result['ok']);
        $this->assertCount(1, $this->keycloak->actionsEmails);
    }

    public function test_destroy_disables_keycloak_best_effort(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $agent = $invite['agent']->fresh(['user']);
        app(PartnerInviteService::class)->destroy($agent);

        $this->assertFalse((bool) $agent->fresh()->is_partner);
        $this->assertSame(['enabled' => false], $this->keycloak->updates[0]['patch']);
    }

    public function test_flag_off_skips_keycloak_and_still_emails(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, false);

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertTrue($result['invite_sent']);
        $user = User::withoutGlobalScopes()->where('email', 'ada@example.test')->firstOrFail();
        $this->assertNull($user->partner_invite_status);
        $this->assertNull(Social::where('user_id', $user->id)->first());
        $this->assertSame([], $this->keycloak->actionsEmails);
        Notification::assertSentTo($user, PartnerInvited::class);
    }

    public function test_staff_flagged_as_partner_cannot_resend(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertUser('Staff', 'staff@example.test');
        $adminRole = Role::withoutGlobalScopes()->where('name', 'admin')->first();
        $staff->attachRole($adminRole->id);

        $agent = LeadAgent::create([
            'company_id' => 1,
            'user_id' => $staff->id,
            'status' => 'enabled',
            'is_partner' => true,
            'added_by' => $this->admin->id,
        ]);

        $this->assertFalse(PartnerRole::isPartnerOnly($staff->load('roles')));
        $this->assertFalse(app(PartnerInviteService::class)->canResend($agent->load(['user', 'user.roles'])));
    }

    public function test_lifecycle_disable_on_deactive(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        // Through a real save: the UserObserver syncs after the write.
        $this->saveAndSync($invite['agent']->user, ['status' => 'deactive']);

        $this->assertNotEmpty($this->keycloak->updates);
        $this->assertFalse($this->keycloak->updates[array_key_last($this->keycloak->updates)]['patch']['enabled']);
    }

    public function test_lifecycle_reenables_identity_when_partner_is_reactivated(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $user = $invite['agent']->user;
        $this->saveAndSync($user, ['status' => 'deactive']);
        $this->saveAndSync($user, ['status' => 'active']);

        $this->assertCount(2, $this->keycloak->updates);
        $this->assertTrue($this->keycloak->updates[1]['patch']['enabled']);
    }

    public function test_lifecycle_does_not_reenable_a_removed_partner(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $user = $invite['agent']->user;
        $this->saveAndSync($user, ['status' => 'deactive']);
        app(PartnerInviteService::class)->destroy($invite['agent']->fresh(['user', 'user.roles']));
        $updatesBefore = count($this->keycloak->updates);

        $this->saveAndSync($user, ['status' => 'active']);

        $this->assertCount($updatesBefore, $this->keycloak->updates);
    }

    public function test_lifecycle_pushes_email_changes_for_partners(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->saveAndSync($invite['agent']->user, ['email' => 'Ada.New@Example.test']);

        $this->assertSame(['email' => 'ada.new@example.test'], $this->keycloak->updates[0]['patch']);
    }

    public function test_lifecycle_never_touches_staff_who_share_the_identity_realm(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertStaffWithKeycloakLogin();

        $this->saveAndSync($staff, ['status' => 'deactive']);
        $this->saveAndSync($staff, ['email' => 'renamed@example.test']);

        $this->assertSame([], $this->keycloak->updates);
    }

    public function test_lifecycle_is_not_sent_when_the_save_rolls_back(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $user = $invite['agent']->user;

        try {
            DB::transaction(function () use ($user) {
                $this->saveAndSync($user, ['status' => 'deactive']);

                throw new \RuntimeException('roll back');
            });
        } catch (\RuntimeException) {
        }

        $this->assertSame([], $this->keycloak->updates);
        $this->assertSame('active', User::withoutGlobalScopes()->find($user->id)->status);
    }

    public function test_removing_a_staff_partner_leaves_their_identity_alone(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertStaffWithKeycloakLogin();
        $agent = LeadAgent::create([
            'company_id' => 1,
            'user_id' => $staff->id,
            'status' => 'enabled',
            'is_partner' => true,
            'added_by' => $this->admin->id,
        ]);

        app(PartnerInviteService::class)->destroy($agent->load('user'));

        $this->assertFalse((bool) $agent->fresh()->is_partner);
        $this->assertSame([], $this->keycloak->updates);
    }

    public function test_resend_is_refused_once_the_invitation_was_accepted(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $staleAgent = $invite['agent']->fresh(['user', 'user.roles']);
        $this->keycloak->actionsEmails = [];

        // The partner signs in after the roster was loaded.
        DB::table('users')->where('id', $staleAgent->user_id)
            ->update(['partner_invite_status' => PartnerInviteService::STATUS_ACCEPTED]);

        $result = app(PartnerInviteService::class)->resend($staleAgent, $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_resend_accepted'), $result['message']);
        $this->assertSame([], $this->keycloak->actionsEmails);
        $this->assertSame(
            PartnerInviteService::STATUS_ACCEPTED,
            DB::table('users')->where('id', $staleAgent->user_id)->value('partner_invite_status'),
        );
    }

    public function test_accepted_is_never_moved_back_by_a_late_invite(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $user = $invite['agent']->user;

        app(PartnerInviteService::class)->markAccepted($user);
        $this->assertSame(PartnerInviteService::STATUS_ACCEPTED, $user->partner_invite_status);

        $method = new \ReflectionMethod(PartnerInviteService::class, 'setInviteStatus');
        $method->setAccessible(true);
        $method->invoke(app(PartnerInviteService::class), $user, PartnerInviteService::STATUS_INVITED);

        $this->assertSame(
            PartnerInviteService::STATUS_ACCEPTED,
            DB::table('users')->where('id', $user->id)->value('partner_invite_status'),
        );
        $this->assertSame(PartnerInviteService::STATUS_ACCEPTED, $user->partner_invite_status);
    }

    public function test_nothing_is_provisioned_for_a_partner_removed_before_enrolment(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, false);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $agent = $invite['agent']->fresh(['user', 'user.roles']);

        // Removed in the meantime; provisioning is switched on afterwards.
        DB::table('lead_agents')->where('id', $agent->id)->update(['is_partner' => false]);
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $result = app(PartnerInviteService::class)->resend($agent, $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_removed_while_inviting'), $result['message']);
        $this->assertNull($this->keycloak->idForEmail('ada@example.test'));
        $this->assertNull(Social::where('user_id', $agent->user_id)->first());
    }

    public function test_resend_failure_message_is_a_translated_string(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $this->keycloak->failNextProvision(new OlKeycloakException('Keycloak down'));
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $this->assertSame(__('pages.partners.msg_enrolment_failed_created'), $invite['message']);

        $this->keycloak->failNextProvision(new OlKeycloakException('Still down'));
        $result = app(PartnerInviteService::class)->resend($invite['agent']->fresh(['user', 'user.roles']), $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_enrolment_failed_retry'), $result['message']);
        $this->assertStringNotContainsString('pages.partners', $result['message']);
    }

    public function test_presented_agent_keeps_company_so_the_invite_email_resolves_it(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertSame(1, (int) $result['agent']->user->company_id);
        $this->assertNotNull($result['agent']->user->company);
    }

    public function test_decorating_a_loaded_roster_row_runs_no_queries(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $agent = LeadAgent::query()
            ->withCount('referredLeads')
            ->with(PartnerInviteService::AGENT_RELATIONS)
            ->findOrFail($invite['agent']->id);

        DB::flushQueryLog();
        DB::enableQueryLog();
        app(PartnerInviteService::class)->decorate($agent);
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([], $queries);
        $this->assertTrue($agent->can_resend);
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $agent->partner_invite_status);
    }

    public function test_signing_in_after_a_failed_enrolment_counts_as_accepted(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $this->keycloak->failNextProvision(new OlKeycloakException('Keycloak down'));
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $user = $invite['agent']->user;
        $this->assertSame(PartnerInviteService::STATUS_FAILED, $user->partner_invite_status);

        app(PartnerInviteService::class)->markAccepted($user);

        $this->assertSame(
            PartnerInviteService::STATUS_ACCEPTED,
            DB::table('users')->where('id', $user->id)->value('partner_invite_status'),
        );
    }

    public function test_signing_in_leaves_accounts_without_an_invite_status_alone(): void
    {
        $user = $this->insertUser('Legacy', 'legacy@example.test');

        app(PartnerInviteService::class)->markAccepted($user);

        $this->assertNull(DB::table('users')->where('id', $user->id)->value('partner_invite_status'));
    }

    public function test_a_failed_save_of_the_identity_link_leaves_the_invite_retryable(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        // Recording the Keycloak link fails after OL already created the identity.
        Schema::drop('socials');

        $result = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);

        $this->assertFalse($result['invite_sent']);
        $this->assertSame(__('pages.partners.msg_enrolment_failed_created'), $result['message']);
        $this->assertSame(PartnerInviteService::STATUS_FAILED, $result['agent']->partner_invite_status);
        $this->assertTrue($result['agent']->can_resend);
        Notification::assertNothingSent();
    }

    public function test_accounts_without_an_invite_status_are_not_managed_by_the_invite_flow(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        // Partner-only role and a Keycloak login, but never invited through this flow.
        $user = $this->insertUser('Legacy Partner', 'legacy@example.test');
        $user->attachRole(PartnerRole::ensureFor(1)->id);
        Social::create(['user_id' => $user->id, 'social_id' => 'kc-legacy', 'social_service' => 'keycloak']);
        $user = $user->load('roles');
        $this->assertTrue(PartnerRole::isPartnerOnly($user));

        $this->saveAndSync($user, ['status' => 'deactive']);
        $agent = LeadAgent::create([
            'company_id' => 1,
            'user_id' => $user->id,
            'status' => 'enabled',
            'is_partner' => true,
            'added_by' => $this->admin->id,
        ]);
        app(PartnerInviteService::class)->destroy($agent->load('user'));

        $this->assertSame([], $this->keycloak->updates);
    }

    public function test_re_adding_a_removed_partner_switches_their_identity_back_on(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $service = app(PartnerInviteService::class);

        $service->destroy($invite['agent']->fresh(['user', 'user.roles']));
        $this->assertFalse($this->keycloak->updates[0]['patch']['enabled']);

        $agent = $invite['agent']->fresh();
        $service->add($agent);

        $this->assertTrue((bool) $agent->fresh()->is_partner);
        $this->assertCount(2, $this->keycloak->updates);
        $this->assertTrue($this->keycloak->updates[1]['patch']['enabled']);
    }

    public function test_re_adding_does_not_switch_on_a_deactivated_partner(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite([
            'name' => 'Ada Lovelace',
            'email' => 'ada@example.test',
        ], 1, $this->admin);
        $service = app(PartnerInviteService::class);
        $service->destroy($invite['agent']->fresh(['user', 'user.roles']));
        DB::table('users')->where('id', $invite['agent']->user_id)->update(['status' => 'deactive']);
        $updatesBefore = count($this->keycloak->updates);

        $service->add($invite['agent']->fresh());

        $this->assertCount($updatesBefore, $this->keycloak->updates);
    }

    public function test_adding_a_staff_agent_as_partner_sends_nothing_to_keycloak(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $staff = $this->insertStaffWithKeycloakLogin();
        $agent = LeadAgent::create([
            'company_id' => 1,
            'user_id' => $staff->id,
            'status' => 'enabled',
            'is_partner' => false,
            'added_by' => $this->admin->id,
        ]);

        app(PartnerInviteService::class)->add($agent);

        $this->assertTrue((bool) $agent->fresh()->is_partner);
        $this->assertSame([], $this->keycloak->updates);
    }

    public function test_roster_rows_without_an_invite_status_use_one_batched_lookup(): void
    {
        // Partners invited while the flag was off have no invite status.
        $this->setFeatureFlag(PartnerInviteService::FLAG, false);
        $one = app(PartnerInviteService::class)->invite(['name' => 'Ada One', 'email' => 'one@example.test'], 1, $this->admin);
        $two = app(PartnerInviteService::class)->invite(['name' => 'Bea Two', 'email' => 'two@example.test'], 1, $this->admin);
        Social::create(['user_id' => $two['agent']->user_id, 'social_id' => 'kc-two', 'social_service' => 'keycloak']);
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $agents = LeadAgent::query()
            ->whereIn('id', [$one['agent']->id, $two['agent']->id])
            ->withCount('referredLeads')
            ->with(PartnerInviteService::AGENT_RELATIONS)
            ->orderBy('id')
            ->get();

        $service = app(PartnerInviteService::class);
        $ids = $service->keycloakIdsFor($agents);
        $this->assertSame([$two['agent']->user_id => 'kc-two'], $ids);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $agents->each(fn (LeadAgent $agent) => $service->decorate($agent, $ids));
        $queries = DB::getQueryLog();
        DB::disableQueryLog();

        $this->assertSame([], $queries);
        $this->assertTrue($agents[0]->can_resend);   // no identity yet: Resend enrols them
        $this->assertFalse($agents[1]->can_resend);  // already has one
    }

    public function test_resend_for_a_legacy_partner_with_an_identity_is_refused_with_an_accurate_message(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, false);
        $invite = app(PartnerInviteService::class)->invite(['name' => 'Ada One', 'email' => 'one@example.test'], 1, $this->admin);
        Social::create(['user_id' => $invite['agent']->user_id, 'social_id' => 'kc-legacy', 'social_service' => 'keycloak']);
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);

        $result = app(PartnerInviteService::class)->resend($invite['agent']->fresh(['user', 'user.roles']), $this->admin);

        $this->assertFalse($result['ok']);
        $this->assertSame(__('pages.partners.msg_resend_unavailable'), $result['message']);
        $this->assertNotSame(__('pages.partners.msg_resend_accepted'), $result['message']);
    }

    public function test_removal_decides_from_the_user_as_it_is_after_the_lock(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'], 1, $this->admin);

        // The roster row was loaded before provisioning finished: stale status.
        $stale = $invite['agent']->fresh(['user', 'user.roles']);
        $stale->user->partner_invite_status = null;

        app(PartnerInviteService::class)->destroy($stale);

        $this->assertCount(1, $this->keycloak->updates);
        $this->assertFalse($this->keycloak->updates[0]['patch']['enabled']);
    }

    public function test_a_delayed_enable_is_dropped_if_the_partner_was_removed_meanwhile(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'], 1, $this->admin);
        $user = $invite['agent']->user;
        $user->update(['status' => 'deactive']);
        $service = app(PartnerInviteService::class);
        $service->syncLifecycle($user); // deactivate pushed
        $before = count($this->keycloak->updates);

        // Reactivate inside a transaction (the enable is deferred to commit),
        // and remove the partner before it commits.
        DB::transaction(function () use ($user, $service, $invite) {
            $user->update(['status' => 'active']);
            $service->syncLifecycle($user);
            DB::table('lead_agents')->where('id', $invite['agent']->id)->update(['is_partner' => false]);
        });

        $this->assertCount($before, $this->keycloak->updates);
    }

    public function test_a_busy_lock_returns_a_retryable_message_and_keeps_the_saved_partner(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        config()->set('services.ol.keycloak.lock_wait_seconds', 1);
        // Hold the new partner's lock for the duration of the call.
        $held = \Illuminate\Support\Facades\Cache::lock('partner-invite:2', 60);
        $this->assertTrue($held->get());

        try {
            // user id 2 is the partner created below (admin is id 1).
            $result = app(PartnerInviteService::class)->invite(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'], 1, $this->admin);
        } finally {
            $held->release();
        }

        $this->assertFalse($result['invite_sent']);
        $this->assertSame(__('pages.partners.msg_busy_created'), $result['message']);
        $this->assertNotNull($result['agent']->id);
        $this->assertNull($this->keycloak->idForEmail('ada@example.test'));
    }

    /**
     * The Partners page reads these payloads: `status` decides the toast and
     * `agent` patches the row. Pinned here so a change to either shows up.
     */
    public function test_resend_endpoint_payload_on_success(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'], 1, $this->admin);

        $response = $this->partnerController()->resendInvite($invite['agent']->id);

        $this->assertSame('success', $response['status']);
        $this->assertSame(__('pages.partners.invite_sent'), $response['message']);
        $this->assertSame($invite['agent']->id, $response['agent']->id);
        $this->assertSame(PartnerInviteService::STATUS_INVITED, $response['agent']->partner_invite_status);
        $this->assertTrue($response['agent']->can_resend);
    }

    public function test_resend_endpoint_payload_when_refused(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'], 1, $this->admin);
        app(PartnerInviteService::class)->markAccepted($invite['agent']->user);

        $response = $this->partnerController()->resendInvite($invite['agent']->id);

        // HTTP 200 with status "fail": the page must read the body, and still
        // gets the row so the badge shows the real state.
        $this->assertSame('fail', $response['status']);
        $this->assertSame(__('pages.partners.msg_resend_accepted'), $response['message']);
        $this->assertSame($invite['agent']->id, $response['agent']->id);
        $this->assertSame(PartnerInviteService::STATUS_ACCEPTED, $response['agent']->partner_invite_status);
        $this->assertFalse($response['agent']->can_resend);
    }

    public function test_remove_endpoint_reports_busy_instead_of_failing(): void
    {
        $this->setFeatureFlag(PartnerInviteService::FLAG, true);
        $invite = app(PartnerInviteService::class)->invite(['name' => 'Ada Lovelace', 'email' => 'ada@example.test'], 1, $this->admin);
        config()->set('services.ol.keycloak.lock_wait_seconds', 1);
        $held = \Illuminate\Support\Facades\Cache::lock('partner-invite:'.$invite['agent']->user_id, 60);
        $this->assertTrue($held->get());

        try {
            $response = $this->partnerController()->destroy($invite['agent']->id);
        } finally {
            $held->release();
        }

        $this->assertSame('fail', $response['status']);
        $this->assertSame(__('pages.partners.msg_busy'), $response['message']);
        $this->assertTrue((bool) $invite['agent']->fresh()->is_partner);
    }

    /** The controller without its constructor (it builds view state these tests don't need). */
    private function partnerController(): PartnerAdminController
    {
        session(['company' => (object) ['id' => 1], 'user' => $this->admin]);

        $controller = (new \ReflectionClass(PartnerAdminController::class))->newInstanceWithoutConstructor();
        $service = app(PartnerInviteService::class);
        (function () use ($service) {
            $this->invites = $service;
        })->call($controller);

        return $controller;
    }

    /**
     * Save like the app does, then run the observer's sync. Model events are
     * switched off in this class (setUp), so the UserObserver::updated hook is
     * called by hand: syncLifecycle() reads wasChanged() from the real save.
     *
     * @param  array<string, mixed>  $attributes
     */
    private function saveAndSync(User $user, array $attributes): void
    {
        $user->update($attributes);
        app(PartnerInviteService::class)->syncLifecycle($user);
    }

    /** A staff member (admin role) who signs in with Keycloak SSO like everyone else. */
    private function insertStaffWithKeycloakLogin(): User
    {
        $staff = $this->insertUser('Staff', 'staff@example.test');
        $staff->attachRole(Role::withoutGlobalScopes()->where('name', 'admin')->first()->id);
        Social::create([
            'user_id' => $staff->id,
            'social_id' => 'kc-staff-1',
            'social_service' => 'keycloak',
        ]);
        // Give staff an invite status too, so it is the partner-only role check
        // (not just a missing status) that keeps them out of the sync.
        DB::table('users')->where('id', $staff->id)->update(['partner_invite_status' => PartnerInviteService::STATUS_INVITED]);

        return $staff->fresh('roles');
    }

    private function insertUser(string $name, string $email): User
    {
        $user = new User;
        $user->company_id = 1;
        $user->name = $name;
        $user->email = $email;
        $user->password = bcrypt('secret-secret');
        $user->status = 'active';
        $user->save();

        return $user;
    }

    private function createSchema(): void
    {
        Schema::create('companies', function (Blueprint $t) {
            $t->increments('id');
            $t->string('company_name')->nullable();
            $t->timestamps();
        });
        DB::table('companies')->insert(['id' => 1, 'company_name' => 'Acme', 'created_at' => now(), 'updated_at' => now()]);

        Schema::create('users', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->string('name')->nullable();
            $t->string('email')->nullable();
            $t->string('password')->nullable();
            $t->string('mobile')->nullable();
            $t->string('image')->nullable();
            $t->string('status')->default('active');
            $t->string('login')->default('enable');
            $t->string('partner_invite_status', 16)->nullable();
            $t->timestamp('partner_invited_at')->nullable();
            $t->text('headers')->nullable();
            $t->string('register_ip')->nullable();
            $t->text('location_details')->nullable();
            $t->timestamps();
        });

        Schema::create('roles', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
            $t->unsignedInteger('company_id')->nullable();
            $t->string('display_name')->nullable();
            $t->string('description')->nullable();
            $t->timestamps();
        });
        Schema::create('role_user', function (Blueprint $t) {
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('role_id');
            $t->primary(['user_id', 'role_id']);
        });
        Schema::create('permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->string('name');
            $t->string('display_name')->nullable();
            $t->unsignedInteger('module_id')->nullable();
            $t->string('allowed_permissions')->nullable();
            $t->boolean('is_custom')->default(0);
            $t->timestamps();
        });
        Schema::create('permission_role', function (Blueprint $t) {
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('role_id');
            $t->unsignedInteger('permission_type_id');
        });
        Schema::create('user_permissions', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('permission_id');
            $t->unsignedInteger('permission_type_id');
        });
        Schema::create('lead_agents', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->unsignedInteger('user_id');
            $t->unsignedInteger('lead_category_id')->nullable();
            $t->unsignedInteger('added_by')->nullable();
            $t->unsignedInteger('last_updated_by')->nullable();
            $t->string('status')->default('enabled');
            $t->boolean('is_partner')->default(false);
            $t->timestamps();
        });
        Schema::create('leads', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('company_id')->nullable();
            $t->unsignedInteger('referred_by_agent_id')->nullable();
            $t->softDeletes();
        });
        Schema::create('socials', function (Blueprint $t) {
            $t->increments('id');
            $t->unsignedInteger('user_id')->nullable();
            $t->text('social_id')->nullable();
            $t->text('social_service')->nullable();
            $t->timestamps();
        });
    }
}
