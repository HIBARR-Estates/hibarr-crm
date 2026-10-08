<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Email\Models\EmailSignature;
use App\Models\User;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class SendApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private User $agent;

    private EmailConnection $connection;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->agent = $this->makeEmailUser();
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'anna@agency.test',
            'from_email' => 'anna@agency.test',
            'reply_to_email' => 'replies@agency.test',
        ]);
        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
    }

    public function test_flag_off_answers_404(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->signIn($this->agent);

        $this->postJson('/email/send', $this->payload())->assertStatus(404);
    }

    public function test_accepted_send_reports_sent_not_delivered(): void
    {
        $this->signIn($this->agent);

        $response = $this->postJson('/email/send', $this->payload());

        $response->assertStatus(201)
            ->assertJsonPath('attempt.status', 'sent')
            ->assertJsonPath('attempt.error_code', null)
            ->assertJsonMissingPath('attempt.delivered')
            ->assertJsonMissing(['delivered']);

        $this->assertSame('sent', $response->json('attempt.status'));
        $this->assertStringNotContainsString('delivered', strtolower($response->getContent()));
        $this->assertSame(SendAttemptStatus::Sent, EmailSendAttempt::withoutGlobalScopes()->sole()->status);
        $this->assertCount(1, $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_missing_to_keeps_draft_on_the_attempt(): void
    {
        $this->signIn($this->agent);

        $response = $this->postJson('/email/send', $this->payload([
            'to' => [],
            'subject' => 'Draft without recipients',
            'text_body' => 'Still composing.',
        ]));

        $response->assertOk()
            ->assertJsonPath('attempt.status', 'failed')
            ->assertJsonPath('attempt.error_code', 'validation_missing_to')
            ->assertJsonPath('attempt.draft.subject', 'Draft without recipients')
            ->assertJsonPath('attempt.draft.text_body', 'Still composing.')
            ->assertJsonPath('attempt.draft.to', []);

        $attempt = EmailSendAttempt::withoutGlobalScopes()->sole();

        $this->assertSame(SendAttemptStatus::Failed, $attempt->status);
        $this->assertSame('Draft without recipients', $attempt->draft()->subject);
        $this->assertSame('Still composing.', $attempt->draft()->textBody);
        $this->assertSame([], $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_from_and_reply_to_come_from_the_connection_not_the_client(): void
    {
        $this->signIn($this->agent);

        $this->postJson('/email/send', $this->payload([
            'from' => 'spoof@evil.test',
            'reply_to' => 'spoof@evil.test',
        ]))->assertStatus(201);

        $draft = $this->fake->sendCalls($this->connection->uuid)[0];

        $this->assertSame('anna@agency.test', $draft->from->address);
        $this->assertSame('replies@agency.test', $draft->replyTo?->address);
    }

    public function test_signature_is_appended_once_when_requested(): void
    {
        EmailSignature::withoutGlobalScopes()->create([
            'company_id' => $this->connection->company_id,
            'connection_id' => $this->connection->id,
            'text_body' => 'Agent Anna',
            'html_body' => '<p>Agent Anna</p>',
        ]);

        $this->signIn($this->agent);

        $this->postJson('/email/send', $this->payload([
            'include_signature' => true,
            'text_body' => 'Hello',
            'html_body' => '<p>Hello</p>',
        ]))->assertStatus(201);

        $draft = $this->fake->sendCalls($this->connection->uuid)[0];

        $this->assertSame("Hello\n\n--\nAgent Anna", $draft->textBody);
        $this->assertStringContainsString('Hello', (string) $draft->htmlBody);
        $this->assertStringContainsString('Agent Anna', (string) $draft->htmlBody);
        $this->assertSame(1, substr_count((string) $draft->textBody, 'Agent Anna'));
    }

    public function test_reply_headers_are_accepted(): void
    {
        $this->signIn($this->agent);

        // Angle brackets are stripped by the global XSS middleware; bare ids
        // are accepted and re-wrapped by RfcMessageId::normalize.
        $response = $this->postJson('/email/send', $this->payload([
            'in_reply_to' => 'root@mail.example.test',
            'references' => ['root@mail.example.test', 'earlier@mail.example.test'],
            'subject' => 'Re: Villa',
        ]));

        $response->assertStatus(201)
            ->assertJsonPath('attempt.is_reply', true)
            ->assertJsonPath('attempt.draft.in_reply_to', '<root@mail.example.test>')
            ->assertJsonPath('attempt.draft.references.0', '<root@mail.example.test>')
            ->assertJsonPath('attempt.draft.references.1', '<earlier@mail.example.test>');

        $attempt = EmailSendAttempt::withoutGlobalScopes()->sole();

        $this->assertTrue($attempt->draft()->isReply());
        $this->assertSame('<root@mail.example.test>', $attempt->draft()->inReplyTo);
    }

    public function test_connections_index_includes_signature_for_composer(): void
    {
        EmailSignature::withoutGlobalScopes()->create([
            'company_id' => $this->connection->company_id,
            'connection_id' => $this->connection->id,
            'text_body' => 'Best regards',
            'html_body' => null,
        ]);

        $this->signIn($this->agent);

        $this->getJson('/email/connections')
            ->assertOk()
            ->assertJsonPath('connections.0.signature.has_content', true)
            ->assertJsonPath('connections.0.signature.text', 'Best regards');
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'connection_id' => $this->connection->uuid,
            'to' => ['lead@example.test'],
            'cc' => [],
            'subject' => 'Villa viewing',
            'text_body' => 'See you Friday.',
            'include_signature' => false,
        ], $overrides);
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);

        $this->actingAs($user);
    }
}
