<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Notifications\InboundMailNotification;
use App\Models\Company;
use App\Services\NotificationService;
use DateTimeImmutable;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class InboundMailNotificationTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);
        $this->company = $this->makeEmailCompany();
        Mail::fake();
    }

    public function test_first_inbound_copy_notifies_the_owner_once_without_the_body(): void
    {
        $agent = $this->makeEmailUser($this->company);
        $connection = EmailConnection::factory()->forUser($agent)->create();
        $body = 'SECRET-BODY-TOKEN that must not be copied into the bell';
        $sender = str_repeat('A', 200).' <sender@example.test>';

        $copy = $this->ingest($connection, MessageDirection::Inbound, 'prov-1', $sender, 'Hello there', $body);
        $this->ingest($connection, MessageDirection::Inbound, 'prov-1', $sender, 'Hello there', $body);

        $rows = $agent->notifications()->get();

        $this->assertCount(1, $rows);
        $this->assertSame(InboundMailNotification::class, $rows[0]->type);

        $data = $rows[0]->data;
        $this->assertSame('/email/inbox?focus='.$copy->uuid, $data['action_url']);
        $this->assertSame('Hello there', $data['subject']);
        $this->assertLessThanOrEqual(120, strlen($data['sender']));
        $this->assertStringStartsWith('AAAA', $data['sender']);
        $this->assertArrayNotHasKey('body', $data);
        $this->assertStringNotContainsString('SECRET-BODY-TOKEN', json_encode($data));

        $formatted = app(NotificationService::class)->formatNotification($rows[0]);
        $this->assertSame('mail', $formatted['icon']);
        $this->assertSame($data['action_url'], $formatted['link']);

        Mail::assertNothingSent();
    }

    public function test_outbound_mail_does_not_notify(): void
    {
        $agent = $this->makeEmailUser($this->company);
        $connection = EmailConnection::factory()->forUser($agent)->create();

        $this->ingest($connection, MessageDirection::Outbound, 'prov-out', 'lead@example.test', 'Sent', 'body');

        $this->assertSame(0, $agent->notifications()->count());
    }

    public function test_each_mailbox_that_received_the_message_is_notified(): void
    {
        $first = $this->makeEmailUser($this->company);
        $second = $this->makeEmailUser($this->company);
        $firstConnection = EmailConnection::factory()->forUser($first)->create();
        $secondConnection = EmailConnection::factory()->forUser($second)->create();
        $rfc = '<shared-'.Str::random(8).'@mail.test>';

        $firstCopy = $this->ingest($firstConnection, MessageDirection::Inbound, 'prov-a', 'lead@example.test', 'Shared', 'body', $rfc);
        $secondCopy = $this->ingest($secondConnection, MessageDirection::Inbound, 'prov-b', 'lead@example.test', 'Shared', 'body', $rfc);

        $this->assertSame(
            '/email/inbox?focus='.$firstCopy->uuid,
            $first->notifications()->first()->data['action_url'],
        );
        $this->assertSame(
            '/email/inbox?focus='.$secondCopy->uuid,
            $second->notifications()->first()->data['action_url'],
        );
        $this->assertNotSame($firstCopy->uuid, $secondCopy->uuid);
    }

    private function ingest(
        EmailConnection $connection,
        MessageDirection $direction,
        string $providerMessageId,
        string $from,
        string $subject,
        string $body,
        ?string $rfcMessageId = null,
    ): EmailMailboxCopy {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: $providerMessageId,
            direction: $direction,
            from: EmailAddress::tryParse($from),
            to: [$connection->identity_email],
            sentAt: new DateTimeImmutable('-1 hour'),
            subject: $subject,
            textBody: $body,
            rfcMessageId: $rfcMessageId ?? '<'.Str::random(12).'@mail.test>',
            folder: 'INBOX',
        ));
    }
}
