<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Jobs\SyncMailboxJob;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailFile;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Sync\MailboxSynchronizer;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailRecordDrawerApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private Company $company;

    private User $agent;

    private EmailConnection $mailbox;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->mailbox = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'anna@agency.test',
            'from_email' => 'anna@agency.test',
        ]);
        $this->lead = $this->makeEmailLead($this->company);

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
        $this->app->instance('user.permission-map.'.$this->agent->id, ['view_lead' => 'all']);
    }

    public function test_drawer_shows_oldest_and_newest_with_bodies_and_mailbox(): void
    {
        [$oldest, $newest] = $this->seedThreadedConversation();

        $this->signIn($this->agent);

        $byMessage = $this->getJson(
            "/email/records/lead/{$this->lead->id}/messages/{$newest->uuid}",
        )->assertOk();

        $byMessage->assertJsonPath('conversation.message_count', 2)
            ->assertJsonPath('messages.0.id', $oldest->uuid)
            ->assertJsonPath('messages.1.id', $newest->uuid)
            ->assertJsonPath('focus_message_id', $newest->uuid)
            ->assertJsonPath('messages.0.subject', 'Villa viewing')
            ->assertJsonPath('messages.1.subject', 'Re: Villa viewing')
            ->assertJsonPath('messages.0.text_body', 'Can we see it Friday?')
            ->assertJsonPath('messages.1.text_body', 'Friday works.')
            ->assertJsonPath('messages.0.mailbox.email', 'anna@agency.test')
            ->assertJsonPath('messages.0.from.address', 'customer@example.test');

        $this->assertArrayNotHasKey('html_raw', $byMessage->json('messages.0'));
        $this->assertArrayNotHasKey('bcc', $byMessage->json('messages.0'));

        $conversationId = $byMessage->json('conversation.id');

        $this->getJson(
            "/email/records/lead/{$this->lead->id}/conversations/{$conversationId}?message={$oldest->uuid}",
        )->assertOk()
            ->assertJsonPath('focus_message_id', $oldest->uuid)
            ->assertJsonPath('messages.0.id', $oldest->uuid)
            ->assertJsonPath('messages.1.id', $newest->uuid);
    }

    public function test_exchanged_attachment_deep_links_to_its_message(): void
    {
        [$oldest, $newest] = $this->seedThreadedConversation(withAttachmentOnNewest: true);

        $file = EmailFile::withoutGlobalScopes()->sole();

        $this->signIn($this->agent);

        $response = $this->getJson(
            "/email/records/lead/{$this->lead->id}/messages/{$oldest->uuid}",
        )->assertOk();

        $response->assertJsonPath('exchanged_attachments.0.id', $file->uuid)
            ->assertJsonPath('exchanged_attachments.0.message_id', $newest->uuid)
            ->assertJsonPath('exchanged_attachments.0.filename', 'plan.pdf')
            ->assertJsonPath('messages.1.files.0.id', $file->uuid);

        $this->assertStringNotContainsString('html_raw', $response->getContent());
        $this->assertStringNotContainsString('storage_key', $response->getContent());
    }

    public function test_bcc_is_only_present_when_this_mailbox_knows_it(): void
    {
        $this->fake->seedOutbound($this->mailbox->toContext(), [
            'subject' => 'Quiet note',
            'text' => 'Internal bcc',
            'bcc' => ['quiet@agency.test'],
            'rfc_message_id' => '<bcc-known@agency.test>',
            'sent_at' => '2026-10-02T10:00:00+00:00',
        ]);
        $this->sync();

        $copy = EmailMailboxCopy::withoutGlobalScopes()->sole();
        $this->signIn($this->agent);
        $this->postJson("/email/copies/{$copy->uuid}/link", [
            'record_type' => 'lead',
            'record_id' => $this->lead->id,
        ])->assertOk();

        $message = EmailMessage::withoutGlobalScopes()->sole();

        $this->getJson("/email/records/lead/{$this->lead->id}/messages/{$message->uuid}")
            ->assertOk()
            ->assertJsonPath('messages.0.bcc.0.address', 'quiet@agency.test');
    }

    public function test_unknown_message_on_record_is_404(): void
    {
        $this->signIn($this->agent);

        $this->getJson('/email/records/lead/'.$this->lead->id.'/messages/'.fake()->uuid())
            ->assertStatus(404);
    }

    /**
     * @return array{0: EmailMessage, 1: EmailMessage}
     */
    private function seedThreadedConversation(bool $withAttachmentOnNewest = false): array
    {
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Villa viewing',
            'text' => 'Can we see it Friday?',
            'rfc_message_id' => '<root@mail.example.test>',
            'sent_at' => '2026-10-01T09:00:00+00:00',
        ]);
        $this->fake->seedInbound($this->mailbox->toContext(), [
            'from' => 'Customer Person <customer@example.test>',
            'subject' => 'Re: Villa viewing',
            'text' => 'Friday works.',
            'rfc_message_id' => '<reply@mail.example.test>',
            'in_reply_to' => '<root@mail.example.test>',
            'sent_at' => '2026-10-01T11:00:00+00:00',
            'attachments' => $withAttachmentOnNewest
                ? [['filename' => 'plan.pdf', 'bytes' => '%PDF-1.4 plan', 'mime_type' => 'application/pdf']]
                : [],
        ]);
        $this->sync();

        $copies = EmailMailboxCopy::withoutGlobalScopes()
            ->where('connection_id', $this->mailbox->id)
            ->orderBy('id')
            ->get();

        $this->signIn($this->agent);
        foreach ($copies as $copy) {
            $this->postJson("/email/copies/{$copy->uuid}/link", [
                'record_type' => 'lead',
                'record_id' => $this->lead->id,
            ])->assertOk();
        }

        $messages = EmailMessage::withoutGlobalScopes()
            ->orderBy('sent_at')
            ->orderBy('id')
            ->get();

        $this->assertCount(2, $messages);
        $this->assertSame($messages[0]->conversation_id, $messages[1]->conversation_id);

        return [$messages[0], $messages[1]];
    }

    private function sync(): void
    {
        $this->assertTrue(
            (new SyncMailboxJob($this->mailbox->id))->handle(app(MailboxSynchronizer::class))->succeeded(),
        );
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');
        $this->actingAs($user);
    }
}
