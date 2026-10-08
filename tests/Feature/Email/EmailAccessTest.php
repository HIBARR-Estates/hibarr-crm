<?php

namespace Tests\Feature\Email;

use App\Email\Authorization\EmailAccess;
use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\Company;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

/**
 * docs/email/access-matrix.md as tests. "TBD" cells are denials.
 */
class EmailAccessTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    /** Mailbox owner. Sees every lead, owns none of them. */
    private User $mailboxOwner;

    /** Owns the lead (an ordinary agent), has no mailbox. */
    private User $leadOwner;

    /** Sees every lead and deal — a manager in all but name — with no role on any of them. */
    private User $manager;

    private EmailConnection $mailbox;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();

        $this->mailboxOwner = $this->user(['view_lead' => 'all', 'view_deals' => 'all']);
        $this->leadOwner = $this->user(['view_lead' => 'owned', 'view_deals' => 'owned']);
        $this->manager = $this->user(['view_lead' => 'all', 'view_deals' => 'all']);

        $this->mailbox = EmailConnection::factory()->forUser($this->mailboxOwner)->create();
        $this->lead = $this->lead($this->leadOwner);
    }

    public function test_unlinked_mail_is_readable_by_its_mailbox_owner_and_nobody_else(): void
    {
        $copy = $this->ingest('stranger@example.test');
        $access = $this->access();

        $this->assertSame(ReviewStatus::Unlinked, $copy->review_status);

        $this->assertTrue($access->canViewCopy($this->mailboxOwner, $copy));
        $this->assertTrue($access->canViewMessage($this->mailboxOwner, $copy->message));

        foreach ([$this->leadOwner, $this->manager, $this->user(['view_lead' => 'all']), null] as $other) {
            $this->assertFalse($access->canViewCopy($other, $copy));
            $this->assertFalse($access->canViewMessage($other, $copy->message));
        }

        // A second mailbox owner in the same company is still "another user".
        $colleague = $this->user(['view_lead' => 'all']);
        EmailConnection::factory()->forUser($colleague)->create();

        $this->assertFalse($access->canViewCopy($colleague, $copy));
        $this->assertFalse($access->canViewMessage($colleague, $copy->message));
        $this->assertSame(0, $access->ownCopies($colleague)->count());
        $this->assertSame(1, $access->ownCopies($this->mailboxOwner)->count());
    }

    public function test_linked_mail_is_readable_by_the_leads_owner_but_not_by_a_manager_or_an_unrelated_agent(): void
    {
        $copy = $this->linked($this->lead);
        $access = $this->access();

        // Mailbox owner: Y. Lead Owner (agent): L.
        $this->assertTrue($access->canViewMessage($this->mailboxOwner, $copy->message));
        $this->assertTrue($access->canViewMessage($this->leadOwner, $copy->message));
        $this->assertTrue($access->hasCommunicationsAccess($this->leadOwner, $this->lead));
        $this->assertSame([$copy->message_id], $this->onRecord($this->leadOwner, $this->lead));

        // The lead owner reads the message, never the mailbox owner's copy of it.
        $this->assertFalse($access->canViewCopy($this->leadOwner, $copy));

        // Manager: TBD, so N — seeing every lead is not communications access.
        $this->assertFalse($access->canViewMessage($this->manager, $copy->message));
        $this->assertFalse($access->hasCommunicationsAccess($this->manager, $this->lead));
        $this->assertSame([], $this->onRecord($this->manager, $this->lead));

        // Unrelated agent: N.
        $unrelated = $this->user(['view_lead' => 'owned']);

        $this->assertFalse($access->canViewMessage($unrelated, $copy->message));
        $this->assertSame([], $this->onRecord($unrelated, $this->lead));

        // Owning the lead without being allowed to see it (record access) is not enough either.
        $this->grant($this->leadOwner, ['view_lead' => 'none']);

        $this->assertFalse($this->access()->canViewMessage($this->leadOwner, $copy->message));
    }

    public function test_a_partner_who_owns_the_lead_gets_no_communications(): void
    {
        $partner = $this->user(['view_lead' => 'all', 'view_deals' => 'all']);
        DB::table('lead_agents')->insert(['company_id' => $this->company->id, 'user_id' => $partner->id, 'is_partner' => true]);
        $partnersLead = $this->lead($partner);

        $copy = $this->linked($partnersLead);
        $access = $this->access();

        $this->assertFalse($access->hasCommunicationsAccess($partner, $partnersLead));
        $this->assertFalse($access->canViewMessage($partner, $copy->message));
        $this->assertFalse($access->canViewCopy($partner, $copy));
        $this->assertSame([], $this->onRecord($partner, $partnersLead));

        // The same holds over HTTP: the record is theirs to see, its mail is not.
        $this->signIn($partner);
        $this->getJson("/email/records/lead/{$partnersLead->id}/history")->assertOk()->assertJsonPath('meta.total', 0);
        $this->getJson('/email/review')->assertOk()->assertJsonPath('meta.total', 0);

        // An agent profile that is not a partner one changes nothing for an ordinary lead owner.
        DB::table('lead_agents')->insert(['company_id' => $this->company->id, 'user_id' => $this->leadOwner->id, 'is_partner' => false]);
        $own = $this->linked($this->lead);

        $this->assertTrue($this->access()->canViewMessage($this->leadOwner, $own->message));

        // If partner status cannot be read at all, everyone is treated as one.
        Schema::drop('lead_agents');

        $this->assertFalse($this->access()->canViewMessage($this->leadOwner, $own->message));
        $this->assertTrue($this->access()->canViewMessage($this->mailboxOwner, $own->message));
    }

    public function test_a_mailbox_owner_keeps_their_own_copy_of_linked_mail_without_record_access(): void
    {
        $copy = $this->linked($this->lead);
        $this->grant($this->mailboxOwner, ['view_lead' => 'owned']);
        $access = $this->access();

        $this->assertTrue($access->canViewCopy($this->mailboxOwner, $copy));
        $this->assertTrue($access->canViewMessage($this->mailboxOwner, $copy->message));

        // Their copy, and nothing else about the lead: the record itself stays not found.
        $this->signIn($this->mailboxOwner);
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertStatus(404);
    }

    public function test_unlink_ends_record_access_at_once_and_leaves_the_owner_their_copy(): void
    {
        $copy = $this->linked($this->lead);

        $this->signIn($this->leadOwner);
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk()->assertJsonPath('events.0.id', $copy->message->uuid);

        app(ConversationLinker::class)->unlink($copy->message->conversation, $this->lead, $this->mailboxOwner);
        $access = $this->access();

        $this->assertFalse($access->canViewMessage($this->leadOwner, $copy->message));
        $this->assertSame([], $this->onRecord($this->leadOwner, $this->lead));
        $this->getJson("/email/records/lead/{$this->lead->id}/history")->assertOk()->assertJsonPath('meta.total', 0);

        $this->assertTrue($access->canViewCopy($this->mailboxOwner, $copy));
        $this->assertTrue($access->canViewMessage($this->mailboxOwner, $copy->message));
        $this->assertSame([], $this->onRecord($this->mailboxOwner, $this->lead));
    }

    public function test_a_deals_agent_and_participants_read_the_deals_mail_but_not_the_leads(): void
    {
        $agent = $this->user(['view_deals' => 'owned']);
        $participant = $this->user(['view_deals' => 'owned']);
        $watcher = $this->user(['view_deals' => 'all']);

        $agentProfile = DB::table('lead_agents')->insertGetId(['company_id' => $this->company->id, 'user_id' => $agent->id, 'is_partner' => false]);
        $deal = $this->makeEmailDeal($this->company, $this->lead, ['agent_id' => $agentProfile]);
        $deal = Deal::withoutGlobalScopes()->findOrFail($deal->id);
        DB::table('deal_participants')->insert(['deal_id' => $deal->id, 'user_id' => $participant->id]);

        $onLead = $this->linked($this->lead);
        $onDeal = $this->linked($deal, 'other@example.test');
        $access = $this->access();

        foreach ([$agent, $participant] as $member) {
            $this->assertTrue($access->canViewMessage($member, $onDeal->message));
            // Deal participant reading the lead's mail is TBD: N.
            $this->assertFalse($access->canViewMessage($member, $onLead->message));
            $this->assertSame([$onDeal->message_id], $this->onRecord($member, $deal));
        }

        // Deal watcher: TBD, so N.
        $this->assertFalse($access->canViewMessage($watcher, $onDeal->message));
        $this->assertSame([], $this->onRecord($watcher, $deal));

        // The lead's owner sees the lead's mail from the deal too, but not the deal's own.
        $this->grant($this->leadOwner, ['view_lead' => 'owned', 'view_deals' => 'all']);

        $this->assertSame([$onLead->message_id], $this->onRecord($this->leadOwner, $deal));
        $this->assertFalse($this->access()->canViewMessage($this->leadOwner, $onDeal->message));

        // The mailbox owner holds both.
        $this->assertSame([$onLead->message_id, $onDeal->message_id], $this->onRecord($this->mailboxOwner, $deal));
    }

    public function test_everything_is_denied_with_the_flag_off_or_outside_the_pilot_or_across_companies(): void
    {
        $copy = $this->linked($this->lead);

        $outsider = $this->makeEmailUser();
        $this->grant($outsider, ['view_lead' => 'all']);
        EmailPilotAllowlistEntry::factory()->forCompany($outsider->company_id)->create();

        $this->assertFalse($this->access()->canViewMessage($outsider, $copy->message));
        $this->assertSame([], $this->onRecord($outsider, $this->lead));

        EmailPilotAllowlistEntry::withoutGlobalScopes()->where('company_id', $this->company->id)->delete();

        $this->assertFalse($this->access()->canViewCopy($this->mailboxOwner, $copy));
        $this->assertFalse($this->access()->canViewMessage($this->leadOwner, $copy->message));
        $this->assertSame(0, $this->access()->ownCopies($this->mailboxOwner)->count());

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();
        $this->assertTrue($this->access()->canViewCopy($this->mailboxOwner, $copy));

        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $this->assertFalse($this->access()->canViewCopy($this->mailboxOwner, $copy));
        $this->assertFalse($this->access()->canViewMessage($this->mailboxOwner, $copy->message));
        $this->assertSame([], $this->onRecord($this->mailboxOwner, $this->lead));
    }

    public function test_email_controllers_reach_mail_only_through_the_checker(): void
    {
        $offenders = [];

        foreach (File::allFiles(app_path('Email/Http/Controllers')) as $file) {
            // A controller that queried these models itself would be deciding access on its own.
            if (preg_match('/\b(EmailMessage|EmailMailboxCopy|EmailConversation|EmailRecordLink|EmailFile)::/', $file->getContents()) === 1) {
                $offenders[] = $file->getFilename();
            }
        }

        $this->assertSame([], $offenders);
    }

    private function access(): EmailAccess
    {
        // Fresh each time: the checker remembers who is a partner for as long as it lives.
        return $this->app->make(EmailAccess::class);
    }

    /**
     * @return list<int>
     */
    private function onRecord(User $user, Model $record): array
    {
        return $this->access()->messagesOnRecord($user, $record)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    /** A message in the mailbox owner's mailbox, with its conversation linked to the record. */
    private function linked(Model $record, string $from = 'customer@example.test'): EmailMailboxCopy
    {
        $copy = $this->ingest($from);

        app(ConversationLinker::class)->link($copy->message->conversation, $record, $this->mailboxOwner, $this->mailbox);

        return $copy->fresh();
    }

    private function ingest(string $from): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($this->mailbox, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: new EmailAddress($from),
            to: [$this->mailbox->identity_email],
            subject: 'Hello',
            textBody: 'Plain text body.',
            rfcMessageId: '<'.Str::random(12).'@mail.test>',
            folder: 'INBOX',
        ));
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function user(array $permissions): User
    {
        $user = $this->makeEmailUser($this->company);
        $this->grant($user, $permissions);

        return $user;
    }

    /**
     * Stands in for the user's permission rows, which live in tables this schema does not build.
     *
     * @param  array<string, string>  $permissions
     */
    private function grant(User $user, array $permissions): void
    {
        $this->app->instance('user.permission-map.'.$user->id, $permissions);
    }

    private function lead(User $owner): Lead
    {
        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $owner->id]);

        return Lead::withoutGlobalScopes()->findOrFail($lead->id);
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
