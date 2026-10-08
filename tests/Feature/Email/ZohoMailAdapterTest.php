<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\Zoho\ZohoMailAdapter;
use App\Email\Contracts\AttachmentStore;
use App\Email\Data\ConnectionContext;
use App\Email\Data\Draft;
use App\Email\Data\DraftAttachment;
use App\Email\Data\EmailAddress;
use App\Email\Data\HealthState;
use App\Email\Data\SendStatus;
use App\Email\EmailFeature;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Transport\MailTransportFactory;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ZohoMailAdapterTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private const MAIL_CLIENT = 'mail-client-id';

    private const MAIL_SECRET = 'mail-client-secret-very-secret';

    private const CALENDAR_REFRESH = 'calendar-org-token-must-not-leak';

    private const USER_REFRESH = 'user-refresh-secret';

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->configureZoho();
    }

    public function test_config_uses_the_mail_client_and_eu_hosts(): void
    {
        $this->assertSame(self::MAIL_CLIENT, config('email.zoho.client_id'));
        $this->assertSame('https://accounts.zoho.test', config('email.zoho.accounts_url'));
        $this->assertSame('https://mail.zoho.test', config('email.zoho.api_base_url'));
        $this->assertSame(
            'https://staging-crm.hibarr.org/email/connections/zoho/callback',
            config('email.zoho.redirect_uri'),
        );
        $this->assertNotSame(self::MAIL_CLIENT, config('zoho.client_id'));
        $this->assertNotSame(self::CALENDAR_REFRESH, config('email.zoho.client_secret'));
    }

    public function test_missing_mail_client_needs_reconnect_and_does_not_call_zoho(): void
    {
        Http::fake();
        config(['email.zoho.client_id' => '', 'email.zoho.client_secret' => null]);

        $health = app(ZohoMailAdapter::class)->health($this->context());

        $this->assertSame(HealthState::NeedsReconnect, $health->state);
        $this->assertSame('missing_oauth_client', $health->errorCode);
        $this->assertStringNotContainsString(self::MAIL_SECRET, (string) $health->errorCode);
        Http::assertNothingSent();
    }

    public function test_factory_enables_zoho_only_when_the_mail_client_is_configured(): void
    {
        $factory = app(MailTransportFactory::class);

        $this->assertTrue($factory->supports('zoho'));
        $this->assertInstanceOf(ZohoMailAdapter::class, $factory->make('zoho'));

        config(['email.zoho.client_id' => null]);
        $this->assertFalse($factory->supports('zoho'));

        config(['email.zoho.client_id' => self::MAIL_CLIENT]);
        $this->app['env'] = 'production';

        $this->assertTrue($factory->supports('zoho'));
        $this->assertFalse($factory->supports('mailtrap'));
        $this->assertFalse($factory->supports('fake'));
    }

    public function test_expired_access_token_refreshes_with_the_user_token_not_the_calendar_token(): void
    {
        Http::fake(fn (Request $request) => $this->zohoResponse($request, [
            'access_token' => 'user-access-new',
            'expires_in' => 3600,
        ]));

        $owner = $this->makeEmailUser();
        $connection = EmailConnection::factory()->forUser($owner)->create([
            'provider' => 'zoho',
            'identity_email' => 'isaac@hibarr.de',
            'from_email' => 'isaac@hibarr.de',
            'credentials' => [
                'refresh_token' => self::USER_REFRESH,
                'access_token' => 'expired-access',
                'expires_at' => time() - 30,
                'account_id' => '555',
            ],
        ]);

        $health = app(ZohoMailAdapter::class)->health($connection->toContext());

        $this->assertTrue($health->isOk());
        $this->assertSame('user-access-new', $connection->fresh()->credentials['access_token']);
        $this->assertSame(self::USER_REFRESH, $connection->fresh()->credentials['refresh_token']);
        $this->assertNotSame(self::CALENDAR_REFRESH, $connection->fresh()->credentials['refresh_token']);

        Http::assertSent(function (Request $request) {
            if (! str_contains($request->url(), '/oauth/v2/token')) {
                return false;
            }

            $body = $request->body();

            return str_contains($body, 'grant_type=refresh_token')
                && str_contains($body, 'refresh_token='.self::USER_REFRESH)
                && str_contains($body, 'client_id='.self::MAIL_CLIENT)
                && ! str_contains($body, self::CALENDAR_REFRESH)
                && ! str_contains($body, 'calendar-client');
        });
    }

    public function test_fetch_and_send_use_the_mail_api_and_never_mark_delivered(): void
    {
        Http::fake(fn (Request $request) => $this->zohoResponse($request));

        $adapter = app(ZohoMailAdapter::class);
        $context = $this->context(expiresAt: time() + 3600, access: 'user-access');

        $page = $adapter->fetchSince($context, new \App\Email\Data\Checkpoint(['Inbox' => '100']), []);

        $this->assertCount(1, $page->messages);
        $this->assertSame('10:200', $page->messages[0]->providerMessageId);
        $this->assertSame('<msg-200@hibarr.de>', $page->messages[0]->rfcMessageId);
        $this->assertSame('Villa', $page->messages[0]->subject);
        $this->assertSame('200', $page->checkpoint->cursor('Inbox'));

        $result = $adapter->send($context, new Draft(
            from: new EmailAddress('isaac@hibarr.de'),
            to: ['lead@example.test'],
            subject: 'Hello',
            textBody: 'Plain',
        ));

        $this->assertSame(SendStatus::Accepted, $result->status);
        $this->assertSame('sent-1', $result->providerSubmissionId);
        $this->assertNotSame('delivered', $result->status->value);

        Http::assertSent(fn (Request $request) => str_contains($request->url(), '/messages/view')
            && $request->hasHeader('Authorization', 'Zoho-oauthtoken user-access'));
        Http::assertNotSent(fn (Request $request) => str_contains($request->body().$request->url(), self::CALENDAR_REFRESH));
    }

    public function test_failed_attachment_does_not_call_zoho(): void
    {
        Http::fake();
        $this->app->instance(AttachmentStore::class, new class implements AttachmentStore
        {
            public function read(string $storageKey): ?string
            {
                return null;
            }
        });

        $result = app(ZohoMailAdapter::class)->send($this->context(), new Draft(
            from: new EmailAddress('isaac@hibarr.de'),
            to: ['lead@example.test'],
            subject: 'File',
            textBody: 'See attached',
            attachments: [new DraftAttachment('missing', 'a.pdf', 'application/pdf')],
        ));

        $this->assertSame(SendStatus::Rejected, $result->status);
        $this->assertSame('attachment_unavailable', $result->errorCode);
        Http::assertNothingSent();
    }

    public function test_oauth_callback_stores_a_per_user_refresh_token(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, true);
        $agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();
        cache()->forever('user_is_active_'.$agent->id, true);
        $this->actingAs($agent);

        Http::fake(fn (Request $request) => $this->zohoResponse($request, [
            'access_token' => 'user-access',
            'refresh_token' => self::USER_REFRESH,
            'expires_in' => 3600,
        ]));

        $start = $this->get('/email/connections/zoho/redirect?return=/leads');
        $start->assertRedirect();
        $location = (string) $start->headers->get('Location');
        $this->assertStringStartsWith('https://accounts.zoho.test/oauth/v2/auth?', $location);
        $this->assertStringContainsString('client_id='.self::MAIL_CLIENT, $location);
        $this->assertStringContainsString('redirect_uri=', $location);
        $this->assertStringNotContainsString(self::MAIL_SECRET, $location);
        $this->assertStringNotContainsString(self::CALENDAR_REFRESH, $location);

        parse_str((string) parse_url($location, PHP_URL_QUERY), $query);

        $this->get('/email/connections/zoho/callback?code=auth-code&state='.$query['state'])
            ->assertRedirect('/leads?email_connected=1');

        $connection = EmailConnection::withoutGlobalScopes()->sole();

        $this->assertSame('zoho', $connection->provider);
        $this->assertSame('isaac@hibarr.de', $connection->identity_email);
        $this->assertSame((int) $agent->id, (int) $connection->user_id);
        $this->assertSame(self::USER_REFRESH, $connection->credentials['refresh_token']);
        $this->assertSame('555', $connection->credentials['account_id']);
        $this->assertNotSame(self::CALENDAR_REFRESH, $connection->credentials['refresh_token']);
        $this->assertSame('active', $connection->status->value);

        Http::assertSent(function (Request $request) {
            if (! str_contains($request->url(), '/oauth/v2/token')) {
                return false;
            }

            return str_contains($request->body(), 'client_id='.self::MAIL_CLIENT)
                && str_contains($request->body(), 'code=auth-code')
                && ! str_contains($request->body(), self::CALENDAR_REFRESH)
                && ! str_contains($request->body(), 'calendar-client');
        });
    }

    public function test_posting_zoho_secrets_is_rejected(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, true);
        $agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();
        cache()->forever('user_is_active_'.$agent->id, true);
        $this->actingAs($agent);

        $this->postJson('/email/connections', [
            'provider' => 'zoho',
            'identity_email' => 'isaac@hibarr.de',
            'refresh_token' => self::CALENDAR_REFRESH,
        ])->assertStatus(422)->assertJsonValidationErrors(['provider']);

        $this->assertSame(0, EmailConnection::withoutGlobalScopes()->count());
    }

    public function test_oauth_routes_fail_closed_when_the_flag_is_off(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $this->get('/email/connections/zoho/redirect')->assertNotFound();
        $this->get('/email/connections/zoho/callback')->assertNotFound();
    }

    private function configureZoho(): void
    {
        config([
            'email.zoho.client_id' => self::MAIL_CLIENT,
            'email.zoho.client_secret' => self::MAIL_SECRET,
            'email.zoho.redirect_uri' => 'https://staging-crm.hibarr.org/email/connections/zoho/callback',
            'email.zoho.accounts_url' => 'https://accounts.zoho.test',
            'email.zoho.api_base_url' => 'https://mail.zoho.test',
            'zoho.client_id' => 'calendar-client',
            'zoho.client_secret' => 'calendar-secret',
            'zoho.refresh_token' => self::CALENDAR_REFRESH,
        ]);
    }

    private function context(?int $expiresAt = null, string $access = 'user-access'): ConnectionContext
    {
        $identity = new EmailAddress('isaac@hibarr.de');

        return new ConnectionContext('conn-zoho', 'zoho', $identity, $identity, null, [
            'refresh_token' => self::USER_REFRESH,
            'access_token' => $access,
            'expires_at' => $expiresAt ?? (time() + 3600),
            'account_id' => '555',
        ]);
    }

    private function zohoResponse(Request $request, ?array $token = null): \GuzzleHttp\Promise\PromiseInterface
    {
        $path = (string) parse_url($request->url(), PHP_URL_PATH);

        if (str_ends_with($path, '/oauth/v2/token')) {
            return Http::response($token ?? [
                'access_token' => 'user-access',
                'refresh_token' => self::USER_REFRESH,
                'expires_in' => 3600,
            ]);
        }

        if ($path === '/api/accounts') {
            return Http::response([
                'status' => ['code' => 200, 'description' => 'success'],
                'data' => [[
                    'accountId' => '555',
                    'primaryEmailAddress' => 'isaac@hibarr.de',
                ]],
            ]);
        }

        if (str_ends_with($path, '/folders')) {
            return Http::response([
                'status' => ['code' => 200, 'description' => 'success'],
                'data' => [
                    ['folderId' => '10', 'folderName' => 'Inbox', 'folderType' => 'Inbox'],
                    ['folderId' => '20', 'folderName' => 'Sent', 'folderType' => 'Sent'],
                ],
            ]);
        }

        if (str_contains($path, '/messages/view')) {
            $query = [];
            parse_str((string) parse_url($request->url(), PHP_URL_QUERY), $query);

            if (($query['folderId'] ?? null) !== '10') {
                return Http::response([
                    'status' => ['code' => 200, 'description' => 'success'],
                    'data' => [],
                ]);
            }

            return Http::response([
                'status' => ['code' => 200, 'description' => 'success'],
                'data' => [[
                    'messageId' => '200',
                    'folderId' => '10',
                    'subject' => 'Villa',
                    'fromAddress' => 'lead@example.test',
                    'toAddress' => 'isaac@hibarr.de',
                    'ccAddress' => 'Not Provided',
                    'receivedTime' => '1700000000000',
                    'sentDateInGMT' => '1700000000000',
                    'hasAttachment' => '0',
                ]],
            ]);
        }

        if (str_ends_with($path, '/content')) {
            return Http::response([
                'status' => ['code' => 200, 'description' => 'success'],
                'data' => ['content' => 'Hello'],
            ]);
        }

        if (str_ends_with($path, '/header')) {
            return Http::response([
                'status' => ['code' => 200, 'description' => 'success'],
                'data' => [
                    'headerContent' => "Message-ID: <msg-200@hibarr.de>\r\nSubject: Villa\r\nFrom: lead@example.test\r\nTo: isaac@hibarr.de\r\n",
                ],
            ]);
        }

        if (str_ends_with($path, '/messages')) {
            return Http::response([
                'status' => ['code' => 200, 'description' => 'success'],
                'data' => ['messageId' => 'sent-1'],
            ]);
        }

        return Http::response(['status' => ['code' => 404, 'description' => 'missing']], 404);
    }
}
