<?php

namespace Tests\Unit\Notifications;

use App\Models\User;
use App\Services\Notifications\UnsEmailPayloadMapper;
use Illuminate\Support\Facades\Config;
use Symfony\Component\Mime\Email;
use Tests\TestCase;

class UnsEmailPayloadMapperTest extends TestCase
{
    public function test_it_prefers_recipient_user_id_when_email_maps_to_internal_user(): void
    {
        $mapper = new StubUnsEmailPayloadMapper(
            usersByEmail: [
                'recipient@test.local' => $this->makeUser(101, 10),
                'sender@test.local' => $this->makeUser(202, 10),
            ],
            resolverFallbackUserId: 303
        );

        $payload = $mapper->map(
            (new Email())
                ->from('sender@test.local')
                ->to('recipient@test.local')
                ->subject('Subject')
                ->html('<p>Hello</p>')
        );

        $this->assertSame(101, $payload['userId']);
        $this->assertSame('recipient@test.local', $payload['data']['emailAddress']);
    }

    public function test_it_uses_sender_when_recipient_is_external(): void
    {
        $mapper = new StubUnsEmailPayloadMapper(
            usersByEmail: [
                'sender@test.local' => $this->makeUser(202, 10),
            ],
            resolverFallbackUserId: 303
        );

        $payload = $mapper->map(
            (new Email())
                ->from('sender@test.local')
                ->to('external@example.com')
                ->subject('Subject')
                ->text('Hello')
        );

        $this->assertSame(202, $payload['userId']);
    }

    public function test_it_uses_resolver_fallback_then_config_default(): void
    {
        Config::set('services.notification_service.default_user_id', 999);

        $withResolverFallback = (new StubUnsEmailPayloadMapper([], 303))->map(
            (new Email())
                ->from('unknown-sender@example.com')
                ->to('external@example.com')
                ->subject('Subject')
                ->text('Hello')
        );
        $withoutResolverFallback = (new StubUnsEmailPayloadMapper([], null))->map(
            (new Email())
                ->from('unknown-sender@example.com')
                ->to('external@example.com')
                ->subject('Subject')
                ->text('Hello')
        );

        $this->assertSame(303, $withResolverFallback['userId']);
        $this->assertSame(999, $withoutResolverFallback['userId']);
    }

    public function test_it_generates_deterministic_idempotency_key(): void
    {
        $mapper = new StubUnsEmailPayloadMapper([], null);

        $email = (new Email())
            ->from('sender@test.local')
            ->to('external@example.com')
            ->subject('Subject')
            ->html('<p>Body</p>');

        $first = $mapper->map($email);
        $second = $mapper->map($email);

        $this->assertSame($first['idempotencyKey'], $second['idempotencyKey']);
        $this->assertStringStartsWith('crm-email-', $first['idempotencyKey']);
    }

    public function test_it_prefers_custom_idempotency_header(): void
    {
        $mapper = new StubUnsEmailPayloadMapper([], null);

        $email = (new Email())
            ->from('sender@test.local')
            ->to('external@example.com')
            ->subject('Subject')
            ->html('<p>Body</p>');
        $email->getHeaders()->addTextHeader(
            UnsEmailPayloadMapper::IDEMPOTENCY_HEADER,
            'crm-reminder-26-unique'
        );

        $payload = $mapper->map($email);

        $this->assertSame('crm-reminder-26-unique', $payload['idempotencyKey']);
    }

    private function makeUser(int $id, int $companyId): User
    {
        $user = new User();
        $user->forceFill([
            'id' => $id,
            'company_id' => $companyId,
            'email' => "user{$id}@test.local",
        ]);

        return $user;
    }
}

class StubUnsEmailPayloadMapper extends UnsEmailPayloadMapper
{
    /**
     * @param array<string, User> $usersByEmail
     */
    public function __construct(
        private readonly array $usersByEmail,
        private readonly ?int $resolverFallbackUserId
    ) {
    }

    protected function findUserByEmail(string $email): ?User
    {
        return $this->usersByEmail[$email] ?? null;
    }

    protected function resolveCommunicationResolverFallbackUserId(?int $companyId): ?int
    {
        return $this->resolverFallbackUserId;
    }
}
