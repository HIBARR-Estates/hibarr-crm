<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\Mailtrap\MailtrapAdapter;
use App\Email\Adapters\Mailtrap\MailtrapSmtpFactory;
use App\Email\Contracts\AttachmentStore;
use App\Email\Data\ConnectionContext;
use App\Email\Data\Draft;
use App\Email\Data\DraftAttachment;
use App\Email\Data\EmailAddress;
use App\Email\Data\SendStatus;
use App\Email\EmailFeature;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Enums\SendRecipientStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Email\Sending\SendAttemptService;
use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\Envelope;
use Symfony\Component\Mailer\Exception\TransportException;
use Symfony\Component\Mailer\Exception\UnexpectedResponseException;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\Smtp\EsmtpTransport;
use Symfony\Component\Mailer\Transport\TransportInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Mime\RawMessage;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;
use Throwable;

class MailtrapSendTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    /** @var list<Email> everything handed to the SMTP transport */
    private array $sent = [];

    /** @var list<array{0: string, 1: string}> credentials the transport was built with */
    private array $logins = [];

    private ?Throwable $smtpFailure = null;

    private string $smtpReply = '';

    protected function setUp(): void
    {
        parent::setUp();

        // Any HTTP call from a send would be a bug: sending goes through SMTP only.
        Http::fake();

        $this->app->instance(MailtrapSmtpFactory::class, new class($this) extends MailtrapSmtpFactory
        {
            public function __construct(private readonly MailtrapSendTest $test) {}

            public function make(string $username, string $password, array $config): TransportInterface
            {
                return $this->test->smtpTransport($username, $password);
            }
        });
    }

    public function smtpTransport(string $username, string $password): TransportInterface
    {
        $this->logins[] = [$username, $password];

        return new class(fn (RawMessage $message) => $this->deliver($message)) implements TransportInterface
        {
            public function __construct(private readonly \Closure $deliver) {}

            public function send(RawMessage $message, ?Envelope $envelope = null): ?SentMessage
            {
                return ($this->deliver)($message);
            }

            public function __toString(): string
            {
                return 'smtp://recording';
            }
        };
    }

    public function test_accepted_send_goes_out_over_smtp_with_the_crm_headers(): void
    {
        $this->smtpReply = "< 250 2.0.0 Ok: queued as 4F2A9C1\r\n";

        $result = $this->adapter()->send($this->connection(), new Draft(
            from: new EmailAddress('agent@agency.test', 'Agent Anna'),
            to: ['Lead Person <lead@example.test>'],
            cc: ['partner@example.test'],
            replyTo: new EmailAddress('replies@agency.test'),
            subject: 'Re: Villa viewing',
            textBody: 'See you Friday.',
            htmlBody: '<p>See you Friday.</p>',
            rfcMessageId: '<crm-1@agency.test>',
            inReplyTo: '<root@mail.example.test>',
            references: ['<root@mail.example.test>', '<mid@mail.example.test>'],
        ));

        $this->assertSame(SendStatus::Accepted, $result->status);
        $this->assertSame('4F2A9C1', $result->providerSubmissionId);
        $this->assertSame([['smtp-user-a', 'smtp-pass-a']], $this->logins);

        $email = $this->sent[0];
        $source = $email->toString();

        $this->assertSame('agent@agency.test', $email->getFrom()[0]->getAddress());
        $this->assertSame('Agent Anna', $email->getFrom()[0]->getName());
        $this->assertSame('lead@example.test', $email->getTo()[0]->getAddress());
        $this->assertSame('partner@example.test', $email->getCc()[0]->getAddress());
        $this->assertSame('replies@agency.test', $email->getReplyTo()[0]->getAddress());
        $this->assertSame([], $email->getBcc());
        $this->assertSame('Re: Villa viewing', $email->getSubject());
        $this->assertSame('See you Friday.', $email->getTextBody());
        $this->assertSame('<p>See you Friday.</p>', $email->getHtmlBody());
        $this->assertStringContainsString('Message-ID: <crm-1@agency.test>', $source);
        $this->assertStringContainsString('In-Reply-To: <root@mail.example.test>', $source);
        $this->assertStringContainsString('References: <root@mail.example.test> <mid@mail.example.test>', $source);

        Http::assertNothingSent();
    }

    public function test_text_only_and_html_only_drafts_both_send(): void
    {
        $adapter = $this->adapter();

        $text = $adapter->send($this->connection(), $this->draft());
        $html = $adapter->send($this->connection(), new Draft(
            from: new EmailAddress('agent@agency.test'),
            to: ['lead@example.test'],
            subject: 'HTML only',
            htmlBody: '<p>Hello</p>',
        ));

        $this->assertTrue($text->isAccepted());
        $this->assertNull($text->providerSubmissionId);
        $this->assertTrue($html->isAccepted());
        $this->assertNull($this->sent[0]->getHtmlBody());
        $this->assertNull($this->sent[1]->getTextBody());
    }

    public function test_missing_smtp_credentials_or_recipients_are_rejected_without_opening_a_connection(): void
    {
        $adapter = $this->adapter();

        $noPassword = $adapter->send($this->connection(['sandbox' => 'a', 'smtp_username' => 'smtp-user-a']), $this->draft());
        $noTo = $adapter->send($this->connection(), new Draft(new EmailAddress('agent@agency.test'), subject: 'Nobody'));

        $this->assertSame(SendStatus::Rejected, $noPassword->status);
        $this->assertSame('missing_smtp_credentials', $noPassword->errorCode);
        $this->assertSame(SendStatus::Rejected, $noTo->status);
        $this->assertSame('missing_recipient', $noTo->errorCode);
        $this->assertSame([], $this->logins);
        $this->assertSame([], $this->sent);
    }

    public function test_smtp_answers_map_to_send_results(): void
    {
        $cases = [
            [new UnexpectedResponseException('535 5.7.0 Invalid credentials smtp-pass-a', 535), SendStatus::Rejected, 'unauthorized'],
            [new UnexpectedResponseException('550 5.1.1 Mailbox unavailable', 550), SendStatus::Rejected, 'rejected_by_provider'],
            [new UnexpectedResponseException('550 5.7.0 Too many emails per second', 550), SendStatus::Throttled, 'rate_limited'],
            [new UnexpectedResponseException('451 4.3.0 Try again later', 451), SendStatus::Throttled, 'rate_limited'],
            // No answer at all: the sandbox may or may not have taken it.
            [new TransportException('Connection to sandbox.smtp.mailtrap.io timed out'), SendStatus::Unknown, 'transport_error'],
            [new \RuntimeException('socket closed'), SendStatus::Unknown, 'transport_error'],
        ];

        foreach ($cases as [$failure, $status, $code]) {
            $this->smtpFailure = $failure;

            $result = $this->adapter()->send($this->connection(), $this->draft());

            $this->assertSame($status, $result->status, $code);
            $this->assertSame($code, $result->errorCode);
            $this->assertStringNotContainsString('smtp-pass-a', (string) json_encode($result));
        }
    }

    public function test_an_unreadable_attachment_blocks_the_whole_send(): void
    {
        $result = $this->adapter()->send($this->connection(), $this->draft(attachments: [
            new DraftAttachment('email-attachments/abc/plan.pdf', 'plan.pdf', 'application/pdf', 9),
        ]));

        $this->assertSame(SendStatus::Rejected, $result->status);
        $this->assertSame('attachment_unavailable', $result->errorCode);
        $this->assertSame([], $this->sent);
        $this->assertSame([], $this->logins);
    }

    public function test_readable_attachments_are_sent_with_the_message(): void
    {
        $this->app->instance(AttachmentStore::class, new class implements AttachmentStore
        {
            public function read(string $storageKey): ?string
            {
                return $storageKey === 'email-attachments/abc/plan.pdf' ? '%PDF-fake' : null;
            }
        });

        $result = $this->adapter()->send($this->connection(), $this->draft(attachments: [
            new DraftAttachment('email-attachments/abc/plan.pdf', 'plan.pdf', 'application/pdf', 9),
        ]));

        $this->assertTrue($result->isAccepted());

        $attachment = $this->sent[0]->getAttachments()[0];

        $this->assertSame('plan.pdf', $attachment->getFilename());
        $this->assertSame('%PDF-fake', $attachment->getBody());
        $this->assertSame('application/pdf', $attachment->getMediaType().'/'.$attachment->getMediaSubtype());
    }

    public function test_real_factory_builds_a_sandbox_smtp_transport(): void
    {
        $transport = (new MailtrapSmtpFactory)->make('user', 'pass', (array) config('email.mailtrap'));

        $this->assertInstanceOf(EsmtpTransport::class, $transport);
        $this->assertSame('user', $transport->getUsername());
        $this->assertStringContainsString('sandbox.smtp.mailtrap.io', (string) $transport);
    }

    public function test_attempt_through_mailtrap_is_sent_never_delivered_and_a_reject_keeps_the_draft(): void
    {
        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();
        $connection = EmailConnection::factory()->forUser($agent)->create([
            'provider' => 'mailtrap',
            'identity_email' => 'agent@agency.test',
            'from_email' => 'agent@agency.test',
            'credentials' => ['sandbox' => 'a', 'smtp_username' => 'smtp-user-a', 'smtp_password' => 'smtp-pass-a'],
        ]);
        $service = app(SendAttemptService::class);

        $accepted = $service->send($connection, $this->draft(), $agent)->fresh();

        $this->assertSame(SendAttemptStatus::Sent, $accepted->status);
        $this->assertSame('sent', $accepted->getRawOriginal('status'));
        $this->assertNotNull($accepted->sent_at);
        $this->assertSame(
            [SendRecipientStatus::Accepted],
            $accepted->recipients()->withoutGlobalScopes()->get()->map(fn ($r) => $r->status)->all(),
        );
        // The Message-ID the CRM assigned is the one that went over the wire.
        $this->assertStringContainsString('Message-ID: '.$accepted->rfc_message_id, $this->sent[0]->toString());
        $this->assertStringNotContainsString('delivered', (string) json_encode($accepted->getAttributes()));

        $this->smtpFailure = new UnexpectedResponseException('550 5.1.1 Mailbox unavailable', 550);

        $rejected = $service->send($connection, $this->draft(), $agent)->fresh();

        $this->assertSame(SendAttemptStatus::Failed, $rejected->status);
        $this->assertSame('rejected_by_provider', $rejected->error_code);
        $this->assertSame('Hello', $rejected->draft()->textBody);
        $this->assertSame('lead@example.test', $rejected->draft()->to[0]->address);

        $this->smtpFailure = new TransportException('timed out');

        $unknown = $service->send($connection, $this->draft(), $agent);

        $this->assertSame(SendAttemptStatus::Checking, $unknown->status);

        $this->smtpFailure = null;
        $retried = $service->retry($unknown);

        $this->assertSame($unknown->id, $retried->id);
        $this->assertSame(SendAttemptStatus::Sent, $retried->status);
        $this->assertSame(3, EmailSendAttempt::withoutGlobalScopes()->count());

        // Missing To never opens an SMTP connection.
        $logins = count($this->logins);
        $invalid = $service->send($connection, new Draft(new EmailAddress('agent@agency.test'), subject: 'Draft', textBody: 'Later'));

        $this->assertSame('validation_missing_to', $invalid->error_code);
        $this->assertCount($logins, $this->logins);
    }

    private function deliver(RawMessage $message): SentMessage
    {
        if ($this->smtpFailure !== null) {
            throw $this->smtpFailure;
        }

        $this->sent[] = $message;

        $sent = new SentMessage($message, Envelope::create($message));
        $sent->appendDebug($this->smtpReply);

        return $sent;
    }

    private function adapter(): MailtrapAdapter
    {
        return app(MailtrapAdapter::class);
    }

    /**
     * @param  array<string, mixed>|null  $credentials
     */
    private function connection(?array $credentials = null): ConnectionContext
    {
        $identity = new EmailAddress('agent@agency.test');

        return new ConnectionContext('conn-a', 'mailtrap', $identity, $identity, null, $credentials ?? [
            'sandbox' => 'a',
            'smtp_username' => 'smtp-user-a',
            'smtp_password' => 'smtp-pass-a',
        ]);
    }

    /**
     * @param  list<DraftAttachment>  $attachments
     */
    private function draft(array $attachments = []): Draft
    {
        return new Draft(
            from: new EmailAddress('agent@agency.test'),
            to: ['lead@example.test'],
            subject: 'Villa viewing',
            textBody: 'Hello',
            attachments: $attachments,
        );
    }
}
