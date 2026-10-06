<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\Enums\LinkableType;
use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailConversation;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailRecordLink;
use App\Models\Company;
use App\Models\User;
use DomainException;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use LogicException;
use Tests\Concerns\BuildsEmailSchema;
use Tests\TestCase;

class ConversationLinkerTest extends TestCase
{
    use BuildsEmailSchema;

    private ConversationLinker $linker;

    private Company $company;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();

        $this->linker = app(ConversationLinker::class);
        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();
    }

    public function test_tables_exist_with_the_domain_columns(): void
    {
        $this->assertTrue(Schema::hasColumns('email_conversations', ['uuid', 'company_id']));
        $this->assertTrue(Schema::hasColumn('email_messages', 'conversation_id'));
        $this->assertTrue(Schema::hasColumns('email_record_links', [
            'company_id', 'conversation_id', 'linkable_type', 'linkable_id', 'linked_by', 'linked_at',
        ]));
        $this->assertTrue(Schema::hasColumns('email_link_audits', [
            'company_id', 'action', 'conversation_id', 'mailbox_copy_id', 'linkable_type', 'linkable_id', 'actor_id', 'meta', 'created_at',
        ]));
    }

    public function test_link_projects_the_conversation_onto_a_lead_and_audits_it(): void
    {
        [$conversation, $copies] = $this->conversationWithCopies(2);
        $lead = $this->makeEmailLead($this->company);

        $link = $this->linker->link($conversation, $lead, $this->agent);

        $this->assertTrue(Str::isUuid($conversation->uuid));
        $this->assertSame(LinkableType::Lead, $link->linkable_type);
        $this->assertSame((int) $lead->id, (int) $link->linkable_id);
        $this->assertSame((int) $this->agent->id, (int) $link->linked_by);
        $this->assertNotNull($link->linked_at);
        $this->assertSame((int) $this->company->id, (int) $link->company_id);
        $this->assertTrue($this->linker->isLinked($conversation));
        $this->assertSame('lead', Schema::getConnection()->table('email_record_links')->value('linkable_type'));

        $audit = EmailLinkAudit::withoutGlobalScopes()->sole();

        $this->assertSame(LinkAuditAction::Link, $audit->action);
        $this->assertSame($conversation->id, $audit->conversation_id);
        $this->assertSame(LinkableType::Lead, $audit->linkable_type);
        $this->assertSame((int) $lead->id, (int) $audit->linkable_id);
        $this->assertSame((int) $this->agent->id, (int) $audit->actor_id);
        $this->assertNotNull($audit->created_at);

        foreach ($copies as $copy) {
            $this->assertSame(ReviewStatus::None, $copy->fresh()->review_status);
        }
    }

    public function test_unlink_removes_the_projection_leaves_copies_and_writes_an_audit_row(): void
    {
        [$conversation, $copies] = $this->conversationWithCopies(2);
        $lead = $this->makeEmailLead($this->company);

        $this->linker->link($conversation, $lead, $this->agent);

        $this->assertTrue($this->linker->unlink($conversation, $lead, $this->agent));

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertFalse($this->linker->isLinked($conversation));

        // Mail is untouched: same copies, same messages, same conversation.
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(2, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame(2, $conversation->messages()->withoutGlobalScopes()->count());
        $this->assertNotNull(EmailConversation::withoutGlobalScopes()->find($conversation->id));

        foreach ($copies as $copy) {
            $fresh = $copy->fresh();

            $this->assertNotNull($fresh);
            $this->assertSame($this->connection->id, $fresh->connection_id);
            $this->assertSame(ReviewStatus::Unlinked, $fresh->review_status);
        }

        $actions = EmailLinkAudit::withoutGlobalScopes()->orderBy('id')->get();

        $this->assertSame(
            [LinkAuditAction::Link, LinkAuditAction::Unlink],
            $actions->map(fn (EmailLinkAudit $audit) => $audit->action)->all(),
        );
        $this->assertSame((int) $lead->id, (int) $actions[1]->linkable_id);
        $this->assertSame((int) $this->agent->id, (int) $actions[1]->actor_id);
    }

    public function test_link_and_unlink_are_idempotent(): void
    {
        [$conversation] = $this->conversationWithCopies(1);
        $lead = $this->makeEmailLead($this->company);

        $first = $this->linker->link($conversation, $lead, $this->agent);
        $second = $this->linker->link($conversation, $lead, $this->agent);

        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailLinkAudit::withoutGlobalScopes()->count());

        $this->assertTrue($this->linker->unlink($conversation, $lead, $this->agent));
        $this->assertFalse($this->linker->unlink($conversation, $lead, $this->agent));
        $this->assertSame(2, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_conversation_can_link_to_a_lead_and_a_deal_and_stays_linked_until_the_last_goes(): void
    {
        [$conversation, $copies] = $this->conversationWithCopies(1);
        $lead = $this->makeEmailLead($this->company);
        $deal = $this->makeEmailDeal($this->company, $lead);

        $this->linker->link($conversation, $lead);
        $dealLink = $this->linker->link($conversation, $deal);

        $this->assertSame(LinkableType::Deal, $dealLink->linkable_type);
        $this->assertNull($dealLink->linked_by);
        $this->assertSame(2, $conversation->links()->withoutGlobalScopes()->count());

        $this->linker->unlink($conversation, $lead);

        $this->assertTrue($this->linker->isLinked($conversation));
        $this->assertSame(ReviewStatus::None, $copies[0]->fresh()->review_status);

        $this->linker->unlink($conversation, $deal);

        $this->assertSame(ReviewStatus::Unlinked, $copies[0]->fresh()->review_status);
        $this->assertSame(1, EmailMailboxCopy::withoutGlobalScopes()->count());
    }

    public function test_link_and_unlink_leave_dismissed_copies_as_they_are(): void
    {
        [$conversation, $copies] = $this->conversationWithCopies(2);
        $copies[0]->update(['review_status' => ReviewStatus::Dismissed]);
        $copies[1]->update(['review_status' => ReviewStatus::Unlinked]);
        $lead = $this->makeEmailLead($this->company);

        $this->linker->link($conversation, $lead);

        $this->assertSame(ReviewStatus::Dismissed, $copies[0]->fresh()->review_status);
        $this->assertSame(ReviewStatus::None, $copies[1]->fresh()->review_status);

        $this->linker->unlink($conversation, $lead);

        $this->assertSame(ReviewStatus::Dismissed, $copies[0]->fresh()->review_status);
        $this->assertSame(ReviewStatus::Unlinked, $copies[1]->fresh()->review_status);
    }

    public function test_unlink_only_touches_its_own_conversation(): void
    {
        [$conversation] = $this->conversationWithCopies(1);
        [$other, $otherCopies] = $this->conversationWithCopies(1);
        $lead = $this->makeEmailLead($this->company);

        $this->linker->link($conversation, $lead);
        $this->linker->link($other, $lead);
        $this->linker->unlink($conversation, $lead);

        $this->assertTrue($this->linker->isLinked($other));
        $this->assertSame(ReviewStatus::None, $otherCopies[0]->fresh()->review_status);
    }

    public function test_cannot_link_across_companies_or_to_other_record_types(): void
    {
        [$conversation] = $this->conversationWithCopies(1);
        $otherCompany = $this->makeEmailCompany();

        foreach ([
            fn () => $this->linker->link($conversation, $this->makeEmailLead($otherCompany), $this->agent),
            fn () => $this->linker->link($conversation, $this->makeEmailLead($this->company), $this->makeEmailUser($otherCompany)),
            fn () => $this->linker->link($conversation, $this->agent, $this->agent),
            fn () => $this->linker->unlink($conversation, $this->makeEmailDeal($otherCompany), $this->agent),
        ] as $attempt) {
            try {
                $attempt();
                $this->fail('Expected the link attempt to be refused.');
            } catch (DomainException) {
                // refused
            }
        }

        $this->assertSame(0, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(0, EmailLinkAudit::withoutGlobalScopes()->count());
    }

    public function test_audit_rows_are_append_only(): void
    {
        [$conversation] = $this->conversationWithCopies(1);
        $this->linker->link($conversation, $this->makeEmailLead($this->company), $this->agent);

        $audit = EmailLinkAudit::withoutGlobalScopes()->sole();

        try {
            $audit->update(['actor_id' => null]);
            $this->fail('Expected audit rows to refuse updates.');
        } catch (LogicException) {
            // refused
        }

        $this->expectException(LogicException::class);

        $audit->delete();
    }

    public function test_links_and_audits_are_isolated_to_the_logged_in_users_company(): void
    {
        [$conversation] = $this->conversationWithCopies(1);
        $this->linker->link($conversation, $this->makeEmailLead($this->company), $this->agent);

        $this->actingAs($this->makeEmailUser($this->makeEmailCompany()));

        $this->assertSame(0, EmailConversation::query()->count());
        $this->assertSame(0, EmailRecordLink::query()->count());
        $this->assertSame(0, EmailLinkAudit::query()->count());
        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());
    }

    /**
     * @return array{0: EmailConversation, 1: list<EmailMailboxCopy>}
     */
    private function conversationWithCopies(int $count): array
    {
        $conversation = EmailConversation::withoutGlobalScopes()->create(['company_id' => $this->company->id]);
        $copies = [];

        for ($i = 0; $i < $count; $i++) {
            $copy = app(MessageIngestor::class)->ingestNormalized($this->connection, new NormalizedMessage(
                providerMessageId: 'prov-'.Str::random(8),
                direction: MessageDirection::Inbound,
                from: new EmailAddress('lead@example.test'),
                to: [$this->connection->identity_email],
                subject: 'Villa viewing',
                textBody: 'Hello',
                rfcMessageId: Str::random(12).'@mail.example.test',
                folder: 'INBOX',
            ));

            $copy->message->update(['conversation_id' => $conversation->id]);
            $copies[] = $copy;
        }

        return [$conversation, $copies];
    }
}
