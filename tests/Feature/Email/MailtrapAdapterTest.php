<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\Mailtrap\MailtrapAdapter;
use App\Email\Adapters\Mailtrap\MailtrapClient;
use App\Email\Contracts\MailTransport;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\Data\HealthState;
use App\Email\Data\SendStatus;
use App\Email\Exceptions\MailTransportException;
use App\Email\Transport\MailTransportFactory;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class MailtrapAdapterTest extends TestCase
{
    private const TOKEN = 'mt-api-token-very-secret';

    private MailtrapAdapter $adapter;

    protected function setUp(): void
    {
        parent::setUp();

        config([
            'email.mailtrap.api_token' => self::TOKEN,
            'email.mailtrap.account_id' => '1001',
            'email.mailtrap.api_base_url' => 'https://mailtrap.test',
            'email.mailtrap.sandboxes' => ['a' => '501', 'b' => '502'],
        ]);

        $this->adapter = app(MailtrapAdapter::class);
    }

    public function test_config_keys_resolve_with_sandbox_defaults(): void
    {
        $this->assertSame('sandbox.smtp.mailtrap.io', config('email.mailtrap.smtp.host'));
        $this->assertSame(2525, config('email.mailtrap.smtp.port'));
        $this->assertSame(['a' => '501', 'b' => '502'], config('email.mailtrap.sandboxes'));
        $this->assertNotContains('production', config('email.mailtrap.environments'));
        $this->assertNotContains('codecanyon', config('email.mailtrap.environments'));
    }

    public function test_missing_api_token_reports_needs_reconnect_without_calling_mailtrap(): void
    {
        Http::fake();

        foreach ([null, '', '   '] as $missing) {
            config(['email.mailtrap.api_token' => $missing]);

            $health = $this->adapter->health($this->connection());

            $this->assertSame(HealthState::NeedsReconnect, $health->state);
            $this->assertSame('missing_api_token', $health->errorCode);
        }

        Http::assertNothingSent();
    }

    public function test_missing_account_or_inbox_reports_needs_reconnect(): void
    {
        Http::fake();

        $noInbox = $this->adapter->health($this->connection([]));

        config(['email.mailtrap.account_id' => null]);
        $noAccount = $this->adapter->health($this->connection());

        $this->assertSame(HealthState::NeedsReconnect, $noInbox->state);
        $this->assertSame('missing_inbox_id', $noInbox->errorCode);
        $this->assertSame(HealthState::NeedsReconnect, $noAccount->state);
        $this->assertSame('missing_account_id', $noAccount->errorCode);

        Http::assertNothingSent();
    }

    public function test_healthy_inbox_is_checked_with_the_account_token_and_connection_inbox(): void
    {
        Http::fake(['mailtrap.test/*' => Http::response(['id' => 777, 'name' => 'Agent A'])]);

        $health = $this->adapter->health($this->connection(['inbox_id' => 777]));

        $this->assertTrue($health->isOk());

        Http::assertSent(fn (Request $request) => $request->method() === 'GET'
            && $request->url() === 'https://mailtrap.test/api/accounts/1001/inboxes/777'
            && $request->hasHeader('Api-Token', self::TOKEN));
    }

    public function test_two_agents_map_to_two_sandboxes(): void
    {
        Http::fake(['mailtrap.test/*' => Http::response(['ok' => true])]);

        $this->assertTrue($this->adapter->health($this->connection(['sandbox' => 'a'], 'conn-a'))->isOk());
        $this->assertTrue($this->adapter->health($this->connection(['sandbox' => 'b'], 'conn-b'))->isOk());

        $unknown = $this->adapter->health($this->connection(['sandbox' => 'c']));

        $this->assertSame('missing_inbox_id', $unknown->errorCode);

        Http::assertSentCount(2);
        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/inboxes/501'));
        Http::assertSent(fn (Request $request) => str_ends_with($request->url(), '/inboxes/502'));
    }

    public function test_provider_responses_map_to_health_states(): void
    {
        $cases = [
            [Http::response(['error' => 'Incorrect API token '.self::TOKEN], 401), HealthState::NeedsReconnect, 'unauthorized'],
            [Http::response([], 403), HealthState::NeedsReconnect, 'unauthorized'],
            [Http::response([], 404), HealthState::NeedsReconnect, 'inbox_not_found'],
            [Http::response([], 429, ['Retry-After' => '30']), HealthState::QuotaBackoff, 'rate_limited'],
            [Http::response('upstream exploded', 500), HealthState::Unreachable, 'provider_error'],
        ];

        foreach ($cases as [$response, $state, $code]) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::fake(['*' => $response]);

            $health = $this->adapter->health($this->connection());

            $this->assertSame($state, $health->state);
            $this->assertSame($code, $health->errorCode);
            $this->assertStringNotContainsString(self::TOKEN, (string) json_encode($health));
        }

        // Only a rate limit carries a Retry-After.
        $this->assertNull($health->retryAfterSeconds);
        $this->assertSame(30, $this->rateLimited()->retryAfterSeconds);
    }

    public function test_network_failures_never_leak_as_exceptions(): void
    {
        Http::fake(fn () => throw new ConnectionException('cURL error 6: could not resolve mailtrap.test with token '.self::TOKEN));

        $health = $this->adapter->health($this->connection());

        $this->assertSame(HealthState::Unreachable, $health->state);
        $this->assertSame('provider_unreachable', $health->errorCode);

        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(fn () => throw new \RuntimeException('boom '.self::TOKEN));

        $health = $this->adapter->health($this->connection());

        $this->assertSame(HealthState::Unreachable, $health->state);
        $this->assertSame('provider_error', $health->errorCode);
    }

    public function test_client_and_errors_never_expose_the_token(): void
    {
        $client = MailtrapClient::forConnection($this->connection(), config('email.mailtrap'));

        $this->assertSame('https://mailtrap.test/api/accounts/1001/inboxes/501/messages', $client->inboxUrl('messages'));
        $this->assertStringNotContainsString(self::TOKEN, print_r($client, true));

        config(['email.mailtrap.account_id' => '']);

        try {
            MailtrapClient::forConnection($this->connection(), config('email.mailtrap'));
            $this->fail('Expected the missing account id to be reported.');
        } catch (MailTransportException $exception) {
            $this->assertSame('missing_account_id', $exception->errorCode);
            $this->assertFalse($exception->retryable);
            $this->assertStringNotContainsString(self::TOKEN, $exception->getMessage().$exception->getTraceAsString());
        }
    }

    public function test_unbuilt_operations_say_so_instead_of_pretending(): void
    {
        Http::fake();
        $connection = $this->connection();

        $result = $this->adapter->send($connection, new Draft(new EmailAddress('agent@agency.test'), ['lead@example.test']));

        $this->assertSame(SendStatus::Rejected, $result->status);
        $this->assertSame('not_implemented', $result->errorCode);

        foreach ([
            fn () => $this->adapter->fetchSince($connection, Checkpoint::start(), []),
            fn () => $this->adapter->getMessage($connection, 'm-1'),
            fn () => $this->adapter->getAttachment($connection, 'm-1', 'p-1'),
        ] as $call) {
            try {
                $call();
                $this->fail('Expected a not-implemented transport error.');
            } catch (MailTransportException $exception) {
                $this->assertSame('not_implemented', $exception->errorCode);
                $this->assertFalse($exception->retryable);
            }
        }

        Http::assertNothingSent();
    }

    public function test_factory_resolves_mailtrap_outside_production_only(): void
    {
        $factory = app(MailTransportFactory::class);

        $this->assertInstanceOf(MailTransport::class, $factory->make('mailtrap'));
        $this->assertInstanceOf(MailtrapAdapter::class, $factory->forConnection($this->connection()));

        foreach (['local', 'staging'] as $environment) {
            $this->app['env'] = $environment;
            $this->assertTrue($factory->supports('mailtrap'), $environment);
        }

        // Even a config mistake cannot switch the sandbox on in production.
        config(['email.mailtrap.environments' => ['production', 'codecanyon', 'staging']]);

        foreach (['production', 'codecanyon'] as $environment) {
            $this->app['env'] = $environment;

            $this->assertFalse($factory->supports('mailtrap'), $environment);
            $this->assertFalse($factory->supports('fake'), $environment);

            try {
                $factory->make('mailtrap');
                $this->fail('Expected Mailtrap to be unavailable in '.$environment);
            } catch (MailTransportException $exception) {
                $this->assertSame('provider_unavailable', $exception->errorCode);
            }
        }
    }

    /**
     * @param  array<string, mixed>|null  $credentials
     */
    private function connection(?array $credentials = null, string $key = 'conn-1'): ConnectionContext
    {
        $identity = new EmailAddress('agent@agency.test');

        return new ConnectionContext($key, 'mailtrap', $identity, $identity, null, $credentials ?? ['sandbox' => 'a']);
    }

    private function rateLimited(): \App\Email\Data\ConnectionHealth
    {
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(['*' => Http::response([], 429, ['Retry-After' => '30'])]);

        return $this->adapter->health($this->connection());
    }
}
