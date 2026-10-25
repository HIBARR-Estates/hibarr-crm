<?php

namespace Tests\Unit\Notifications;

use App\Services\Notifications\MailCategory;
use App\Services\Notifications\MailDeliveryContext;
use App\Services\Notifications\UnsClient;
use App\Services\Notifications\UnsEmailPayloadMapper;
use App\Services\Notifications\UnsRoutingTransport;
use App\Services\Suppression\SuppressionCheckResult;
use App\Services\Suppression\SuppressionClient;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Tests\TestCase;

class UnsRoutingTransportTest extends TestCase
{
    public function test_it_uses_fallback_transport_when_uns_header_missing(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $transport = new UnsRoutingTransport(
            new FakeUnsClient(true),
            new FakeMapper(),
            $fallback,
            app(\App\Services\Notifications\MailDeliveryRecorder::class),
            new FakeSuppressionClient()
        );

        $result = $transport->send($this->buildMessage(withUnsRoute: false));

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(1, $fallback->sendCount);
    }

    public function test_it_routes_to_uns_when_header_is_set(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $client = new FakeUnsClient(true);
        $transport = new UnsRoutingTransport(
            $client,
            new FakeMapper(),
            $fallback,
            app(\App\Services\Notifications\MailDeliveryRecorder::class),
            new FakeSuppressionClient()
        );

        $result = $transport->send($this->buildMessage(withUnsRoute: true));

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(0, $fallback->sendCount);
        $this->assertSame(1, $client->sendCount);
    }

    public function test_it_falls_back_to_smtp_when_uns_dispatch_fails(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $transport = new UnsRoutingTransport(
            new FakeUnsClient(false),
            new FakeMapper(),
            $fallback,
            app(\App\Services\Notifications\MailDeliveryRecorder::class),
            new FakeSuppressionClient()
        );

        $result = $transport->send($this->buildMessage(withUnsRoute: true));

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(1, $fallback->sendCount);
    }

    public function test_it_uses_fallback_transport_when_message_has_attachments(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $client = new FakeUnsClient(true);
        $transport = new UnsRoutingTransport(
            $client,
            new FakeMapper(),
            $fallback,
            app(\App\Services\Notifications\MailDeliveryRecorder::class),
            new FakeSuppressionClient()
        );

        $email = $this->buildMessage(withUnsRoute: true);
        if ($email instanceof Email) {
            $email->attach('BEGIN:VCALENDAR', 'meeting.ics', 'text/calendar');
        }

        $result = $transport->send($email);

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(1, $fallback->sendCount);
        $this->assertSame(0, $client->sendCount);
    }

    public function test_it_withholds_a_blocked_recipient_without_calling_the_fallback(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $suppression = new FakeSuppressionClient(blocked: true, reason: 'unsubscribed');
        $transport = $this->transport($fallback, $suppression);

        $result = $transport->send($this->buildMessage());

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(0, $fallback->sendCount);
        $this->assertCount(1, $suppression->checked);
        $this->assertSame(SuppressionClient::SCOPE_NON_TRANSACTIONAL, $suppression->checked[0][0]['scope']);
    }

    public function test_it_keeps_the_original_suppression_reason_for_the_caller(): void
    {
        $reason = str_repeat('x', 250);
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $suppression = new FakeSuppressionClient(blocked: true, reason: $reason);
        $recorder = app(\App\Services\Notifications\MailDeliveryRecorder::class);
        $transport = new UnsRoutingTransport(
            new FakeUnsClient(true),
            new FakeMapper(),
            $fallback,
            $recorder,
            $suppression,
        );

        $message = $this->buildMessage();
        $this->assertInstanceOf(Email::class, $message);
        MailDeliveryContext::attach($message, ['correlation_id' => 'suppression-reason-test']);

        $transport->send($message);

        $outcome = $recorder->pull('suppression-reason-test');

        $this->assertIsArray($outcome);
        $this->assertSame($reason, $outcome['suppression_reason']);
    }

    public function test_it_delivers_when_the_flag_is_off_and_records_would_have_blocked(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $suppression = new FakeSuppressionClient(blocked: false, wouldBlock: true, reason: 'unsubscribed');
        $transport = $this->transport($fallback, $suppression);

        $result = $transport->send($this->buildMessage());

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(1, $fallback->sendCount);
    }

    public function test_it_holds_non_transactional_mail_when_the_check_is_unavailable(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $suppression = new FakeSuppressionClient(unavailable: true);
        $transport = $this->transport($fallback, $suppression);

        $result = $transport->send($this->buildMessage());

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(0, $fallback->sendCount);
    }

    public function test_it_delivers_transactional_mail_when_the_check_is_unavailable(): void
    {
        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $suppression = new FakeSuppressionClient(unavailable: true);
        $transport = $this->transport($fallback, $suppression);

        $result = $transport->send($this->buildMessage(category: MailCategory::TRANSACTIONAL));

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(1, $fallback->sendCount);
        $this->assertSame(SuppressionClient::SCOPE_TRANSACTIONAL, $suppression->checked[0][0]['scope']);
    }

    private function transport(
        FakeFallbackTransport $fallback,
        FakeSuppressionClient $suppression,
    ): UnsRoutingTransport {
        return new UnsRoutingTransport(
            new FakeUnsClient(true),
            new FakeMapper(),
            $fallback,
            app(\App\Services\Notifications\MailDeliveryRecorder::class),
            $suppression,
        );
    }

    private function buildMessage(
        bool $withUnsRoute = false,
        ?string $category = null,
    ): RawMessage {
        $email = (new Email())
            ->from('sender@test.local')
            ->to('recipient@test.local')
            ->subject('Test')
            ->text('hello');

        if ($withUnsRoute) {
            $email->getHeaders()->addTextHeader('X-Uns-Route', 'true');
        }

        if ($category !== null) {
            MailCategory::attach($email, $category);
        }

        return $email;
    }
}

class FakeSuppressionClient extends SuppressionClient
{
    /** @var array<int, array<int, array{email?: string, phone?: string, scope: string}>> */
    public array $checked = [];

    public function __construct(
        private readonly bool $blocked = false,
        private readonly bool $wouldBlock = false,
        private readonly bool $unavailable = false,
        private readonly ?string $reason = null,
    ) {}

    public function checkBatch(array $items): array
    {
        $this->checked[] = $items;

        return array_map(function (array $item): SuppressionCheckResult {
            $scope = (string) ($item['scope'] ?? SuppressionClient::SCOPE_NON_TRANSACTIONAL);

            if ($this->unavailable) {
                return SuppressionCheckResult::unavailable($scope);
            }

            return new SuppressionCheckResult(
                blocked: $this->blocked,
                wouldBlock: $this->wouldBlock || $this->blocked,
                unavailable: false,
                scope: $scope,
                reason: $this->reason,
            );
        }, $items);
    }
}

class FakeUnsClient extends UnsClient
{
    public int $sendCount = 0;

    public function __construct(private readonly bool $result)
    {
    }

    public function send(array $payload): bool
    {
        $this->sendCount++;

        return $this->result;
    }
}

class FakeMapper extends UnsEmailPayloadMapper
{
    public function map(RawMessage $message, ?Envelope $envelope = null): array
    {
        return [
            'event' => 'CRM_EMAIL',
            'userId' => 1,
            'channels' => ['email'],
            'idempotencyKey' => 'id',
            'data' => [
                'emailAddress' => 'recipient@test.local',
                'subject' => 'Test',
                'body' => 'hello',
                'fromEmail' => 'sender@test.local',
            ],
        ];
    }
}

class FakeFallbackTransport implements TransportInterface
{
    public int $sendCount = 0;

    public function __construct(private readonly bool $shouldReturnSentMessage)
    {
    }

    public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
    {
        $this->sendCount++;

        if (!$this->shouldReturnSentMessage) {
            return null;
        }

        return new SentMessage(
            $message,
            $envelope ?? new Envelope(new Address('sender@test.local'), [new Address('recipient@test.local')])
        );
    }

    public function __toString(): string
    {
        return 'fake-fallback';
    }
}
