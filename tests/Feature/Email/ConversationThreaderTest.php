<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use App\Models\Company;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\TestCase;

class ConversationThreaderTest extends TestCase
{
    use BuildsEmailSchema;

    private MessageIngestor $ingestor;

    private Company $company;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();

        $this->ingestor = app(MessageIngestor::class);
        $this->company = $this->makeEmailCompany();
        $this->connection = EmailConnection::factory()->forUser($this->makeEmailUser($this->company))->create();
    }

    public function test_reply_with_in_reply_to_joins_the_conversation(): void
    {
        $original = $this->ingest('<a@mail.test>');
        $reply = $this->ingest('<b@mail.test>', inReplyTo: '<a@mail.test>', subject: 'Something else entirely');

        $this->assertNotNull($original->conversation_id);
        $this->assertSame($original->conversation_id, $reply->conversation_id);
        $this->assertSame(1, $this->conversations());
    }

    public function test_reply_with_only_references_joins_the_conversation(): void
    {
        $original = $this->ingest('<a@mail.test>');
        $this->ingest('<unrelated@mail.test>');
        $reply = $this->ingest('<c@mail.test>', references: '<a@mail.test> <b-never-seen@mail.test>');

        $this->assertSame($original->conversation_id, $reply->conversation_id);
        $this->assertSame(2, $this->conversations());
    }

    public function test_same_subject_with_a_new_message_id_and_no_refs_is_not_joined(): void
    {
        $first = $this->ingest('<a@mail.test>', subject: 'Villa viewing');
        $second = $this->ingest('<b@mail.test>', subject: 'Villa viewing');
        $third = $this->ingest('<c@mail.test>', subject: 'Re: Villa viewing');
        $noId = $this->ingest(null, subject: 'Villa viewing');

        $ids = [$first->conversation_id, $second->conversation_id, $third->conversation_id, $noId->conversation_id];

        $this->assertNotContains(null, $ids);
        $this->assertCount(4, array_unique($ids));
        $this->assertSame(4, $this->conversations());
    }

    public function test_a_reply_that_arrives_before_its_original_is_joined_when_the_original_arrives(): void
    {
        $reply = $this->ingest('<b@mail.test>', inReplyTo: '<a@mail.test>');
        $original = $this->ingest('<a@mail.test>');

        $this->assertSame($reply->conversation_id, $original->conversation_id);
        $this->assertSame(1, $this->conversations());
    }

    public function test_replies_to_an_original_the_crm_never_received_share_a_conversation(): void
    {
        $first = $this->ingest('<b@mail.test>', inReplyTo: '<never-seen@mail.test>');
        $second = $this->ingest('<c@mail.test>', references: '<never-seen@mail.test>');

        $this->assertSame($first->conversation_id, $second->conversation_id);
        $this->assertSame(1, $this->conversations());
    }

    public function test_a_message_that_ties_two_conversations_together_merges_them_and_keeps_the_record_link(): void
    {
        $older = $this->ingest('<a@mail.test>');
        $linked = $this->ingest('<b@mail.test>');
        $lead = $this->makeEmailLead($this->company);
        app(ConversationLinker::class)->link($linked->conversation, $lead);
        $linkedConversationId = $linked->conversation_id;

        $bridge = $this->ingest('<c@mail.test>', references: '<a@mail.test> <b@mail.test>');

        $this->assertSame($linkedConversationId, $bridge->conversation_id);
        $this->assertSame($linkedConversationId, $older->fresh()->conversation_id);
        $this->assertSame($linkedConversationId, $linked->fresh()->conversation_id);
        $this->assertSame(1, $this->conversations());

        $link = EmailRecordLink::withoutGlobalScopes()->sole();

        $this->assertSame($linkedConversationId, (int) $link->conversation_id);
        $this->assertSame((int) $lead->id, (int) $link->linkable_id);
    }

    public function test_the_same_ids_in_another_company_are_not_joined(): void
    {
        $other = EmailConnection::factory()->forUser($this->makeEmailUser())->create();

        $original = $this->ingest('<a@mail.test>');
        $foreignReply = $this->ingest('<b@mail.test>', inReplyTo: '<a@mail.test>', connection: $other);

        $this->assertNotSame($original->conversation_id, $foreignReply->conversation_id);
        $this->assertSame((int) $other->company_id, (int) $foreignReply->conversation->company_id);
        $this->assertSame(2, $this->conversations());
    }

    public function test_two_mailboxes_and_repeated_syncs_keep_one_conversation(): void
    {
        $colleague = EmailConnection::factory()->forUser($this->makeEmailUser($this->company))->create();

        $original = $this->ingest('<a@mail.test>', providerId: 'p-1');
        $this->ingest('<a@mail.test>', providerId: 'p-1');
        $sameMail = $this->ingest('<a@mail.test>', connection: $colleague);
        $reply = $this->ingest('<b@mail.test>', inReplyTo: '<a@mail.test>', connection: $colleague);

        $this->assertSame($original->id, $sameMail->id);
        $this->assertSame($original->conversation_id, $reply->conversation_id);
        $this->assertSame(1, $this->conversations());
        $this->assertSame(2, EmailMessage::withoutGlobalScopes()->count());
    }

    public function test_a_thin_payload_joins_once_the_full_one_brings_the_reply_headers(): void
    {
        $original = $this->ingest('<a@mail.test>');
        $thin = $this->ingest(null, providerId: 'p-thin', partial: true);

        $this->assertNotSame($original->conversation_id, $thin->conversation_id);

        $full = $this->ingest('<b@mail.test>', inReplyTo: '<a@mail.test>', providerId: 'p-thin');

        $this->assertSame($thin->id, $full->id);
        $this->assertSame($original->conversation_id, $full->conversation_id);
        $this->assertSame(1, $this->conversations());
    }

    private function ingest(
        ?string $rfcMessageId,
        ?string $inReplyTo = null,
        ?string $references = null,
        string $subject = 'Villa viewing',
        ?EmailConnection $connection = null,
        ?string $providerId = null,
        bool $partial = false,
    ): EmailMessage {
        $copy = $this->ingestor->ingestNormalized($connection ?? $this->connection, new NormalizedMessage(
            providerMessageId: $providerId ?? 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: new EmailAddress('lead@example.test'),
            to: ['agent@agency.test'],
            subject: $subject,
            textBody: $partial ? null : 'Hello',
            rfcMessageId: $rfcMessageId,
            inReplyTo: $inReplyTo,
            references: $references,
            folder: 'INBOX',
            partial: $partial,
        ));

        return EmailMessage::withoutGlobalScopes()->findOrFail($copy->message_id);
    }

    private function conversations(): int
    {
        return EmailConversation::withoutGlobalScopes()->count();
    }
}
