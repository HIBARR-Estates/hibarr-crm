<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\ConversationLinker;
use App\Email\Linking\RecordFeed;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailRecordLink;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DealFeedTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $agent;

    private EmailConnection $connection;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create();
        $this->lead = $this->makeEmailLead($this->company, 'lead@example.test');

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();
        $this->app->instance('user.permission-map.'.$this->agent->id, ['view_lead' => 'all', 'view_deals' => 'all']);
    }

    public function test_a_deal_created_with_the_lead_lists_the_leads_conversation_once(): void
    {
        // Mail matched to the lead before any deal existed.
        $first = $this->ingest('<a@mail.test>');
        $reply = $this->ingest('<b@mail.test>', '<a@mail.test>');
        $messages = EmailMessage::withoutGlobalScopes()->count();
        $links = EmailRecordLink::withoutGlobalScopes()->count();

        $deal = $this->makeEmailDeal($this->company, $this->lead);
        $unrelated = $this->makeEmailDeal($this->company, $this->makeEmailLead($this->company));

        $this->assertSame([$first->message->conversation_id], $this->conversations($deal));
        $this->assertSame([$first->message_id, $reply->message_id], $this->messages($deal));
        $this->assertSame([], $this->conversations($unrelated));
        $this->assertSame([], $this->messages($unrelated));

        // Linking the same conversation to the deal as well still lists it once.
        app(ConversationLinker::class)->link($first->message->conversation, $deal);

        $this->assertSame([$first->message->conversation_id], $this->conversations($deal));
        $this->assertSame([$first->message_id, $reply->message_id], $this->messages($deal));

        // Nothing was copied to make the deal show it.
        $this->assertSame($messages, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame($links + 1, EmailRecordLink::withoutGlobalScopes()->count());
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());

        // The lead's own feed is unchanged.
        $this->assertSame([$first->message_id, $reply->message_id], $this->messages($this->lead));
    }

    public function test_the_deal_history_endpoint_shows_the_leads_mail_once(): void
    {
        $copy = $this->ingest('<a@mail.test>');
        $deal = $this->makeEmailDeal($this->company, $this->lead);
        app(ConversationLinker::class)->link($copy->message->conversation, $deal);

        cache()->forever('user_is_active_'.$this->agent->id, true);
        $this->actingAs($this->agent);

        $this->getJson("/email/records/deal/{$deal->id}/history")
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonCount(1, 'events')
            ->assertJsonPath('events.0.id', $copy->message->uuid)
            ->assertJsonPath('events.0.copy_id', $copy->uuid);
    }

    public function test_deal_timeline_groups_show_lead_linked_conversation_once_after_conversion(): void
    {
        $first = $this->ingest('<a@mail.test>');
        $this->ingest('<b@mail.test>', '<a@mail.test>');
        $deal = $this->makeEmailDeal($this->company, $this->lead);

        cache()->forever('user_is_active_'.$this->agent->id, true);
        $this->actingAs($this->agent);

        // Via lead_id only — no direct deal link — still one Timeline group.
        $this->getJson("/email/records/deal/{$deal->id}/timeline")
            ->assertOk()
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.message_count', 2)
            ->assertJsonPath('groups.0.id', $first->message->conversation->uuid);

        app(ConversationLinker::class)->link($first->message->conversation, $deal);

        $this->getJson("/email/records/deal/{$deal->id}/timeline")
            ->assertOk()
            ->assertJsonCount(1, 'groups')
            ->assertJsonPath('groups.0.message_count', 2);
    }

    public function test_a_deal_does_not_show_mail_the_lead_no_longer_has_or_another_leads_mail(): void
    {
        $copy = $this->ingest('<a@mail.test>');
        $deal = $this->makeEmailDeal($this->company, $this->lead);
        $otherLeadsDeal = $this->makeEmailDeal($this->company, $this->makeEmailLead($this->company));
        $foreignDeal = $this->makeEmailDeal($this->makeEmailCompany(), $this->lead);

        $this->assertSame([], $this->messages($otherLeadsDeal));
        $this->assertSame([], $this->messages($foreignDeal));

        app(ConversationLinker::class)->unlink($copy->message->conversation, Lead::withoutGlobalScopes()->findOrFail($this->lead->id));

        $this->assertSame([], $this->messages($deal));
        $this->assertSame([], $this->conversations($deal));
        $this->assertNotNull($copy->fresh());
    }

    /**
     * @return list<int>
     */
    private function conversations(Model $record): array
    {
        return app(RecordFeed::class)->conversations($record)->pluck('conversation_id')->map(fn ($id) => (int) $id)->all();
    }

    /**
     * @return list<int>
     */
    private function messages(Model $record): array
    {
        return app(RecordFeed::class)->messages($record)->pluck('id')->map(fn ($id) => (int) $id)->all();
    }

    private function ingest(string $rfcMessageId, ?string $inReplyTo = null): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($this->connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: new EmailAddress('lead@example.test'),
            to: [$this->connection->identity_email],
            subject: 'Hello',
            textBody: 'Plain text body.',
            rfcMessageId: $rfcMessageId,
            inReplyTo: $inReplyTo,
            folder: 'INBOX',
        ));
    }
}
