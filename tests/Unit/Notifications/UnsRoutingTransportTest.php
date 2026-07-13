<?php

namespace Tests\Unit\Notifications;

use App\Services\Notifications\UnsClient;
use App\Services\Notifications\UnsEmailPayloadMapper;
use App\Services\Notifications\UnsRoutingTransport;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class UnsRoutingTransportTest extends TestCase
{
    use SetsFeatureFlags;

    public function test_it_uses_fallback_transport_when_flag_is_off(): void
    {
        $this->setFeatureFlag('crm.notification-service-routing', false);

        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $transport = new UnsRoutingTransport(
            new FakeUnsClient(true),
            new FakeMapper(),
            $fallback
        );

        $result = $transport->send($this->buildMessage());

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(1, $fallback->sendCount);
    }

    public function test_it_routes_to_uns_when_flag_is_on(): void
    {
        $this->setFeatureFlag('crm.notification-service-routing', true);

        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $client = new FakeUnsClient(true);
        $transport = new UnsRoutingTransport(
            $client,
            new FakeMapper(),
            $fallback
        );

        $result = $transport->send($this->buildMessage());

        $this->assertInstanceOf(SentMessage::class, $result);
        $this->assertSame(0, $fallback->sendCount);
        $this->assertSame(1, $client->sendCount);
    }

    public function test_it_does_not_throw_when_uns_dispatch_fails(): void
    {
        $this->setFeatureFlag('crm.notification-service-routing', true);

        $fallback = new FakeFallbackTransport(shouldReturnSentMessage: true);
        $transport = new UnsRoutingTransport(
            new FakeUnsClient(false),
            new FakeMapper(),
            $fallback
        );

        $result = $transport->send($this->buildMessage());

        $this->assertNull($result);
        $this->assertSame(0, $fallback->sendCount);
    }

    private function buildMessage(): RawMessage
    {
        return (new Email())
            ->from('sender@test.local')
            ->to('recipient@test.local')
            ->subject('Test')
            ->text('hello');
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
