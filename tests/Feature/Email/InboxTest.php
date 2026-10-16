<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Transport\MailTransportFactory;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Company;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Support\Str;
use Mockery;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class InboxTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();
        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();

        $this->withoutMiddleware(HandleInertiaRequests::class);
    }

    public function test_default_window_lists_synced_mail_and_a_wider_preset_does_not_call_the_provider(): void
    {
        $recent = $this->ingest($this->connection, new DateTimeImmutable('-1 day'), 'recent@example.test', 'Recent note');
        $old = $this->ingest($this->connection, new DateTimeImmutable('-40 days'), 'old@example.test', 'Old note');
        $colleague = $this->makeEmailUser($this->company);
        $theirs = $this->ingest(
            EmailConnection::factory()->forUser($colleague)->create(),
            new DateTimeImmutable('-1 day'),
            'hidden@example.test',
            'Not yours',
        );

        $factory = Mockery::mock(MailTransportFactory::class);
        $factory->shouldNotReceive('forConnection');
        $factory->shouldNotReceive('default');
        $this->app->instance(MailTransportFactory::class, $factory);

        $this->signIn($this->agent);

        $week = $this->getJson('/email/inbox')->assertOk();
        $weekIds = $this->copyIds($week->json('threads'));

        $this->assertContains($recent->uuid, $weekIds);
        $this->assertNotContains($old->uuid, $weekIds);
        $this->assertNotContains($theirs->uuid, $weekIds);
        $this->assertSame(7, $week->json('preset'));

        $quarter = $this->getJson('/email/inbox?preset=90')->assertOk();
        $quarterIds = $this->copyIds($quarter->json('threads'));

        $this->assertContains($recent->uuid, $quarterIds);
        $this->assertContains($old->uuid, $quarterIds);
        $this->assertNotContains($theirs->uuid, $quarterIds);
    }

    public function test_needs_review_keeps_an_unlinked_copy(): void
    {
        $copy = $this->ingest($this->connection, new DateTimeImmutable('-1 day'), 'stranger@example.test', 'Please call');
        $this->signIn($this->agent);

        $ids = $this->copyIds($this->getJson('/email/inbox?state=needs_review')->json('threads'));

        $this->assertSame([$copy->uuid], $ids);
    }

    public function test_inertia_inbox_page_and_review_redirect(): void
    {
        $copy = $this->ingest($this->connection, new DateTimeImmutable('-1 day'), 'stranger@example.test', 'Hello');
        $this->signIn($this->agent);
        $inertia = ['X-Inertia' => 'true', 'Accept' => 'text/html, application/xhtml+xml'];

        $this->get('/email/inbox?focus='.$copy->uuid, $inertia)
            ->assertOk()
            ->assertJsonPath('component', 'Email/Inbox')
            ->assertJsonPath('props.focusId', $copy->uuid);

        $this->get('/email/review', $inertia)
            ->assertRedirect('/email/inbox?state=needs_review');
    }

    /**
     * @param  list<array<string, mixed>>|null  $threads
     * @return list<string>
     */
    private function copyIds(?array $threads): array
    {
        $ids = [];

        foreach ($threads ?? [] as $thread) {
            foreach ($thread['messages'] as $message) {
                $ids[] = $message['id'];
            }
        }

        return $ids;
    }

    private function ingest(
        EmailConnection $connection,
        DateTimeImmutable $sentAt,
        string $from,
        string $subject,
    ): EmailMailboxCopy {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($from),
            to: [$connection->identity_email],
            sentAt: $sentAt,
            subject: $subject,
            textBody: $subject,
            rfcMessageId: '<'.Str::random(12).'@mail.test>',
            folder: 'INBOX',
        ));
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
