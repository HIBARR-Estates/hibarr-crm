<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Data\AttachmentRef;
use App\Email\Data\Checkpoint;
use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Models\Company;
use DateTimeImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\TestCase;

class MessageIngestorTest extends TestCase
{
    use BuildsEmailSchema;

    private MessageIngestor $ingestor;

    private FakeMailAdapter $fake;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();

        $this->ingestor = app(MessageIngestor::class);
        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
    }

    public function test_tables_exist_with_the_domain_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('email_messages', [
            'uuid', 'company_id', 'rfc_message_id', 'thread_keys', 'from_email', 'to_recipients', 'cc_recipients',
            'subject', 'sent_at', 'text_body', 'html_raw', 'html_safe', 'has_attachments',
        ]));
        $this->assertTrue(Schema::hasColumns('email_mailbox_copies', [
            'uuid', 'company_id', 'connection_id', 'message_id', 'provider_message_id', 'folder', 'direction', 'review_status',
        ]));
    }

    public function test_ingest_stores_a_canonical_message_and_this_mailboxs_copy(): void
    {
        $connection = $this->connection();

        $copy = $this->ingestor->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-1',
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse('Lead Person <Lead@Example.test>'),
            to: [$connection->identity_email],
            cc: ['Partner <partner@example.test>'],
            replyTo: ['assistant@example.test'],
            sentAt: new DateTimeImmutable('2026-10-01T09:30:00+00:00'),
            subject: 'Re: Villa viewing',
            textBody: 'See you Friday.',
            htmlRaw: '<p onclick="x()">See you Friday.</p>',
            attachments: [new AttachmentRef('part-2', 'plan.pdf', 'application/pdf', 2048)],
            rfcMessageId: 'reply-1@mail.example.test',
            inReplyTo: '<root@mail.example.test>',
            references: '<root@mail.example.test>',
            folder: 'INBOX',
        ));

        $copy = $copy->fresh();
        $message = $copy->message;

        $this->assertTrue(Str::isUuid($copy->uuid));
        $this->assertTrue(Str::isUuid($message->uuid));
        $this->assertSame($connection->id, $copy->connection_id);
        $this->assertSame((int) $this->company->id, (int) $copy->company_id);
        $this->assertSame((int) $this->company->id, (int) $message->company_id);
        $this->assertSame('prov-1', $copy->provider_message_id);
        $this->assertSame('INBOX', $copy->folder);
        $this->assertSame(MessageDirection::Inbound, $copy->direction);
        // No lead holds the sender's address, so the copy waits in review.
        $this->assertSame(ReviewStatus::Unlinked, $copy->review_status);
        $this->assertSame('part-2', $copy->provider_attachments[0]['part_id']);

        $this->assertSame('<reply-1@mail.example.test>', $message->rfc_message_id);
        $this->assertSame('<root@mail.example.test>', $message->in_reply_to);
        $this->assertSame(['<root@mail.example.test>'], $message->reference_ids);
        $this->assertSame(['<reply-1@mail.example.test>', '<root@mail.example.test>'], $message->thread_keys);
        $this->assertSame('lead@example.test', $message->from_email);
        $this->assertSame('Lead Person', $message->from_name);
        $this->assertSame([['address' => $connection->identity_email, 'name' => null]], $message->to_recipients);
        $this->assertSame([['address' => 'partner@example.test', 'name' => 'Partner']], $message->cc_recipients);
        $this->assertSame('Re: Villa viewing', $message->subject);
        $this->assertSame('2026-10-01 09:30:00', $message->sent_at->utc()->format('Y-m-d H:i:s'));
        $this->assertSame('See you Friday.', $message->text_body);
        $this->assertSame('<p onclick="x()">See you Friday.</p>', $message->html_raw);
        $this->assertSame('<p>See you Friday.</p>', $message->html_safe);
        $this->assertTrue($message->has_attachments);
        $this->assertArrayNotHasKey('html_raw', $message->toArray());
    }

    public function test_double_ingest_of_the_same_provider_id_yields_one_copy(): void
    {
        $connection = $this->connection();
        $seeded = $this->fake->seedInbound($connection->toContext(), ['subject' => 'Once']);

        $first = $this->ingestor->ingestNormalized($connection, $seeded);
        $second = $this->ingestor->ingestNormalized($connection, $seeded);

        $this->assertSame($first->id, $second->id);
        $this->assertSame($first->uuid, $second->uuid);
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
    }

    public function test_double_ingest_without_a_message_id_still_yields_one_copy_and_one_message(): void
    {
        $connection = $this->connection();
        $seeded = $this->fake->seedInbound($connection->toContext(), ['rfc_message_id' => null]);

        $this->ingestor->ingestNormalized($connection, $seeded);
        $this->ingestor->ingestNormalized($connection, $seeded);

        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertNull(EmailMessage::withoutGlobalScopes()->first()->rfc_message_id_hash);
    }

    public function test_same_rfc_id_on_two_connections_yields_one_message_and_two_copies(): void
    {
        $anna = $this->connection();
        $ben = $this->connection();

        $seeded = $this->fake->seedSameMessageOnConnections(
            [$anna->toContext(), $ben->toContext()],
            ['from' => 'lead@example.test', 'subject' => 'To both of you'],
        );

        $annaCopy = $this->ingestor->ingestNormalized($anna, $seeded[$anna->uuid]);
        $benCopy = $this->ingestor->ingestNormalized($ben, $seeded[$ben->uuid]);

        $this->assertNotSame($annaCopy->id, $benCopy->id);
        $this->assertSame($annaCopy->message_id, $benCopy->message_id);
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(2, $annaCopy->message->copies()->withoutGlobalScopes()->count());

        $recipients = array_column($annaCopy->message->to_recipients, 'address');

        $this->assertEqualsCanonicalizing([$anna->identity_email, $ben->identity_email], $recipients);
    }

    public function test_same_message_id_with_different_brackets_and_spacing_is_one_message(): void
    {
        $anna = $this->connection();
        $ben = $this->connection();

        $a = $this->ingestor->ingestNormalized($anna, $this->message('prov-a', rfcMessageId: 'same@mail.example.test'));
        $b = $this->ingestor->ingestNormalized($ben, $this->message('prov-b', rfcMessageId: ' <same@mail.example.test> '));

        $this->assertSame($a->message_id, $b->message_id);
    }

    public function test_same_subject_and_sender_without_a_shared_message_id_stay_separate(): void
    {
        $connection = $this->connection();

        $a = $this->ingestor->ingestNormalized($connection, $this->message('prov-a', rfcMessageId: 'one@mail.example.test'));
        $b = $this->ingestor->ingestNormalized($connection, $this->message('prov-b', rfcMessageId: 'two@mail.example.test'));
        $c = $this->ingestor->ingestNormalized($connection, $this->message('prov-c'));
        $d = $this->ingestor->ingestNormalized($connection, $this->message('prov-d'));

        $this->assertCount(4, array_unique([$a->message_id, $b->message_id, $c->message_id, $d->message_id]));
    }

    public function test_same_rfc_id_in_another_company_is_a_different_message(): void
    {
        $mine = $this->connection();
        $theirs = $this->connection($this->makeEmailCompany());

        $a = $this->ingestor->ingestNormalized($mine, $this->message('prov-a', rfcMessageId: 'shared@mail.example.test'));
        $b = $this->ingestor->ingestNormalized($theirs, $this->message('prov-b', rfcMessageId: 'shared@mail.example.test'));

        $this->assertNotSame($a->message_id, $b->message_id);
        $this->assertNotSame($a->company_id, $b->company_id);
        $this->assertSame(2, EmailMessage::withoutGlobalScopes()->count());
    }

    public function test_one_mailbox_can_hold_two_copies_of_one_message(): void
    {
        $connection = $this->connection();

        $sent = $this->ingestor->ingestNormalized($connection, $this->message('prov-sent', MessageDirection::Outbound, 'self@mail.example.test', folder: 'Sent'));
        $inbox = $this->ingestor->ingestNormalized($connection, $this->message('prov-inbox', MessageDirection::Inbound, 'self@mail.example.test'));

        $this->assertNotSame($sent->id, $inbox->id);
        $this->assertSame($sent->message_id, $inbox->message_id);
        $this->assertSame(MessageDirection::Outbound, $sent->direction);
        $this->assertSame(MessageDirection::Inbound, $inbox->direction);
    }

    public function test_later_copies_fill_gaps_but_never_overwrite_the_canonical_message(): void
    {
        $anna = $this->connection();
        $ben = $this->connection();

        $thin = new NormalizedMessage(
            providerMessageId: 'prov-thin',
            direction: MessageDirection::Inbound,
            from: new EmailAddress('lead@example.test'),
            subject: 'Original subject',
            rfcMessageId: 'thin@mail.example.test',
            partial: true,
        );
        $copy = $this->ingestor->ingestNormalized($anna, $thin);

        $this->assertTrue($copy->message->is_partial);
        $this->assertNull($copy->message->text_body);

        $this->ingestor->ingestNormalized($ben, new NormalizedMessage(
            providerMessageId: 'prov-full',
            direction: MessageDirection::Inbound,
            from: new EmailAddress('lead@example.test'),
            subject: 'Tampered subject',
            textBody: 'Full body',
            attachments: [new AttachmentRef('p1', 'plan.pdf')],
            rfcMessageId: 'thin@mail.example.test',
        ));

        $message = $copy->message->fresh();

        $this->assertSame('Original subject', $message->subject);
        $this->assertSame('Full body', $message->text_body);
        $this->assertTrue($message->has_attachments);
        $this->assertFalse($message->is_partial);

        // A thin payload arriving afterwards changes nothing.
        $this->ingestor->ingestNormalized($anna, $thin);

        $this->assertSame('Full body', $message->fresh()->text_body);
        $this->assertFalse($message->fresh()->is_partial);
    }

    public function test_bcc_stays_on_the_senders_copy_only(): void
    {
        $sender = $this->connection();
        $recipient = $this->connection();

        $sent = $this->ingestor->ingestNormalized($sender, new NormalizedMessage(
            providerMessageId: 'prov-sent',
            direction: MessageDirection::Outbound,
            from: new EmailAddress($sender->identity_email),
            to: [$recipient->identity_email],
            rfcMessageId: 'bcc@mail.example.test',
            folder: 'Sent',
            bcc: ['hidden@example.test'],
        ));
        $received = $this->ingestor->ingestNormalized($recipient, $this->message('prov-recv', rfcMessageId: 'bcc@mail.example.test'));

        $this->assertSame($sent->message_id, $received->message_id);
        $this->assertSame('hidden@example.test', $sent->fresh()->bcc_recipients[0]['address']);
        $this->assertNull($received->fresh()->bcc_recipients);
        $this->assertStringNotContainsString('hidden@example.test', (string) json_encode($sent->message->fresh()->getAttributes()));
    }

    public function test_reingest_follows_a_folder_move_without_resetting_review_state(): void
    {
        $connection = $this->connection();

        $copy = $this->ingestor->ingestNormalized($connection, $this->message('prov-1', rfcMessageId: 'move@mail.example.test'));
        $copy->update(['review_status' => ReviewStatus::Dismissed]);

        $again = $this->ingestor->ingestNormalized($connection, $this->message('prov-1', rfcMessageId: 'move@mail.example.test', folder: 'Archive'));

        $this->assertSame($copy->id, $again->id);
        $this->assertSame('Archive', $again->fresh()->folder);
        $this->assertSame(ReviewStatus::Dismissed, $again->fresh()->review_status);
    }

    public function test_fake_fetch_then_ingest_is_idempotent_across_repeated_syncs(): void
    {
        $connection = $this->connection();
        $context = $connection->toContext();

        $this->fake->seedInbound($context);
        $this->fake->seedOutbound($context);

        foreach ([1, 2] as $run) {
            foreach ($this->fake->fetchSince($context, Checkpoint::start(), [])->messages as $message) {
                $this->ingestor->ingestNormalized($connection, $message);
            }
        }

        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(2, EmailMessage::withoutGlobalScopes()->count());
    }

    public function test_database_rejects_duplicate_copies_and_duplicate_canonical_messages(): void
    {
        $connection = $this->connection();
        $copy = $this->ingestor->ingestNormalized($connection, $this->message('prov-1', rfcMessageId: 'dup@mail.example.test'));

        try {
            DB::table('email_mailbox_copies')->insert([
                'uuid' => (string) Str::uuid(),
                'company_id' => $copy->company_id,
                'connection_id' => $connection->id,
                'message_id' => $copy->message_id,
                'provider_message_id' => 'prov-1',
                'direction' => 'inbound',
            ]);
            $this->fail('Expected the duplicate copy to be rejected.');
        } catch (QueryException) {
            $this->assertSame(1, DB::table('email_mailbox_copies')->count());
        }

        $this->expectException(QueryException::class);

        DB::table('email_messages')->insert([
            'uuid' => (string) Str::uuid(),
            'company_id' => $copy->company_id,
            'rfc_message_id' => '<dup@mail.example.test>',
            'rfc_message_id_hash' => EmailMessage::hashRfcMessageId('<dup@mail.example.test>'),
        ]);
    }

    public function test_copies_and_messages_are_isolated_to_the_logged_in_users_company(): void
    {
        $owner = $this->makeEmailUser($this->company);
        $mine = EmailConnection::factory()->forUser($owner)->create();
        $theirs = $this->connection($this->makeEmailCompany());

        $this->ingestor->ingestNormalized($mine, $this->message('prov-a'));
        $other = $this->ingestor->ingestNormalized($theirs, $this->message('prov-b'));

        $this->actingAs($owner);

        $this->assertSame(1, EmailMailboxCopy::query()->count());
        $this->assertSame(1, EmailMessage::query()->count());
        $this->assertNull(EmailMailboxCopy::query()->find($other->id));
        $this->assertNull(EmailMessage::query()->find($other->message_id));
    }

    private function connection(?Company $company = null): EmailConnection
    {
        return EmailConnection::factory()->forUser($this->makeEmailUser($company ?? $this->company))->create();
    }

    private function message(
        string $providerMessageId,
        MessageDirection $direction = MessageDirection::Inbound,
        ?string $rfcMessageId = null,
        ?string $folder = 'INBOX',
    ): NormalizedMessage {
        return new NormalizedMessage(
            providerMessageId: $providerMessageId,
            direction: $direction,
            from: new EmailAddress('lead@example.test'),
            to: ['agent@agency.test'],
            sentAt: new DateTimeImmutable('2026-10-01T09:30:00+00:00'),
            subject: 'Villa viewing',
            textBody: 'Hello',
            rfcMessageId: $rfcMessageId,
            folder: $folder,
        );
    }
}
