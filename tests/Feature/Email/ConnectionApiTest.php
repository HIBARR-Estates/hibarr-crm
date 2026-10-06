<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Exceptions\EmailUnavailableException;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Email\Sending\SendAttemptService;
use App\Email\Sync\MailboxSynchronizer;
use App\Email\Sync\SyncOutcome;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\FakesMailtrapInbox;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ConnectionApiTest extends TestCase
{
    use BuildsEmailSchema;
    use FakesMailtrapInbox;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->agent = $this->makeEmailUser();

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
    }

    // ------------------------------------------------------------------
    // Gates
    // ------------------------------------------------------------------

    public function test_flag_off_answers_404_on_every_endpoint(): void
    {
        $connection = $this->connectionFor($this->agent);
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->signIn($this->agent);

        foreach ($this->endpoints($connection->uuid) as [$method, $uri]) {
            $this->json($method, $uri, ['identity_email' => 'anna@agency.test'])->assertStatus(404);
        }

        $this->assertSame(ConnectionStatus::Active, $connection->fresh()->status);
        $this->assertSame(1, EmailConnection::withoutGlobalScopes()->count());
    }

    public function test_flag_off_answers_404_even_when_signed_out(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $this->getJson('/email/connections')->assertStatus(404);
    }

    public function test_unauthenticated_answers_401_on_every_endpoint(): void
    {
        $connection = $this->connectionFor($this->agent);

        foreach ($this->endpoints($connection->uuid) as [$method, $uri]) {
            $this->json($method, $uri, ['identity_email' => 'anna@agency.test'])->assertStatus(401);
        }

        $this->assertSame(ConnectionStatus::Active, $connection->fresh()->status);
    }

    public function test_non_allowlisted_user_answers_403_on_every_endpoint(): void
    {
        $outsider = $this->makeEmailUser();
        $connection = $this->connectionFor($outsider);
        $this->signIn($outsider);

        foreach ($this->endpoints($connection->uuid) as [$method, $uri]) {
            $this->json($method, $uri, ['identity_email' => 'anna@agency.test'])->assertStatus(403);
        }

        $this->assertSame(ConnectionStatus::Active, $connection->fresh()->status);
        $this->assertSame(1, EmailConnection::withoutGlobalScopes()->count());
    }

    public function test_a_company_wide_allowlist_row_lets_a_colleague_in(): void
    {
        $colleague = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forCompany($colleague->company_id)->create();
        $this->signIn($colleague);

        $this->getJson('/email/connections')->assertOk()->assertExactJson(['connections' => []]);
    }

    // ------------------------------------------------------------------
    // Connect
    // ------------------------------------------------------------------

    public function test_connect_creates_an_active_connection_for_the_signed_in_user(): void
    {
        $this->signIn($this->agent);

        $response = $this->postJson('/email/connections', [
            'provider' => 'fake',
            'identity_email' => 'Anna@Agency.test',
            'reply_to_email' => 'office@agency.test',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('connection.provider', 'fake')
            ->assertJsonPath('connection.identity_email', 'anna@agency.test')
            ->assertJsonPath('connection.from_email', 'anna@agency.test')
            ->assertJsonPath('connection.reply_to_email', 'office@agency.test')
            ->assertJsonPath('connection.status', 'active')
            ->assertJsonPath('connection.last_error_code', null);

        $connection = EmailConnection::withoutGlobalScopes()->sole();

        $this->assertTrue(Str::isUuid($response->json('connection.id')));
        $this->assertSame($connection->uuid, $response->json('connection.id'));
        $this->assertSame((int) $this->agent->id, (int) $connection->user_id);
        $this->assertSame((int) $this->agent->company_id, (int) $connection->company_id);
    }

    public function test_connect_stores_mailtrap_secrets_encrypted_and_never_returns_them(): void
    {
        $this->configureMailtrap();
        $this->putMailtrapMessage('501', 11);
        $this->signIn($this->agent);

        $response = $this->postJson('/email/connections', [
            'provider' => 'mailtrap',
            'identity_email' => 'anna@agency.test',
            'inbox_id' => '501',
            'smtp_username' => 'smtp-user-a',
            'smtp_password' => 'smtp-pass-very-secret',
            'api_token' => 'not-a-connection-field',
        ]);

        $response->assertStatus(201)
            ->assertJsonPath('connection.provider', 'mailtrap')
            ->assertJsonPath('connection.status', 'active');

        $this->assertStringNotContainsString('smtp-pass-very-secret', $response->getContent());
        $this->assertStringNotContainsString('smtp-user-a', $response->getContent());
        $this->assertArrayNotHasKey('credentials', $response->json('connection'));

        $connection = EmailConnection::withoutGlobalScopes()->sole();
        $raw = (string) DB::table('email_connections')->where('id', $connection->id)->value('credentials');

        $this->assertStringNotContainsString('smtp-pass-very-secret', $raw);
        $this->assertSame(
            ['inbox_id' => '501', 'smtp_username' => 'smtp-user-a', 'smtp_password' => 'smtp-pass-very-secret'],
            $connection->credentials,
        );
    }

    public function test_connect_to_a_mailtrap_inbox_that_does_not_exist_needs_reconnect(): void
    {
        $this->configureMailtrap();
        $this->signIn($this->agent);

        $this->postJson('/email/connections', [
            'provider' => 'mailtrap',
            'identity_email' => 'anna@agency.test',
            'inbox_id' => '404404',
            'smtp_username' => 'smtp-user-a',
            'smtp_password' => 'smtp-pass',
        ])
            ->assertStatus(201)
            ->assertJsonPath('connection.status', 'needs_reconnect')
            ->assertJsonPath('connection.last_error_code', 'inbox_not_found');
    }

    public function test_connect_requires_the_mailtrap_inbox_and_smtp_secrets(): void
    {
        $this->configureMailtrap();
        $this->signIn($this->agent);

        $this->postJson('/email/connections', ['provider' => 'mailtrap', 'identity_email' => 'anna@agency.test'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['inbox_id', 'smtp_username', 'smtp_password']);

        $this->postJson('/email/connections', [
            'provider' => 'mailtrap',
            'identity_email' => 'anna@agency.test',
            'sandbox' => 'z',
            'smtp_username' => 'u',
            'smtp_password' => 'p',
        ])->assertStatus(422)->assertJsonValidationErrors(['sandbox']);

        $this->postJson('/email/connections', ['provider' => 'fake', 'identity_email' => 'not-an-email'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['identity_email']);

        $this->assertSame(0, EmailConnection::withoutGlobalScopes()->count());
        Http::assertNothingSent();
    }

    public function test_connect_refuses_a_provider_with_no_adapter_here(): void
    {
        $this->signIn($this->agent);

        foreach (['zoho', 'smtp'] as $provider) {
            $this->postJson('/email/connections', ['provider' => $provider, 'identity_email' => 'anna@agency.test'])
                ->assertStatus(422)
                ->assertJsonValidationErrors(['provider']);
        }

        // An environment where the sandbox is not allowed cannot connect one.
        config(['email.mailtrap.environments' => ['staging']]);

        $this->postJson('/email/connections', [
            'provider' => 'mailtrap',
            'identity_email' => 'anna@agency.test',
            'inbox_id' => '501',
            'smtp_username' => 'u',
            'smtp_password' => 'p',
        ])->assertStatus(422)->assertJsonValidationErrors(['provider']);

        $this->assertSame(0, EmailConnection::withoutGlobalScopes()->count());
    }

    public function test_connect_refuses_the_same_mailbox_twice_for_one_user(): void
    {
        $this->connectionFor($this->agent, ['identity_email' => 'anna@agency.test', 'from_email' => 'anna@agency.test']);
        $this->signIn($this->agent);

        $this->postJson('/email/connections', ['provider' => 'fake', 'identity_email' => 'ANNA@agency.test'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['identity_email']);

        $this->assertSame(1, EmailConnection::withoutGlobalScopes()->count());
    }

    // ------------------------------------------------------------------
    // Stop / resume / reconnect / destroy
    // ------------------------------------------------------------------

    public function test_stopped_connection_jobs_skip(): void
    {
        $connection = $this->connectionFor($this->agent);
        $this->fake->seedInbound($connection->toContext());
        $this->signIn($this->agent);

        $this->postJson("/email/connections/{$connection->uuid}/stop")
            ->assertOk()
            ->assertJsonPath('connection.status', 'stopped');

        $connection = $connection->fresh();

        $this->assertSame(ConnectionStatus::Stopped, $connection->status);
        $this->assertNotNull($connection->sync_stopped_at);

        // No new sync.
        $outcome = $this->sync($connection);

        $this->assertFalse($outcome->ran);
        $this->assertSame('connection_inactive', $outcome->reason);
        $this->assertSame(0, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertNull($connection->fresh()->last_sync_at);

        // No new send: nothing stored, nothing handed to the provider.
        try {
            app(SendAttemptService::class)->send($connection, $this->draft($connection));
            $this->fail('A stopped connection must not send.');
        } catch (EmailUnavailableException $exception) {
            $this->assertSame('connection_inactive', $exception->reason);
        }

        $this->assertSame(0, EmailSendAttempt::withoutGlobalScopes()->count());
        $this->assertSame([], $this->fake->sendCalls($connection->uuid));
    }

    public function test_stop_keeps_mail_already_in_the_crm(): void
    {
        $connection = $this->connectionFor($this->agent);
        $this->fake->seedInbound($connection->toContext());
        $this->sync($connection);
        $this->signIn($this->agent);

        $this->postJson("/email/connections/{$connection->uuid}/stop")->assertOk();
        $this->postJson("/email/connections/{$connection->uuid}/stop")->assertOk();

        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->where('connection_id', $connection->id)->count());
    }

    public function test_resume_turns_sync_back_on_from_the_saved_checkpoint(): void
    {
        $connection = $this->connectionFor($this->agent);
        $context = $connection->toContext();
        $this->fake->seedInbound($context);
        $this->sync($connection);
        $this->signIn($this->agent);

        $this->postJson("/email/connections/{$connection->uuid}/stop")->assertOk();
        $this->fake->seedInbound($context);
        $this->assertFalse($this->sync($connection)->ran);

        $this->postJson("/email/connections/{$connection->uuid}/resume")
            ->assertOk()
            ->assertJsonPath('connection.status', 'active')
            ->assertJsonPath('connection.sync_stopped_at', null);

        $outcome = $this->sync($connection);

        $this->assertTrue($outcome->succeeded());
        $this->assertSame(1, $outcome->ingested);
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
    }

    public function test_resume_does_not_activate_a_mailbox_the_provider_refuses(): void
    {
        $connection = $this->connectionFor($this->agent, [], 'stopped');
        $this->fake->setHealth($connection->toContext(), ConnectionHealth::needsReconnect('unauthorized'));
        $this->signIn($this->agent);

        $this->postJson("/email/connections/{$connection->uuid}/resume")
            ->assertOk()
            ->assertJsonPath('connection.status', 'needs_reconnect')
            ->assertJsonPath('connection.last_error_code', 'unauthorized');

        $this->assertSame('connection_inactive', $this->sync($connection)->reason);
    }

    public function test_reconnect_replaces_the_secrets_and_reactivates(): void
    {
        $this->configureMailtrap();
        $this->putMailtrapMessage('502', 21);
        $connection = $this->connectionFor($this->agent, [
            'provider' => 'mailtrap',
            'credentials' => ['inbox_id' => '404404', 'smtp_username' => 'old-user', 'smtp_password' => 'old-pass'],
            'checkpoint' => ['INBOX' => '7'],
        ], 'needsReconnect');
        $this->signIn($this->agent);

        $response = $this->putJson("/email/connections/{$connection->uuid}/reconnect", [
            'inbox_id' => '502',
            'smtp_username' => 'new-user',
            'smtp_password' => 'new-pass-secret',
        ]);

        $response->assertOk()
            ->assertJsonPath('connection.id', $connection->uuid)
            ->assertJsonPath('connection.status', 'active')
            ->assertJsonPath('connection.last_error_code', null);
        $this->assertStringNotContainsString('new-pass-secret', $response->getContent());

        $connection = $connection->fresh();

        $this->assertSame(
            ['inbox_id' => '502', 'smtp_username' => 'new-user', 'smtp_password' => 'new-pass-secret'],
            $connection->credentials,
        );
        $this->assertSame(['INBOX' => '7'], $connection->checkpoint);
    }

    public function test_reconnect_with_incomplete_secrets_changes_nothing(): void
    {
        $this->configureMailtrap();
        $credentials = ['inbox_id' => '501', 'smtp_username' => 'old-user', 'smtp_password' => 'old-pass'];
        $connection = $this->connectionFor($this->agent, ['provider' => 'mailtrap', 'credentials' => $credentials], 'needsReconnect');
        $this->signIn($this->agent);

        $this->putJson("/email/connections/{$connection->uuid}/reconnect", ['inbox_id' => '502'])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['smtp_username', 'smtp_password']);

        $this->assertSame($credentials, $connection->fresh()->credentials);
        $this->assertSame(ConnectionStatus::NeedsReconnect, $connection->fresh()->status);
    }

    public function test_destroy_removes_the_connection_so_the_mailbox_can_be_connected_again(): void
    {
        $connection = $this->connectionFor($this->agent, ['identity_email' => 'anna@agency.test', 'from_email' => 'anna@agency.test']);
        $this->signIn($this->agent);

        $this->deleteJson("/email/connections/{$connection->uuid}")->assertStatus(204);

        $this->assertSame(0, EmailConnection::withoutGlobalScopes()->count());
        $this->assertSame('connection_missing', $this->sync($connection)->reason);

        $this->postJson('/email/connections', ['provider' => 'fake', 'identity_email' => 'anna@agency.test'])
            ->assertStatus(201)
            ->assertJsonPath('connection.status', 'active');
    }

    // ------------------------------------------------------------------
    // Ownership
    // ------------------------------------------------------------------

    public function test_list_shows_only_the_signed_in_users_connections(): void
    {
        $mine = $this->connectionFor($this->agent);
        $this->connectionFor($this->makeEmailUser());
        $this->signIn($this->agent);

        $response = $this->getJson('/email/connections')->assertOk();

        $this->assertSame([$mine->uuid], array_column($response->json('connections'), 'id'));
        $this->assertArrayNotHasKey('credentials', $response->json('connections.0'));
    }

    public function test_another_users_connection_is_not_found(): void
    {
        $colleague = $this->makeEmailUser($this->agent->company);
        $stranger = $this->makeEmailUser();
        $this->signIn($this->agent);

        foreach ([$colleague, $stranger] as $owner) {
            $theirs = $this->connectionFor($owner);

            foreach ($this->endpoints($theirs->uuid, onlyExisting: true) as [$method, $uri]) {
                $this->json($method, $uri, ['smtp_username' => 'u', 'smtp_password' => 'p'])->assertStatus(404);
            }

            $this->assertSame(ConnectionStatus::Active, $theirs->fresh()->status);
        }

        $this->postJson('/email/connections/'.Str::uuid().'/stop')->assertStatus(404);
        $this->postJson('/email/connections/1/stop')->assertStatus(404);
    }

    // ------------------------------------------------------------------

    /**
     * @return list<array{0: string, 1: string}>
     */
    private function endpoints(string $uuid, bool $onlyExisting = false): array
    {
        $onConnection = [
            ['POST', "/email/connections/{$uuid}/stop"],
            ['POST', "/email/connections/{$uuid}/resume"],
            ['PUT', "/email/connections/{$uuid}/reconnect"],
            ['DELETE', "/email/connections/{$uuid}"],
        ];

        return $onlyExisting ? $onConnection : array_merge([
            ['GET', '/email/connections'],
            ['POST', '/email/connections'],
        ], $onConnection);
    }

    private function connectionFor(User $user, array $attributes = [], ?string $state = null): EmailConnection
    {
        $factory = EmailConnection::factory()->forUser($user);

        return ($state !== null ? $factory->{$state}() : $factory)->create($attributes);
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);

        $this->actingAs($user);
    }

    private function sync(EmailConnection $connection): SyncOutcome
    {
        return (new SyncMailboxJob($connection->id))->handle(app(MailboxSynchronizer::class));
    }

    private function draft(EmailConnection $connection): Draft
    {
        return new Draft(
            from: new EmailAddress($connection->from_email),
            to: ['lead@example.test'],
            subject: 'Villa viewing',
            textBody: 'Hello',
        );
    }
}
