<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Enums\LinkableType;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailRecordLink;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\TestCase;

class ContactMatcherTest extends TestCase
{
    use BuildsEmailSchema;

    private MessageIngestor $ingestor;

    private Company $company;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();

        $this->ingestor = app(MessageIngestor::class);
        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();

        $this->grantViewLead($this->agent, 'all');
    }

    public function test_unique_lead_email_links_the_conversation_to_that_lead(): void
    {
        $lead = $this->makeEmailLead($this->company, 'lead@example.test');

        $copy = $this->inbound('Lead Person <Lead@Example.test>');

        $link = EmailRecordLink::withoutGlobalScopes()->sole();

        $this->assertSame(LinkableType::Lead, $link->linkable_type);
        $this->assertSame((int) $lead->id, (int) $link->linkable_id);
        $this->assertSame((int) $copy->message->conversation_id, (int) $link->conversation_id);
        $this->assertNull($link->linked_by);
        $this->assertSame(ReviewStatus::None, $copy->fresh()->review_status);
        $this->assertSame(1, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_two_leads_with_the_same_email_go_to_review(): void
    {
        $this->makeEmailLead($this->company, 'shared@example.test');
        $this->makeEmailLead($this->company, 'shared@example.test');

        $copy = $this->inbound('shared@example.test');

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    public function test_unknown_sender_goes_to_review(): void
    {
        $this->makeEmailLead($this->company, 'someone-else@example.test');

        $copy = $this->inbound('stranger@example.test');

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    public function test_an_extra_contact_method_email_matches_its_lead(): void
    {
        $lead = $this->makeEmailLead($this->company, 'main@example.test');
        $this->addContactEmail($lead, 'assistant@example.test');

        $this->inbound('assistant@example.test');

        $this->assertSame((int) $lead->id, (int) EmailRecordLink::withoutGlobalScopes()->sole()->linkable_id);
    }

    public function test_an_address_shared_through_a_contact_method_goes_to_review(): void
    {
        $this->makeEmailLead($this->company, 'family@example.test');
        $spouse = $this->makeEmailLead($this->company, 'spouse@example.test');
        $this->addContactEmail($spouse, 'family@example.test');

        $copy = $this->inbound('family@example.test');

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    public function test_a_lead_the_mailbox_owner_may_not_see_goes_to_review(): void
    {
        $this->grantViewLead($this->agent, 'owned');
        $colleague = $this->makeEmailUser($this->company);
        $this->makeEmailLead($this->company, 'theirs@example.test', ['lead_owner' => $colleague->id]);
        $mine = $this->makeEmailLead($this->company, 'mine@example.test', ['lead_owner' => $this->agent->id]);

        $hidden = $this->inbound('theirs@example.test');
        $visible = $this->inbound('mine@example.test');

        $this->assertSame(ReviewStatus::Unlinked, $hidden->fresh()->review_status);
        $this->assertSame(ReviewStatus::None, $visible->fresh()->review_status);
        $this->assertSame((int) $mine->id, (int) EmailRecordLink::withoutGlobalScopes()->sole()->linkable_id);
    }

    public function test_unreadable_or_missing_permissions_fail_closed_to_review(): void
    {
        $this->makeEmailLead($this->company, 'lead@example.test');

        $this->grantViewLead($this->agent, 'none');
        $denied = $this->inbound('lead@example.test');

        // No permission map at all: the lookup hits tables this schema lacks and throws.
        $this->app->offsetUnset('user.permission-map.'.$this->agent->id);
        $unreadable = $this->inbound('lead@example.test');

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $denied->fresh()->review_status);
        $this->assertSame(ReviewStatus::Unlinked, $unreadable->fresh()->review_status);
    }

    public function test_leads_in_another_company_and_deleted_leads_never_match(): void
    {
        $this->makeEmailLead($this->makeEmailCompany(), 'lead@example.test');
        $this->makeEmailLead($this->company, 'gone@example.test', ['deleted_at' => now()]);

        $foreign = $this->inbound('lead@example.test');
        $deleted = $this->inbound('gone@example.test');

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $foreign->fresh()->review_status);
        $this->assertSame(ReviewStatus::Unlinked, $deleted->fresh()->review_status);
    }

    public function test_sent_mail_matches_on_its_recipients_not_on_the_owner(): void
    {
        $lead = $this->makeEmailLead($this->company, 'lead@example.test');
        // The owner's own address on a lead must never make their sent mail match it.
        $this->makeEmailLead($this->company, $this->connection->identity_email);

        $copy = $this->ingest(MessageDirection::Outbound, $this->connection->identity_email, ['lead@example.test']);

        $this->assertSame((int) $lead->id, (int) EmailRecordLink::withoutGlobalScopes()->sole()->linkable_id);
        $this->assertSame(ReviewStatus::None, $copy->fresh()->review_status);
    }

    public function test_sent_mail_to_two_different_leads_goes_to_review(): void
    {
        $this->makeEmailLead($this->company, 'one@example.test');
        $this->makeEmailLead($this->company, 'two@example.test');

        $copy = $this->ingest(MessageDirection::Outbound, $this->connection->identity_email, ['one@example.test'], ['two@example.test']);

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    public function test_a_reply_in_a_linked_conversation_rides_along_whoever_sent_it(): void
    {
        $this->makeEmailLead($this->company, 'lead@example.test');

        $first = $this->inbound('lead@example.test', rfcMessageId: '<a@mail.test>');
        $reply = $this->inbound('stranger@example.test', rfcMessageId: '<b@mail.test>', inReplyTo: '<a@mail.test>');

        $this->assertSame($first->message->conversation_id, $reply->message->conversation_id);
        $this->assertSame(ReviewStatus::None, $reply->fresh()->review_status);
        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_a_known_sender_joining_a_conversation_in_review_brings_it_onto_their_lead(): void
    {
        $this->makeEmailLead($this->company, 'lead@example.test');

        $first = $this->inbound('stranger@example.test', rfcMessageId: '<a@mail.test>');
        $this->assertSame(ReviewStatus::Unlinked, $first->fresh()->review_status);

        $this->inbound('lead@example.test', rfcMessageId: '<b@mail.test>', inReplyTo: '<a@mail.test>');

        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::None, $first->fresh()->review_status);
    }

    public function test_a_conversation_someone_unlinked_is_not_linked_again_by_new_mail(): void
    {
        $lead = $this->makeEmailLead($this->company, 'lead@example.test');
        $first = $this->inbound('lead@example.test', rfcMessageId: '<a@mail.test>');

        app(ConversationLinker::class)->unlink($first->message->conversation, Lead::withoutGlobalScopes()->findOrFail($lead->id), $this->agent);

        $reply = $this->inbound('lead@example.test', rfcMessageId: '<b@mail.test>', inReplyTo: '<a@mail.test>');

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::Unlinked, $reply->fresh()->review_status);
    }

    public function test_syncing_the_same_copy_again_does_not_decide_it_again(): void
    {
        $copy = $this->inbound('lead@example.test', providerId: 'p-1');
        $copy->update(['review_status' => ReviewStatus::Dismissed]);

        // The lead appears afterwards; the dismissed copy stays dismissed and unlinked.
        $this->makeEmailLead($this->company, 'lead@example.test');
        $this->inbound('lead@example.test', providerId: 'p-1');

        $this->assertSame(ReviewStatus::Dismissed, $copy->fresh()->review_status);
        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
    }

    private function inbound(
        string $from,
        ?string $rfcMessageId = null,
        ?string $inReplyTo = null,
        ?string $providerId = null,
    ): EmailMailboxCopy {
        return $this->ingest(MessageDirection::Inbound, $from, [$this->connection->identity_email], [], $rfcMessageId, $inReplyTo, $providerId);
    }

    /**
     * @param  list<string>  $to
     * @param  list<string>  $cc
     */
    private function ingest(
        MessageDirection $direction,
        string $from,
        array $to,
        array $cc = [],
        ?string $rfcMessageId = null,
        ?string $inReplyTo = null,
        ?string $providerId = null,
    ): EmailMailboxCopy {
        return $this->ingestor->ingestNormalized($this->connection, new NormalizedMessage(
            providerMessageId: $providerId ?? 'prov-'.Str::random(10),
            direction: $direction,
            from: EmailAddress::tryParse($from),
            to: $to,
            cc: $cc,
            subject: 'Villa viewing',
            textBody: 'Hello',
            rfcMessageId: $rfcMessageId ?? '<'.Str::random(12).'@mail.test>',
            inReplyTo: $inReplyTo,
            folder: $direction === MessageDirection::Outbound ? 'Sent' : 'INBOX',
        ));
    }

    /** Stands in for the user's permission rows, which live in tables this schema does not build. */
    private function grantViewLead(User $user, string $scope): void
    {
        $this->app->instance('user.permission-map.'.$user->id, ['view_lead' => $scope]);
    }

    private function addContactEmail(Lead $lead, string $email): void
    {
        DB::table('lead_contact_methods')->insert([
            'lead_id' => $lead->id,
            'company_id' => $lead->company_id,
            'type' => 'email',
            'identifier' => $email,
            'normalized' => strtolower($email),
            'is_main' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
