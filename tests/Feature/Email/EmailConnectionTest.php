<?php

namespace Tests\Feature\Email;

use App\Email\Data\ConnectionContext;
use App\Email\EmailFeature;
use App\Email\Enums\ConnectionStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\User;
use Database\Factories\Email\EmailConnectionFactory;
use DomainException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailConnectionTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
    }

    public function test_tables_exist_with_the_domain_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('email_connections', [
            'uuid', 'company_id', 'user_id', 'provider', 'identity_email', 'from_email', 'reply_to_email',
            'credentials', 'status', 'sync_stopped_at', 'checkpoint', 'last_sync_at', 'last_error_code',
            'created_at', 'updated_at',
        ]));
        $this->assertTrue(Schema::hasColumns('email_pilot_allowlist', ['company_id', 'user_id', 'added_by', 'created_at']));
    }

    public function test_credentials_round_trip_encrypted(): void
    {
        $secrets = ['api_token' => 'mt-secret-token-123', 'inbox_id' => 42];

        $connection = $this->connection()->create(['credentials' => $secrets]);

        $raw = (string) DB::table('email_connections')->where('id', $connection->id)->value('credentials');

        $this->assertNotSame('', $raw);
        $this->assertStringNotContainsString('mt-secret-token-123', $raw);
        $this->assertStringNotContainsString('api_token', $raw);
        $this->assertSame($secrets, json_decode(decrypt($raw, false), true));

        $this->assertSame($secrets, $connection->fresh()->credentials);
    }

    public function test_credentials_never_serialize(): void
    {
        $connection = $this->connection()->create(['credentials' => ['api_token' => 'mt-secret-token-123']]);

        $this->assertArrayNotHasKey('credentials', $connection->fresh()->toArray());
        $this->assertStringNotContainsString('mt-secret-token-123', $connection->fresh()->toJson());
    }

    public function test_connection_gets_a_crm_uuid_and_defaults(): void
    {
        $connection = $this->connection()->create([
            'identity_email' => ' Agent@Example.COM ',
            'from_email' => 'Agent@Example.COM',
        ])->fresh();

        $this->assertTrue(Str::isUuid($connection->uuid));
        $this->assertIsInt($connection->getKey());
        $this->assertSame(ConnectionStatus::Active, $connection->status);
        $this->assertTrue($connection->isSyncable());
        $this->assertSame('agent@example.com', $connection->identity_email);
        $this->assertTrue($connection->syncCheckpoint()->isStart());
        $this->assertFalse($this->connection()->stopped()->create()->isSyncable());
        $this->assertFalse($this->connection()->needsReconnect()->create()->isSyncable());
    }

    public function test_connection_maps_to_the_adapter_context(): void
    {
        $connection = $this->connection()->create([
            'identity_email' => 'agent@example.com',
            'from_email' => 'sales@example.com',
            'reply_to_email' => 'replies@example.com',
            'credentials' => ['api_token' => 'mt-secret-token-123'],
            'checkpoint' => ['INBOX' => '12'],
        ])->fresh();

        $context = $connection->toContext();

        $this->assertInstanceOf(ConnectionContext::class, $context);
        $this->assertSame($connection->uuid, $context->key);
        $this->assertSame('fake', $context->provider);
        $this->assertSame('agent@example.com', $context->identity->address);
        $this->assertSame('sales@example.com', $context->from->address);
        $this->assertSame('replies@example.com', $context->replyTo->address);
        $this->assertSame('mt-secret-token-123', $context->credential('api_token'));
        $this->assertSame('12', $connection->syncCheckpoint()->cursor('INBOX'));
    }

    public function test_queries_are_isolated_to_the_logged_in_users_company(): void
    {
        $owner = $this->makeEmailUser();
        $mine = $this->connection($owner)->create();
        $colleague = $this->connection($this->makeEmailUser($owner->company))->create();
        $other = $this->connection()->create();

        $this->assertNotSame($mine->company_id, $other->company_id);

        $this->actingAs($owner);

        $this->assertEqualsCanonicalizing(
            [$mine->id, $colleague->id],
            EmailConnection::query()->pluck('id')->all(),
        );
        $this->assertNull(EmailConnection::query()->find($other->id));
        $this->assertNull(EmailConnection::query()->where('uuid', $other->uuid)->first());
        $this->assertSame(3, EmailConnection::withoutGlobalScopes()->count());
    }

    public function test_connection_company_follows_its_owner_and_cannot_cross_companies(): void
    {
        $owner = $this->makeEmailUser();

        $connection = new EmailConnection([
            'user_id' => $owner->id,
            'provider' => 'fake',
            'identity_email' => 'owner@example.com',
            'from_email' => 'owner@example.com',
        ]);
        $connection->save();

        $this->assertSame((int) $owner->company_id, (int) $connection->company_id);

        $this->expectException(DomainException::class);

        $this->connection($owner)->create(['company_id' => $this->makeEmailCompany()->id]);
    }

    public function test_one_user_cannot_connect_the_same_mailbox_twice(): void
    {
        $owner = $this->makeEmailUser();
        $this->connection($owner)->create(['identity_email' => 'agent@example.com']);

        $this->expectException(QueryException::class);

        $this->connection($owner)->create(['identity_email' => 'AGENT@example.com']);
    }

    public function test_pilot_allowlist_covers_a_named_user_or_a_whole_company(): void
    {
        $company = $this->makeEmailCompany();
        $listed = $this->makeEmailUser($company);
        $colleague = $this->makeEmailUser($company);
        $outsider = $this->makeEmailUser();

        $this->assertFalse(EmailPilotAllowlistEntry::allows($listed));

        EmailPilotAllowlistEntry::factory()->forUser($listed)->create();

        $this->assertTrue(EmailPilotAllowlistEntry::allows($listed));
        $this->assertFalse(EmailPilotAllowlistEntry::allows($colleague));
        $this->assertFalse(EmailPilotAllowlistEntry::allows($outsider));
        $this->assertFalse(EmailPilotAllowlistEntry::allows(null));
        $this->assertFalse(EmailPilotAllowlistEntry::allows(new User));

        EmailPilotAllowlistEntry::factory()->forCompany($company->id)->create();

        $this->assertTrue(EmailPilotAllowlistEntry::allows($colleague));
        $this->assertFalse(EmailPilotAllowlistEntry::allows($outsider));
    }

    public function test_email_is_enabled_for_a_user_only_with_flag_and_allowlist(): void
    {
        $user = $this->makeEmailUser();

        $this->setFeatureFlag(EmailFeature::FLAG, true);
        $this->assertFalse(EmailFeature::enabledFor($user));
        $this->assertFalse(EmailFeature::enabledFor(null));

        EmailPilotAllowlistEntry::factory()->forUser($user)->create();
        $this->assertTrue(EmailFeature::enabledFor($user));

        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->assertFalse(EmailFeature::enabledFor($user));
    }

    private function connection(?User $owner = null): EmailConnectionFactory
    {
        return EmailConnection::factory()->forUser($owner ?? $this->makeEmailUser());
    }
}
