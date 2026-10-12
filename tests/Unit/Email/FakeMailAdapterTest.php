<?php

namespace Tests\Unit\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Contracts\MailTransport;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\ConnectionHealth;
use App\Email\Data\Draft;
use App\Email\Data\EmailAddress;
use App\Email\Data\HealthState;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Data\SendStatus;
use App\Email\Exceptions\MailTransportException;
use PHPUnit\Framework\TestCase;

class FakeMailAdapterTest extends TestCase
{
    private FakeMailAdapter $fake;

    private ConnectionContext $anna;

    private ConnectionContext $ben;

    protected function setUp(): void
    {
        parent::setUp();

        $this->fake = new FakeMailAdapter;
        $this->anna = $this->connection('conn-anna', 'anna@agency.test');
        $this->ben = $this->connection('conn-ben', 'ben@agency.test');
    }

    public function test_it_is_a_mail_transport(): void
    {
        $this->assertInstanceOf(MailTransport::class, $this->fake);
        $this->assertTrue($this->fake->health($this->anna)->isOk());
    }

    public function test_seeded_inbound_is_fetched_once_and_checkpointed(): void
    {
        $seeded = $this->fake->seedInbound($this->anna, [
            'from' => 'Lead <lead@example.test>',
            'subject' => 'Villa viewing',
            'text' => 'Is Friday possible?',
        ]);

        $page = $this->fake->fetchSince($this->anna, Checkpoint::start(), [FakeMailAdapter::FOLDER_INBOX]);

        $this->assertCount(1, $page->messages);
        $this->assertFalse($page->hasMore);

        $message = $page->messages[0];

        $this->assertSame($seeded->providerMessageId, $message->providerMessageId);
        $this->assertSame(MessageDirection::Inbound, $message->direction);
        $this->assertSame('lead@example.test', $message->from->address);
        $this->assertSame(['anna@agency.test'], array_map(fn (EmailAddress $a) => $a->address, $message->to));
        $this->assertSame('Villa viewing', $message->subject);
        $this->assertSame(FakeMailAdapter::FOLDER_INBOX, $message->folder);
        $this->assertNotNull($message->rfcMessageId);
        $this->assertNotNull($message->sentAt);

        $again = $this->fake->fetchSince($this->anna, $page->checkpoint, [FakeMailAdapter::FOLDER_INBOX]);

        $this->assertTrue($again->isEmpty());
        $this->assertTrue($again->checkpoint->equals($page->checkpoint));

        $this->fake->seedInbound($this->anna, ['subject' => 'Later']);
        $later = $this->fake->fetchSince($this->anna, $page->checkpoint, [FakeMailAdapter::FOLDER_INBOX]);

        $this->assertSame(['Later'], array_map(fn (NormalizedMessage $m) => $m->subject, $later->messages));
    }

    public function test_seeded_outbound_lands_in_sent_and_folders_are_filtered(): void
    {
        $this->fake->seedInbound($this->anna, ['subject' => 'In']);
        $this->fake->seedOutbound($this->anna, ['subject' => 'Out', 'to' => ['lead@example.test']]);

        $sent = $this->fake->fetchSince($this->anna, Checkpoint::start(), [FakeMailAdapter::FOLDER_SENT]);

        $this->assertCount(1, $sent->messages);
        $this->assertSame('Out', $sent->messages[0]->subject);
        $this->assertSame(MessageDirection::Outbound, $sent->messages[0]->direction);
        $this->assertSame('anna@agency.test', $sent->messages[0]->from->address);
        $this->assertNull($sent->checkpoint->cursor(FakeMailAdapter::FOLDER_INBOX));

        $both = $this->fake->fetchSince($this->anna, Checkpoint::start(), [FakeMailAdapter::FOLDER_INBOX, FakeMailAdapter::FOLDER_SENT]);

        $this->assertSame(['In', 'Out'], array_map(fn (NormalizedMessage $m) => $m->subject, $both->messages));
        $this->assertCount(2, $this->fake->fetchSince($this->anna, Checkpoint::start(), [])->messages);
    }

    public function test_mailboxes_are_isolated_per_connection_key(): void
    {
        $this->fake->seedInbound($this->anna);

        $this->assertTrue($this->fake->fetchSince($this->ben, Checkpoint::start(), [])->isEmpty());
        $this->assertCount(1, $this->fake->messages('conn-anna'));
        $this->assertSame([], $this->fake->messages($this->ben));
    }

    public function test_same_message_id_can_be_seeded_on_two_connections(): void
    {
        $seeded = $this->fake->seedSameMessageOnConnections([$this->anna, $this->ben], [
            'from' => 'lead@example.test',
            'subject' => 'To both of you',
        ]);

        $this->assertSame(['conn-anna', 'conn-ben'], array_keys($seeded));

        $forAnna = $this->fake->fetchSince($this->anna, Checkpoint::start(), [])->messages[0];
        $forBen = $this->fake->fetchSince($this->ben, Checkpoint::start(), [])->messages[0];

        $this->assertNotNull($forAnna->rfcMessageId);
        $this->assertSame($forAnna->rfcMessageId, $forBen->rfcMessageId);
        $this->assertNotSame($forAnna->providerMessageId, $forBen->providerMessageId);
        $this->assertEquals($forAnna->sentAt, $forBen->sentAt);

        $recipients = ['anna@agency.test', 'ben@agency.test'];

        $this->assertSame($recipients, array_map(fn (EmailAddress $a) => $a->address, $forAnna->to));
        $this->assertSame($recipients, array_map(fn (EmailAddress $a) => $a->address, $forBen->to));
    }

    public function test_reply_headers_survive_seeding(): void
    {
        $root = $this->fake->seedOutbound($this->anna, ['rfc_message_id' => '<root@crm.test>']);
        $reply = $this->fake->seedInbound($this->anna, [
            'in_reply_to' => $root->rfcMessageId,
            'references' => [$root->rfcMessageId],
        ]);
        $unrelated = $this->fake->seedInbound($this->anna, ['subject' => $root->subject, 'rfc_message_id' => null]);

        $this->assertContains('<root@crm.test>', $reply->threadKeys());
        $this->assertNull($unrelated->rfcMessageId);
        $this->assertSame([], $unrelated->threadKeys());
    }

    public function test_fetch_pages_through_a_large_mailbox(): void
    {
        $this->fake->setPageSize(2);

        foreach (['one', 'two', 'three'] as $subject) {
            $this->fake->seedInbound($this->anna, ['subject' => $subject]);
        }

        $first = $this->fake->fetchSince($this->anna, Checkpoint::start(), []);
        $second = $this->fake->fetchSince($this->anna, $first->checkpoint, []);

        $this->assertTrue($first->hasMore);
        $this->assertSame(['one', 'two'], array_map(fn (NormalizedMessage $m) => $m->subject, $first->messages));
        $this->assertFalse($second->hasMore);
        $this->assertSame(['three'], array_map(fn (NormalizedMessage $m) => $m->subject, $second->messages));
    }

    public function test_get_message_and_attachment_bytes(): void
    {
        $seeded = $this->fake->seedInbound($this->anna, [
            'attachments' => [
                ['filename' => 'plan.pdf', 'mime_type' => 'application/pdf', 'bytes' => '%PDF-fake'],
            ],
        ]);

        $message = $this->fake->getMessage($this->anna, $seeded->providerMessageId);
        $part = $message->attachments[0];
        $file = $this->fake->getAttachment($this->anna, $seeded->providerMessageId, $part->partId);

        $this->assertTrue($message->hasAttachments());
        $this->assertSame('plan.pdf', $part->filename);
        $this->assertSame(9, $part->sizeBytes);
        $this->assertSame('%PDF-fake', $file->bytes);
        $this->assertSame('application/pdf', $file->mimeType);

        $this->assertNull($this->fake->getMessage($this->anna, 'missing'));
        $this->assertNull($this->fake->getMessage($this->ben, $seeded->providerMessageId));
        $this->assertNull($this->fake->getAttachment($this->anna, $seeded->providerMessageId, 'missing'));
    }

    public function test_send_is_accepted_by_default_and_appears_in_sent(): void
    {
        $result = $this->fake->send($this->anna, $this->draft('<crm-1@crm.test>'));

        $this->assertSame(SendStatus::Accepted, $result->status);
        $this->assertNotNull($result->providerSubmissionId);

        $sent = $this->fake->messages($this->anna, FakeMailAdapter::FOLDER_SENT);

        $this->assertCount(1, $sent);
        $this->assertSame('<crm-1@crm.test>', $sent[0]->rfcMessageId);
        $this->assertSame(MessageDirection::Outbound, $sent[0]->direction);
        $this->assertSame('Hello', $sent[0]->textBody);
        $this->assertSame([], $this->fake->messages($this->ben));
    }

    public function test_send_reject_stores_nothing(): void
    {
        $this->fake->rejectNextSend($this->anna, 'invalid_recipient');

        $result = $this->fake->send($this->anna, $this->draft());

        $this->assertSame(SendStatus::Rejected, $result->status);
        $this->assertSame('invalid_recipient', $result->errorCode);
        $this->assertNull($result->providerSubmissionId);
        $this->assertSame([], $this->fake->messages($this->anna));
        $this->assertCount(1, $this->fake->sendCalls($this->anna));
    }

    public function test_send_timeout_is_unknown_and_retry_then_goes_through(): void
    {
        $this->fake->timeoutNextSend($this->anna);
        $draft = $this->draft('<crm-2@crm.test>');

        $first = $this->fake->send($this->anna, $draft);

        $this->assertSame(SendStatus::Unknown, $first->status);
        $this->assertSame('timeout', $first->errorCode);
        $this->assertSame([], $this->fake->messages($this->anna));

        $retry = $this->fake->send($this->anna, $draft);

        $this->assertSame(SendStatus::Accepted, $retry->status);
        $this->assertCount(1, $this->fake->messages($this->anna, FakeMailAdapter::FOLDER_SENT));
    }

    public function test_timeout_after_provider_took_the_message_does_not_send_twice_on_retry(): void
    {
        $this->fake->timeoutNextSend($this->anna, providerTookIt: true);
        $draft = $this->draft('<crm-3@crm.test>');

        $first = $this->fake->send($this->anna, $draft);

        $this->assertSame(SendStatus::Unknown, $first->status);
        $this->assertCount(1, $this->fake->messages($this->anna, FakeMailAdapter::FOLDER_SENT));

        $retry = $this->fake->send($this->anna, $draft);

        $this->assertSame(SendStatus::Accepted, $retry->status);
        $this->assertNotNull($retry->providerSubmissionId);
        $this->assertCount(1, $this->fake->messages($this->anna, FakeMailAdapter::FOLDER_SENT));
        $this->assertCount(2, $this->fake->sendCalls($this->anna));
    }

    public function test_send_throttle_then_scripted_outcomes_run_in_order(): void
    {
        $this->fake
            ->throttleNextSend($this->anna, 120)
            ->acceptNextSend($this->anna)
            ->rejectNextSend($this->anna);

        $throttled = $this->fake->send($this->anna, $this->draft());

        $this->assertSame(SendStatus::Throttled, $throttled->status);
        $this->assertSame(120, $throttled->retryAfterSeconds);
        $this->assertSame([], $this->fake->messages($this->anna));

        $this->assertSame(SendStatus::Accepted, $this->fake->send($this->anna, $this->draft())->status);
        $this->assertSame(SendStatus::Rejected, $this->fake->send($this->anna, $this->draft())->status);
        $this->assertSame(SendStatus::Accepted, $this->fake->send($this->anna, $this->draft())->status);

        // Scripts belong to one connection only.
        $this->fake->rejectNextSend($this->anna);
        $this->assertSame(SendStatus::Accepted, $this->fake->send($this->ben, $this->draft())->status);
    }

    public function test_health_and_fetch_failures_can_be_scripted(): void
    {
        $this->fake->setHealth($this->anna, ConnectionHealth::needsReconnect('missing_token'));

        $this->assertSame(HealthState::NeedsReconnect, $this->fake->health($this->anna)->state);
        $this->assertTrue($this->fake->health($this->ben)->isOk());

        $this->fake->failFetches($this->anna, new MailTransportException('provider_timeout'));

        try {
            $this->fake->fetchSince($this->anna, Checkpoint::start(), []);
            $this->fail('Expected the scripted fetch failure.');
        } catch (MailTransportException $exception) {
            $this->assertSame('provider_timeout', $exception->errorCode);
        }

        $this->fake->failFetches($this->anna, null);

        $this->assertTrue($this->fake->fetchSince($this->anna, Checkpoint::start(), [])->isEmpty());
    }

    public function test_reset_clears_one_connection_or_everything(): void
    {
        $this->fake->seedInbound($this->anna);
        $this->fake->seedInbound($this->ben);
        $this->fake->rejectNextSend($this->anna);

        $this->fake->reset($this->anna);

        $this->assertSame([], $this->fake->messages($this->anna));
        $this->assertCount(1, $this->fake->messages($this->ben));
        $this->assertSame(SendStatus::Accepted, $this->fake->send($this->anna, $this->draft())->status);

        $this->fake->reset();

        $this->assertSame([], $this->fake->messages($this->anna));
        $this->assertSame([], $this->fake->messages($this->ben));
        $this->assertSame([], $this->fake->sendCalls($this->anna));
    }

    private function connection(string $key, string $address): ConnectionContext
    {
        $identity = new EmailAddress($address);

        return new ConnectionContext($key, FakeMailAdapter::PROVIDER, $identity, $identity);
    }

    private function draft(?string $rfcMessageId = null): Draft
    {
        return new Draft(
            from: new EmailAddress('anna@agency.test'),
            to: ['lead@example.test'],
            subject: 'Villa viewing',
            textBody: 'Hello',
            rfcMessageId: $rfcMessageId,
        );
    }
}
