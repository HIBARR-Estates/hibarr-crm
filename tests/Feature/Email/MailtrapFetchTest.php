<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\Mailtrap\MailtrapAdapter;
use App\Email\Data\Checkpoint;
use App\Email\Data\ConnectionContext;
use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Exceptions\MailTransportException;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Tests\Concerns\FakesMailtrapInbox;
use Tests\TestCase;

class MailtrapFetchTest extends TestCase
{
    use FakesMailtrapInbox;

    private MailtrapAdapter $adapter;

    protected function setUp(): void
    {
        parent::setUp();

        $this->configureMailtrap();
        $this->adapter = app(MailtrapAdapter::class);
        $this->mailtrapInboxes['501'] = [];
        $this->mailtrapInboxes['502'] = [];
    }

    public function test_empty_inbox_returns_an_empty_page_and_leaves_the_checkpoint_alone(): void
    {
        $checkpoint = Checkpoint::start()->with('INBOX', '40');

        $page = $this->adapter->fetchSince($this->connection(), $checkpoint, []);

        $this->assertTrue($page->isEmpty());
        $this->assertFalse($page->hasMore);
        $this->assertTrue($page->checkpoint->equals($checkpoint));
        $this->assertTrue($this->adapter->fetchSince($this->connection(), Checkpoint::start(), [])->checkpoint->isStart());
    }

    public function test_message_is_normalized_from_its_source_headers_not_the_thin_list(): void
    {
        $this->putMailtrapMessage('501', 11, [
            'headers' => [
                'From' => '"Doe, Jane" <Jane@Example.test>',
                'To' => 'Agent A <agent@agency.test>, Agent B <agent-b@agency.test>',
                'Cc' => 'partner@example.test',
                'Reply-To' => 'assistant@example.test',
                'Subject' => '=?UTF-8?B?QmVzaWNodGlndW5nIGbDvHIgZGllIFZpbGxh?=',
                'Date' => 'Thu, 01 Oct 2026 11:30:00 +0200',
                'Message-ID' => '<reply-1@mail.example.test>',
                'In-Reply-To' => '<root@mail.example.test>',
                'References' => '<root@mail.example.test> <mid@mail.example.test>',
            ],
            'text' => 'See you Friday.',
            'html' => '<p>See you Friday.</p>',
        ]);

        $page = $this->adapter->fetchSince($this->connection(), Checkpoint::start(), []);
        $message = $page->messages[0];

        $this->assertCount(1, $page->messages);
        $this->assertSame('11', $message->providerMessageId);
        $this->assertSame(MessageDirection::Inbound, $message->direction);
        $this->assertSame('jane@example.test', $message->from->address);
        $this->assertSame('Doe, Jane', $message->from->name);
        $this->assertSame(['agent@agency.test', 'agent-b@agency.test'], $this->addresses($message->to));
        $this->assertSame(['partner@example.test'], $this->addresses($message->cc));
        $this->assertSame(['assistant@example.test'], $this->addresses($message->replyTo));
        $this->assertSame('Besichtigung für die Villa', $message->subject);
        $this->assertSame('2026-10-01T11:30:00+02:00', $message->sentAt->format(DATE_ATOM));
        $this->assertSame('<reply-1@mail.example.test>', $message->rfcMessageId);
        $this->assertSame('<root@mail.example.test>', $message->inReplyTo);
        $this->assertSame(['<root@mail.example.test>', '<mid@mail.example.test>'], $message->references);
        $this->assertSame('See you Friday.', $message->textBody);
        $this->assertSame('<p>See you Friday.</p>', $message->htmlRaw);
        $this->assertSame('INBOX', $message->folder);
        $this->assertFalse($message->partial);
        $this->assertFalse($message->hasAttachments());
        $this->assertSame('11', $page->checkpoint->cursor('INBOX'));

        Http::assertSent(fn (Request $request) => $request->hasHeader('Api-Token', 'mt-api-token-very-secret'));
        // The attachments endpoint is only asked when the source carries file parts.
        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/attachments'));
    }

    public function test_mail_sent_by_the_mailbox_owner_is_outbound(): void
    {
        $this->putMailtrapMessage('501', 12, ['headers' => ['From' => 'Agent <agent@agency.test>', 'To' => 'lead@example.test']]);

        $message = $this->adapter->fetchSince($this->connection(), Checkpoint::start(), [])->messages[0];

        $this->assertSame(MessageDirection::Outbound, $message->direction);
    }

    public function test_message_without_a_message_id_or_html_is_still_fetched(): void
    {
        $this->putMailtrapMessage('501', 13, ['headers' => ['Message-ID' => null, 'From' => null, 'To' => null]]);

        $message = $this->adapter->fetchSince($this->connection(), Checkpoint::start(), [])->messages[0];

        $this->assertNull($message->rfcMessageId);
        $this->assertSame([], $message->threadKeys());
        $this->assertNull($message->htmlRaw);
        // With no headers to read, the list's own sender and recipient are used.
        $this->assertSame('list-from@example.test', $message->from->address);
        $this->assertSame(['list-to@example.test'], $this->addresses($message->to));

        Http::assertNotSent(fn (Request $request) => str_ends_with($request->url(), '/body.html'));
    }

    public function test_only_messages_after_the_checkpoint_are_returned_oldest_first(): void
    {
        $this->mailtrapListPageSize = 2;

        foreach ([21, 22, 23, 24, 25] as $id) {
            $this->putMailtrapMessage('501', $id);
        }

        $first = $this->adapter->fetchSince($this->connection(), Checkpoint::start()->with('INBOX', '22'), []);

        $this->assertSame(['23', '24', '25'], array_map(fn (NormalizedMessage $m) => $m->providerMessageId, $first->messages));
        $this->assertSame('25', $first->checkpoint->cursor('INBOX'));
        $this->assertFalse($first->hasMore);

        $again = $this->adapter->fetchSince($this->connection(), $first->checkpoint, []);

        $this->assertTrue($again->isEmpty());

        $this->putMailtrapMessage('501', 26);
        $later = $this->adapter->fetchSince($this->connection(), $first->checkpoint, []);

        $this->assertSame(['26'], array_map(fn (NormalizedMessage $m) => $m->providerMessageId, $later->messages));
    }

    public function test_a_large_backlog_is_returned_in_pages(): void
    {
        foreach (range(101, 130) as $id) {
            $this->putMailtrapMessage('501', $id);
        }

        $first = $this->adapter->fetchSince($this->connection(), Checkpoint::start(), []);
        $second = $this->adapter->fetchSince($this->connection(), $first->checkpoint, []);

        $this->assertCount(25, $first->messages);
        $this->assertTrue($first->hasMore);
        $this->assertSame('101', $first->messages[0]->providerMessageId);
        $this->assertSame('125', $first->checkpoint->cursor('INBOX'));
        $this->assertCount(5, $second->messages);
        $this->assertFalse($second->hasMore);
        $this->assertSame('130', $second->checkpoint->cursor('INBOX'));
    }

    public function test_each_connection_reads_only_its_own_sandbox(): void
    {
        $this->putMailtrapMessage('501', 31, ['headers' => ['Message-ID' => '<both@mail.example.test>']]);
        $this->putMailtrapMessage('502', 32, ['headers' => ['Message-ID' => '<both@mail.example.test>']]);
        $this->putMailtrapMessage('502', 33);

        $a = $this->adapter->fetchSince($this->connection('a'), Checkpoint::start(), []);
        $b = $this->adapter->fetchSince($this->connection('b'), Checkpoint::start(), []);

        $this->assertSame(['31'], array_map(fn (NormalizedMessage $m) => $m->providerMessageId, $a->messages));
        $this->assertSame(['32', '33'], array_map(fn (NormalizedMessage $m) => $m->providerMessageId, $b->messages));
        // The same email injected into both sandboxes carries one Message-ID.
        $this->assertSame($a->messages[0]->rfcMessageId, $b->messages[0]->rfcMessageId);
    }

    public function test_attachments_are_listed_and_their_bytes_can_be_fetched(): void
    {
        $this->putMailtrapMessage('501', 41, ['attachments' => [
            ['id' => 9001, 'filename' => 'plan.pdf', 'content_type' => 'application/pdf', 'bytes' => '%PDF-fake'],
            ['id' => 9002, 'filename' => 'logo.png', 'content_type' => 'image/png', 'bytes' => 'PNG', 'inline' => true, 'content_id' => 'logo'],
        ]]);

        $message = $this->adapter->fetchSince($this->connection(), Checkpoint::start(), [])->messages[0];

        $this->assertCount(2, $message->attachments);
        $this->assertSame('9001', $message->attachments[0]->partId);
        $this->assertSame('plan.pdf', $message->attachments[0]->filename);
        $this->assertSame('application/pdf', $message->attachments[0]->mimeType);
        $this->assertSame(9, $message->attachments[0]->sizeBytes);
        $this->assertFalse($message->attachments[0]->inline);
        $this->assertTrue($message->attachments[1]->inline);
        $this->assertSame('logo', $message->attachments[1]->contentId);

        $file = $this->adapter->getAttachment($this->connection(), '41', '9001');

        $this->assertSame('%PDF-fake', $file->bytes);
        $this->assertSame('plan.pdf', $file->filename);
        $this->assertNull($this->adapter->getAttachment($this->connection(), '41', '7777'));
        $this->assertNull($this->adapter->getAttachment($this->connection(), '999', '9001'));
    }

    public function test_get_message_returns_the_full_message_or_null(): void
    {
        $this->putMailtrapMessage('501', 51, ['headers' => ['Message-ID' => '<one@mail.example.test>']]);

        $message = $this->adapter->getMessage($this->connection(), '51');

        $this->assertSame('<one@mail.example.test>', $message->rfcMessageId);
        $this->assertSame('Body 51', $message->textBody);
        $this->assertNull($this->adapter->getMessage($this->connection(), '999'));
    }

    public function test_a_message_deleted_mid_fetch_is_skipped_and_stepped_past(): void
    {
        $this->putMailtrapMessage('501', 61);
        $this->putMailtrapMessage('501', 62);

        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(function (Request $request) {
            if (str_ends_with($request->url(), '/messages/61/body.eml')) {
                return Http::response('', 404);
            }

            return $this->answerMailtrap($request);
        });

        $page = $this->adapter->fetchSince($this->connection(), Checkpoint::start(), []);

        $this->assertSame(['62'], array_map(fn (NormalizedMessage $m) => $m->providerMessageId, $page->messages));
        $this->assertSame('62', $page->checkpoint->cursor('INBOX'));
    }

    public function test_provider_errors_surface_as_short_codes_without_the_response_body(): void
    {
        $cases = [
            [Http::response(['error' => 'bad token mt-api-token-very-secret'], 401), 'unauthorized', false],
            [Http::response([], 404), 'inbox_not_found', false],
            [Http::response([], 429), 'rate_limited', true],
            [Http::response('upstream exploded', 502), 'provider_error', true],
            [Http::response('not json at all', 200), 'provider_error', true],
        ];

        foreach ($cases as [$response, $code, $retryable]) {
            Http::swap(new \Illuminate\Http\Client\Factory);
            Http::fake(['*' => $response]);

            try {
                $this->adapter->fetchSince($this->connection(), Checkpoint::start(), []);
                $this->fail("Expected {$code}.");
            } catch (MailTransportException $exception) {
                $this->assertSame($code, $exception->errorCode);
                $this->assertSame($retryable, $exception->retryable);
                $this->assertStringNotContainsString('secret', $exception->getMessage());
                $this->assertStringNotContainsString('exploded', $exception->getMessage());
            }
        }
    }

    public function test_missing_credentials_fail_before_any_request(): void
    {
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake();
        config(['email.mailtrap.api_token' => null]);

        try {
            $this->adapter->fetchSince($this->connection(), Checkpoint::start(), []);
            $this->fail('Expected the missing token to be reported.');
        } catch (MailTransportException $exception) {
            $this->assertSame('missing_api_token', $exception->errorCode);
        }

        Http::assertNothingSent();
    }

    public function test_a_folder_the_sandbox_does_not_have_is_simply_empty(): void
    {
        $this->putMailtrapMessage('501', 71);

        $this->assertTrue($this->adapter->fetchSince($this->connection(), Checkpoint::start(), ['Sent'])->isEmpty());
        $this->assertCount(1, $this->adapter->fetchSince($this->connection(), Checkpoint::start(), ['INBOX', 'Sent'])->messages);
    }

    private function connection(string $sandbox = 'a'): ConnectionContext
    {
        $identity = new EmailAddress('agent@agency.test');

        return new ConnectionContext("conn-{$sandbox}", 'mailtrap', $identity, $identity, null, ['sandbox' => $sandbox]);
    }

    /**
     * @param  list<EmailAddress>  $addresses
     * @return list<string>
     */
    private function addresses(array $addresses): array
    {
        return array_map(fn (EmailAddress $address) => $address->address, $addresses);
    }
}
