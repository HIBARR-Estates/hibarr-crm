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
            (new Email)
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
            (new Email)
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
            (new Email)
                ->from('unknown-sender@example.com')
                ->to('external@example.com')
                ->subject('Subject')
                ->text('Hello')
        );
        $withoutResolverFallback = (new StubUnsEmailPayloadMapper([], null))->map(
            (new Email)
                ->from('unknown-sender@example.com')
                ->to('external@example.com')
                ->subject('Subject')
                ->text('Hello')
        );

        $this->assertSame(303, $withResolverFallback['userId']);
        $this->assertSame(999, $withoutResolverFallback['userId']);
    }

    public function test_it_generates_stable_idempotency_key_for_retries(): void
    {
        $mapper = new StubUnsEmailPayloadMapper([], null);

        $email = (new Email)
            ->from('sender@test.local')
            ->to('external@example.com')
            ->subject('Subject')
            ->html('<p>Body</p>');

        $expected = 'crm-email-'.sha1('external@example.com|Subject|<p>Body</p>');

        $this->travelTo(now()->setTimestamp(1_700_000_000));
        $first = $mapper->map(clone $email);

        $this->travelTo(now()->setTimestamp(1_700_000_999));
        $second = $mapper->map(clone $email);

        $this->assertSame($expected, $first['idempotencyKey']);
        $this->assertSame($expected, $second['idempotencyKey']);
    }

    public function test_template_idempotency_key_uses_template_id(): void
    {
        $mapper = new StubUnsEmailPayloadMapper([], null);

        $email = (new Email)
            ->from('sender@test.local')
            ->to('owner@example.com')
            ->subject('Lead owner assigned - CRM')
            ->html('<p>unused</p>');
        $email->getHeaders()->addTextHeader('X-Plunk-Template-Id', 'tpl-lead-owner');
        $email->getHeaders()->addTextHeader(
            'X-Plunk-Template-Variables',
            base64_encode((string) json_encode(['leadName' => 'Alice']))
        );

        $expected = 'crm-email-'.sha1('owner@example.com|Lead owner assigned - CRM|tpl-lead-owner');

        $this->travelTo(now()->setTimestamp(1_700_000_100));
        $payload = $mapper->map($email);

        $this->assertSame($expected, $payload['idempotencyKey']);
    }

    public function test_idempotency_key_differs_for_separate_notifications(): void
    {
        $mapper = new StubUnsEmailPayloadMapper([], null);

        $firstEmail = (new Email)
            ->from('sender@test.local')
            ->to('owner@example.com')
            ->subject('Lead owner assigned - CRM')
            ->html('<p>unused</p>');
        $firstEmail->getHeaders()->addTextHeader('X-Plunk-Template-Id', 'tpl-lead-owner');

        $secondEmail = (new Email)
            ->from('sender@test.local')
            ->to('owner@example.com')
            ->subject('Deal stage changed - CRM')
            ->html('<p>unused</p>');
        $secondEmail->getHeaders()->addTextHeader('X-Plunk-Template-Id', 'tpl-deal-stage');

        $first = $mapper->map($firstEmail);
        $second = $mapper->map($secondEmail);

        $this->assertNotSame($first['idempotencyKey'], $second['idempotencyKey']);
    }

    public function test_it_prefers_custom_idempotency_header(): void
    {
        $mapper = new StubUnsEmailPayloadMapper([], null);

        $email = (new Email)
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
        $user = new User;
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
     * @param  array<string, User>  $usersByEmail
     */
    public function __construct(
        private readonly array $usersByEmail,
        private readonly ?int $resolverFallbackUserId
    ) {}

    protected function findUserByEmail(string $email): ?User
    {
        return $this->usersByEmail[$email] ?? null;
    }

    protected function resolveCommunicationResolverFallbackUserId(?int $companyId): ?int
    {
        return $this->resolverFallbackUserId;
    }
}
