<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Reads\ReadState;
use App\Email\Sync\MailboxSynchronizer;
use App\Email\Transport\MailTransportFactory;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Mockery\MockInterface;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailReadStateTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $anna;

    private User $ben;

    private EmailConnection $annasMailbox;

    private EmailConnection $bensMailbox;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();

        $this->anna = $this->user(['view_lead' => 'all']);
        $this->ben = $this->user(['view_lead' => 'all']);
        $this->annasMailbox = EmailConnection::factory()->forUser($this->anna)->create();
        $this->bensMailbox = EmailConnection::factory()->forUser($this->ben)->create();
    }

    /** E-34: two mailbox recipients are both indicated; neither is sole responder. */
    public function test_two_users_one_opens_the_other_still_has_it_unread(): void
    {
        $annas = $this->ingest($this->annasMailbox, '<shared@mail.test>');
        $bens = $this->ingest($this->bensMailbox, '<shared@mail.test>');
        $uuid = $annas->message->uuid;

        $this->assertSame($annas->message_id, $bens->message_id);
        // Both mailbox owners see new mail — Lead Owner is irrelevant here.
        $this->assertSame(1, $this->reads()->unreadCount($this->anna));
        $this->assertSame(1, $this->reads()->unreadCount($this->ben));
        $this->signIn($this->anna);
        $this->getJson('/email/unread')->assertOk()->assertExactJson(['unread' => 1]);
        $this->signIn($this->ben);
        $this->getJson('/email/unread')->assertOk()->assertExactJson(['unread' => 1]);

        // Opening is a CRM matter only: any use of a mail transport fails the test (no \Seen at the provider).
        $this->mock(MailTransportFactory::class, function (MockInterface $mock) {
            $mock->shouldNotReceive('forConnection', 'make', 'default');
        });

        $this->signIn($this->anna);
        $this->getJson('/email/review')->assertJsonPath('items.0.unread', true)->assertJsonPath('items.0.message_uuid', $uuid);

        $this->postJson("/email/messages/{$uuid}/read")
            ->assertOk()
            ->assertExactJson(['message' => ['id' => $uuid, 'unread' => false], 'unread' => 0]);
        $this->postJson("/email/messages/{$uuid}/read")->assertOk();

        $this->getJson('/email/unread')->assertExactJson(['unread' => 0]);
        $this->getJson('/email/review')->assertJsonPath('items.0.unread', false);
        $this->assertSame(1, DB::table('email_user_reads')->count());

        // Ben has not opened it.
        $this->signIn($this->ben);
        $this->getJson('/email/unread')->assertExactJson(['unread' => 1]);
        $this->getJson('/email/review')->assertJsonPath('items.0.unread', true);
    }

    public function test_duplicate_sync_does_not_duplicate_unread(): void
    {
        $fake = app(FakeMailAdapter::class);
        $fake->seedInbound($this->annasMailbox->toContext(), ['rfc_message_id' => '<a@mail.test>']);

        $this->sync();
        $this->sync();

        // The checkpoint is lost and everything is fetched again.
        $this->annasMailbox->fresh()->update(['checkpoint' => null]);
        $this->sync();

        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, $this->reads()->unreadCount($this->anna));

        // The provider hands the same email over again under a second id (a copy moved between folders).
        $this->ingest($this->annasMailbox, '<a@mail.test>');

        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame(1, $this->reads()->unreadCount($this->anna));

        // Once read, no later sync or copy brings it back.
        $this->reads()->markRead($this->anna, EmailMessage::withoutGlobalScopes()->sole());
        $this->annasMailbox->fresh()->update(['checkpoint' => null]);
        $this->sync();
        $this->ingest($this->annasMailbox, '<a@mail.test>');

        $this->assertSame(0, $this->reads()->unreadCount($this->anna));
        $this->assertSame(1, DB::table('email_user_reads')->count());
    }

    /** E-34: lead reassignment does not mark old mail unread for the new owner. */
    public function test_lead_reassignment_does_not_mark_old_mail_unread_for_new_owner(): void
    {
        $lena = $this->user(['view_lead' => 'owned']);
        $nora = $this->user(['view_lead' => 'owned']);
        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $lena->id]);
        $lead = Lead::withoutGlobalScopes()->findOrFail($lead->id);

        $copy = $this->ingest($this->annasMailbox, '<a@mail.test>');
        app(ConversationLinker::class)->link($copy->message->conversation, $lead, $this->anna, $this->annasMailbox);

        // Old mail on the lead is not "new" to whoever owns the lead: only Anna received it.
        $this->assertSame(1, $this->reads()->unreadCount($this->anna));
        $this->assertSame(0, $this->reads()->unreadCount($lena));

        $this->signIn($lena);
        $this->getJson("/email/records/lead/{$lead->id}/history")->assertOk()->assertJsonPath('events.0.unread', false);

        DB::table('leads')->where('id', $lead->id)->update(['lead_owner' => $nora->id]);

        $this->assertSame(0, $this->reads()->unreadCount($nora));
        $this->signIn($nora);
        $this->getJson("/email/records/lead/{$lead->id}/history")->assertOk()->assertJsonPath('events.0.unread', false);
        $this->getJson('/email/unread')->assertExactJson(['unread' => 0]);

        // Anna reads it; passing the lead to her, away and back changes nothing.
        $this->signIn($this->anna);
        $this->getJson("/email/records/lead/{$lead->id}/history")->assertJsonPath('events.0.unread', true);
        $this->postJson("/email/messages/{$copy->message->uuid}/read")->assertOk();

        foreach ([$this->anna->id, $lena->id, $this->anna->id] as $ownerId) {
            DB::table('leads')->where('id', $lead->id)->update(['lead_owner' => $ownerId]);

            $this->assertSame(0, $this->reads()->unreadCount($this->anna));
        }

        $this->getJson("/email/records/lead/{$lead->id}/history")->assertJsonPath('events.0.unread', false);
    }

    public function test_only_received_mail_you_may_read_counts_and_can_be_marked(): void
    {
        $bens = $this->ingest($this->bensMailbox, '<private@mail.test>');
        $sent = $this->ingest($this->annasMailbox, '<sent@mail.test>', MessageDirection::Outbound);
        $spam = $this->ingest($this->annasMailbox, '<spam@mail.test>');
        $spam->update(['review_status' => ReviewStatus::Dismissed]);

        // Mail Anna sent, and mail she dismissed, is not waiting to be read.
        $this->assertSame(0, $this->reads()->unreadCount($this->anna));
        $this->assertSame(1, $this->reads()->unreadCount($this->ben));

        // Someone else's mail cannot be marked — or even confirmed to exist.
        $this->signIn($this->anna);
        $this->postJson("/email/messages/{$bens->message->uuid}/read")->assertStatus(404);
        $this->postJson('/email/messages/'.Str::uuid().'/read')->assertStatus(404);

        $this->assertSame(0, DB::table('email_user_reads')->count());
        $this->assertSame(1, $this->reads()->unreadCount($this->ben));

        $this->postJson("/email/messages/{$sent->message->uuid}/read")->assertOk();

        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->getJson('/email/unread')->assertStatus(404);
        $this->postJson("/email/messages/{$sent->message->uuid}/read")->assertStatus(404);
        $this->assertSame(0, $this->reads()->unreadCount($this->ben));
    }

    private function reads(): ReadState
    {
        return $this->app->make(ReadState::class);
    }

    private function sync(): void
    {
        $this->assertTrue((new SyncMailboxJob($this->annasMailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded());
    }

    private function ingest(
        EmailConnection $connection,
        string $rfcMessageId,
        MessageDirection $direction = MessageDirection::Inbound,
    ): EmailMailboxCopy {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: $direction,
            from: new EmailAddress($direction === MessageDirection::Outbound ? $connection->identity_email : 'stranger@example.test'),
            to: $direction === MessageDirection::Outbound ? ['stranger@example.test'] : [$connection->identity_email],
            subject: 'Hello',
            textBody: 'Body.',
            rfcMessageId: $rfcMessageId,
            folder: 'INBOX',
        ));
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function user(array $permissions): User
    {
        $user = $this->makeEmailUser($this->company);
        $this->app->instance('user.permission-map.'.$user->id, $permissions);

        return $user;
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
