<?php

namespace Tests\Unit\Email;

use App\Email\Data\AttachmentContent;
use App\Email\Data\AttachmentRef;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\DraftAttachment;
use App\Email\Data\EmailAddress;
use App\Email\Data\FetchPage;
use App\Email\Data\HealthState;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Data\SendResult;
use App\Email\Data\SendStatus;
use App\Email\Exceptions\MailTransportException;
use App\Email\Support\RfcMessageId;
use DateTimeImmutable;
use InvalidArgumentException;
use PHPUnit\Framework\TestCase;

class EmailDataObjectsTest extends TestCase
{
    public function test_email_address_normalizes_and_compares_by_address(): void
    {
        $address = new EmailAddress('  Jane.Doe@Example.COM ', ' "Jane Doe" ');

        $this->assertSame('jane.doe@example.com', $address->address);
        $this->assertSame('Jane Doe', $address->name);
        $this->assertSame('example.com', $address->domain());
        $this->assertTrue($address->equals(new EmailAddress('JANE.DOE@example.com')));
        $this->assertEquals($address, EmailAddress::fromArray($address->toArray()));
    }

    public function test_email_address_rejects_invalid_input(): void
    {
        $this->expectException(InvalidArgumentException::class);

        new EmailAddress('not-an-address');
    }

    public function test_email_address_parses_headers_and_drops_malformed_ones(): void
    {
        $parsed = EmailAddress::tryParse('"Doe, Jane" <Jane@Example.com>');

        $this->assertSame('jane@example.com', $parsed->address);
        $this->assertSame('Doe, Jane', $parsed->name);
        $this->assertNull(EmailAddress::tryParse('undisclosed-recipients:;'));
        $this->assertNull(EmailAddress::tryParse(null));

        $list = EmailAddress::listFrom(['a@example.com', 'broken', 'A@example.com', new EmailAddress('b@example.com'), 42]);

        $this->assertSame(['a@example.com', 'b@example.com'], array_map(fn (EmailAddress $a) => $a->address, $list));
    }

    public function test_rfc_message_ids_are_normalized_strings(): void
    {
        $this->assertSame('<abc@mail.example.com>', RfcMessageId::normalize(' abc@mail.example.com '));
        $this->assertSame('<abc@mail.example.com>', RfcMessageId::normalize('<abc@mail.example.com>'));
        $this->assertNull(RfcMessageId::normalize(null));
        $this->assertNull(RfcMessageId::normalize('  '));
        $this->assertNull(RfcMessageId::normalize('two words'));

        $this->assertSame(
            ['<a@x>', '<b@x>'],
            RfcMessageId::parseList("<a@x>\r\n <b@x> <a@x>"),
        );
        $this->assertSame(['<a@x>', '<b@x>'], RfcMessageId::parseList(['a@x', '<b@x>', null]));
        $this->assertSame([], RfcMessageId::parseList(null));
    }

    public function test_normalized_message_carries_headers_and_thread_keys_without_subject(): void
    {
        $message = new NormalizedMessage(
            providerMessageId: 'prov-1',
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse('Lead <lead@example.com>'),
            to: ['agent@example.com'],
            cc: ['Second Agent <agent2@example.com>'],
            replyTo: ['assistant@example.com'],
            sentAt: new DateTimeImmutable('2026-10-01T09:30:00+00:00'),
            subject: 'Re: Villa viewing',
            textBody: 'See you Friday.',
            htmlRaw: '<p>See you Friday.</p>',
            attachments: [new AttachmentRef('part-2', 'plan.pdf', 'application/pdf', 2048)],
            rfcMessageId: 'reply-1@mail.example.com',
            inReplyTo: '<root@mail.example.com>',
            references: '<root@mail.example.com> <mid@mail.example.com>',
            folder: 'INBOX',
        );

        $this->assertSame('<reply-1@mail.example.com>', $message->rfcMessageId);
        $this->assertSame(
            ['<reply-1@mail.example.com>', '<root@mail.example.com>', '<mid@mail.example.com>'],
            $message->threadKeys(),
        );
        $this->assertSame(
            ['agent@example.com', 'agent2@example.com'],
            array_map(fn (EmailAddress $a) => $a->address, $message->recipients()),
        );
        $this->assertTrue($message->hasAttachments());
        $this->assertFalse($message->partial);
        $this->assertSame('2026-10-01T09:30:00+00:00', $message->sentAt->format(DATE_ATOM));

        $same_subject = new NormalizedMessage('prov-2', MessageDirection::Inbound, null, subject: 'Re: Villa viewing');

        $this->assertSame([], $same_subject->threadKeys());
    }

    public function test_draft_round_trips_through_array_for_send_attempt_storage(): void
    {
        $draft = new Draft(
            from: new EmailAddress('agent@example.com', 'Agent'),
            to: ['Lead <lead@example.com>'],
            cc: ['partner@example.com'],
            replyTo: new EmailAddress('replies@example.com'),
            subject: 'Villa viewing',
            textBody: 'Hello',
            htmlBody: '<p>Hello</p>',
            attachments: [new DraftAttachment('email-attachments/abc/plan.pdf', 'plan.pdf', 'application/pdf', 2048)],
            rfcMessageId: 'crm-1@crm.example.com',
            inReplyTo: '<root@mail.example.com>',
            references: ['<root@mail.example.com>'],
        );

        $restored = Draft::fromArray(json_decode((string) json_encode($draft->toArray()), true));

        $this->assertEquals($draft, $restored);
        $this->assertTrue($restored->isReply());
        $this->assertTrue($restored->hasRecipients());
        $this->assertArrayNotHasKey('bcc', $draft->toArray());
        $this->assertCount(2, $restored->recipients());
    }

    public function test_draft_without_to_has_no_recipients(): void
    {
        $draft = new Draft(new EmailAddress('agent@example.com'), cc: ['partner@example.com']);

        $this->assertFalse($draft->hasRecipients());
        $this->assertFalse($draft->isReply());
    }

    public function test_send_result_states(): void
    {
        $accepted = SendResult::accepted('sub-1');

        $this->assertTrue($accepted->isAccepted());
        $this->assertSame('sub-1', $accepted->providerSubmissionId);
        $this->assertSame(SendStatus::Rejected, SendResult::rejected('invalid_recipient')->status);
        $this->assertSame('invalid_recipient', SendResult::rejected('invalid_recipient')->errorCode);
        $this->assertSame(SendStatus::Unknown, SendResult::unknown('timeout')->status);
        $this->assertFalse(SendResult::unknown('timeout')->isAccepted());

        $throttled = SendResult::throttled(120);

        $this->assertSame(SendStatus::Throttled, $throttled->status);
        $this->assertSame(120, $throttled->retryAfterSeconds);
    }

    public function test_checkpoint_is_immutable_and_serializable(): void
    {
        $start = Checkpoint::start();
        $next = $start->with('INBOX', '1042')->with('Sent', '77');

        $this->assertTrue($start->isStart());
        $this->assertNull($start->cursor('INBOX'));
        $this->assertSame('1042', $next->cursor('INBOX'));
        $this->assertSame(['INBOX' => '1042', 'Sent' => '77'], $next->toArray());
        $this->assertTrue($next->equals(Checkpoint::fromArray(['Sent' => 77, 'INBOX' => '1042', 'Empty' => ''])));
        $this->assertTrue(Checkpoint::fromArray(null)->isStart());
    }

    public function test_fetch_page_holds_messages_and_next_checkpoint(): void
    {
        $checkpoint = Checkpoint::start()->with('INBOX', '5');
        $page = new FetchPage(
            [new NormalizedMessage('prov-1', MessageDirection::Outbound, new EmailAddress('agent@example.com'))],
            $checkpoint,
            hasMore: true,
        );

        $this->assertCount(1, $page->messages);
        $this->assertFalse($page->isEmpty());
        $this->assertTrue($page->hasMore);
        $this->assertSame($checkpoint, $page->checkpoint);
        $this->assertTrue(FetchPage::empty($checkpoint)->isEmpty());
    }

    public function test_connection_health_states(): void
    {
        $this->assertTrue(ConnectionHealth::ok()->isOk());
        $this->assertSame(HealthState::NeedsReconnect, ConnectionHealth::needsReconnect('missing_token')->state);
        $this->assertSame(300, ConnectionHealth::quotaBackoff(300)->retryAfterSeconds);
        $this->assertFalse(ConnectionHealth::unreachable('timeout')->isOk());
    }

    public function test_secrets_and_bodies_stay_out_of_dumps(): void
    {
        $agent = new EmailAddress('agent@example.com');
        $connection = new ConnectionContext('conn-1', 'mailtrap', $agent, $agent, null, ['api_token' => 'super-secret-token']);

        $this->assertSame('super-secret-token', $connection->credential('api_token'));
        $this->assertTrue($connection->hasCredential('api_token'));
        $this->assertFalse($connection->hasCredential('inbox_id'));
        $this->assertStringNotContainsString('super-secret-token', print_r($connection, true));

        $message = new NormalizedMessage('prov-1', MessageDirection::Inbound, $agent, textBody: 'private body text', htmlRaw: '<p>private html</p>');
        $draft = new Draft($agent, ['lead@example.com'], textBody: 'private draft text');
        $file = new AttachmentContent('plan.pdf', 'application/pdf', 'private-bytes');

        $dump = print_r([$message, $draft, $file], true);

        $this->assertStringNotContainsString('private', $dump);
        $this->assertSame(13, $file->sizeBytes());
    }

    public function test_transport_exception_exposes_only_a_code(): void
    {
        $exception = new MailTransportException('provider_timeout', retryable: true);

        $this->assertSame('provider_timeout', $exception->errorCode);
        $this->assertTrue($exception->retryable);
        $this->assertSame('Mail transport failed: provider_timeout', $exception->getMessage());
    }
}
