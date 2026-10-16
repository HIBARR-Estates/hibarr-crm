<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Connections\ConnectionManager;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\EmailFeature;
use App\Email\Exceptions\EmailUnavailableException;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Observability\EmailLog;
use App\Email\Sending\SendAttemptService;
use App\Email\Sync\MailboxSynchronizer;
use App\Models\User;
use Illuminate\Log\Events\MessageLogged;
use Illuminate\Support\Facades\Event;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailObservabilityTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private User $agent;

    private EmailConnection $connection;

    /** @var list<array{level: string, message: string, context: array<string, mixed>}> */
    private array $logs = [];

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'anna@agency.test',
            'from_email' => 'anna@agency.test',
        ]);

        $this->logs = [];
        Event::listen(MessageLogged::class, function (MessageLogged $event): void {
            $this->logs[] = [
                'level' => $event->level,
                'message' => $event->message,
                'context' => $event->context,
            ];
        });
    }

    /** E-37: sample log lines never include body or token material. */
    public function test_sample_log_line_has_no_body_or_token(): void
    {
        EmailLog::info('email.test.scrub', [
            'connection_id' => $this->connection->uuid,
            'body' => 'SECRET BODY CONTENT',
            'text_body' => 'plain secret',
            'html_body' => '<p>html secret</p>',
            'credentials' => ['token' => 'super-secret-token', 'smtp_password' => 'pw'],
            'api_token' => 'mailtrap-token-value',
            'smtp_password' => 'smtp-secret',
            'draft_payload' => ['subject' => 'x', 'text_body' => 'y'],
            'status' => 'stopped',
        ]);

        $scrub = $this->findLog('email.test.scrub');
        $this->assertNotNull($scrub);
        $context = $scrub['context'];
        $encoded = json_encode($context, JSON_THROW_ON_ERROR);

        $this->assertSame('email.test.scrub', $context['event'] ?? null);
        $this->assertSame($this->connection->uuid, $context['connection_id'] ?? null);
        $this->assertSame('stopped', $context['status'] ?? null);

        $this->assertArrayNotHasKey('body', $context);
        $this->assertArrayNotHasKey('text_body', $context);
        $this->assertArrayNotHasKey('html_body', $context);
        $this->assertArrayNotHasKey('credentials', $context);
        $this->assertArrayNotHasKey('api_token', $context);
        $this->assertArrayNotHasKey('smtp_password', $context);
        $this->assertArrayNotHasKey('draft_payload', $context);

        $this->assertStringNotContainsString('SECRET BODY', $encoded);
        $this->assertStringNotContainsString('super-secret-token', $encoded);
        $this->assertStringNotContainsString('mailtrap-token-value', $encoded);
        $this->assertStringNotContainsString('smtp-secret', $encoded);

        // Real lifecycle path: stop + sync metric + refused send — still no secrets.
        app(ConnectionManager::class)->stop($this->connection);

        app(FakeMailAdapter::class)->seedInbound($this->connection->toContext(), [
            'subject' => 'Visible subject only',
            'text' => 'BODY MUST NOT BE LOGGED',
        ]);
        (new SyncMailboxJob($this->connection->id))->handle(app(MailboxSynchronizer::class));

        try {
            app(SendAttemptService::class)->send($this->connection, new Draft(
                from: new EmailAddress('anna@agency.test'),
                to: ['lead@example.test'],
                subject: 'Outbound',
                textBody: 'SEND BODY MUST NOT APPEAR',
            ), $this->agent);
            $this->fail('Stopped connection must refuse send.');
        } catch (EmailUnavailableException $exception) {
            $this->assertSame('connection_inactive', $exception->reason);
        }

        $this->assertNotNull($this->findLog('email.connection.stop'));
        $this->assertNotNull($this->findLog('email.job.sync'));

        foreach ($this->logs as $entry) {
            $encoded = json_encode($entry['context'], JSON_THROW_ON_ERROR);
            $this->assertStringNotContainsString('BODY MUST NOT', $encoded);
            $this->assertStringNotContainsString('SEND BODY MUST NOT APPEAR', $encoded);
            $this->assertStringNotContainsString('SECRET BODY', $encoded);
            $this->assertStringNotContainsString('super-secret-token', $encoded);
            $this->assertStringNotContainsString('fake-token', $encoded);
        }
    }

    public function test_scrub_drops_nested_secret_bags(): void
    {
        $clean = EmailLog::scrub([
            'ok' => 1,
            'Authorization' => 'Bearer abc.def.ghi',
            'nested' => ['smtp_password' => 'x', 'inbox_id' => '1'],
        ]);

        $this->assertSame(['ok' => 1], $clean);
    }

    /**
     * @return array{level: string, message: string, context: array<string, mixed>}|null
     */
    private function findLog(string $message): ?array
    {
        foreach ($this->logs as $entry) {
            if ($entry['message'] === $message) {
                return $entry;
            }
        }

        return null;
    }
}
