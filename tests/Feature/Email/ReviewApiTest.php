<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\Company;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ReviewApiTest extends TestCase
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

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();
        $this->grantViewLead($this->agent, 'owned');
    }

    public function test_owner_sees_sender_recipients_subject_time_and_a_safe_preview(): void
    {
        $copy = $this->ingest($this->connection, 'Stranger Person <stranger@example.test>', [
            'cc' => ['Partner <partner@example.test>'],
            'subject' => 'Villa viewing',
            'textBody' => null,
            'htmlRaw' => '<style>p{color:red}</style><p onclick="steal()">See you <b>Friday</b> &amp; Saturday.</p><script>alert(1)</script>',
        ]);
        $this->signIn($this->agent);

        $response = $this->getJson('/email/review')->assertOk();

        $response->assertJsonPath('meta.total', 1)
            ->assertJsonPath('items.0.id', $copy->uuid)
            ->assertJsonPath('items.0.connection_id', $this->connection->uuid)
            ->assertJsonPath('items.0.direction', 'inbound')
            ->assertJsonPath('items.0.from', ['address' => 'stranger@example.test', 'name' => 'Stranger Person'])
            ->assertJsonPath('items.0.to', [['address' => $this->connection->identity_email, 'name' => null]])
            ->assertJsonPath('items.0.cc', [['address' => 'partner@example.test', 'name' => 'Partner']])
            ->assertJsonPath('items.0.subject', 'Villa viewing')
            ->assertJsonPath('items.0.sent_at', '2026-10-01T09:30:00+00:00')
            ->assertJsonPath('items.0.preview', 'See you Friday & Saturday.')
            ->assertJsonPath('items.0.record_exists', false);

        // Headers and preview only: no body, no raw HTML, no provider or database ids.
        $item = $response->json('items.0');

        foreach (['text_body', 'html_raw', 'html_safe', 'body', 'provider_message_id', 'message_id', 'bcc'] as $absent) {
            $this->assertArrayNotHasKey($absent, $item);
        }
        $this->assertStringNotContainsString('onclick', $response->getContent());
        $this->assertStringNotContainsString('alert(1)', $response->getContent());

        $this->getJson("/email/review/{$copy->uuid}")
            ->assertOk()
            ->assertExactJson(['item' => $item]);
    }

    public function test_only_copies_waiting_in_review_are_listed(): void
    {
        $this->makeEmailLead($this->company, 'lead@example.test', ['lead_owner' => $this->agent->id]);

        $linked = $this->ingest($this->connection, 'lead@example.test');
        $dismissed = $this->ingest($this->connection, 'spam@example.test');
        $dismissed->update(['review_status' => ReviewStatus::Dismissed]);
        $older = $this->ingest($this->connection, 'first@example.test');
        $newer = $this->ingest($this->connection, 'second@example.test');
        $this->signIn($this->agent);

        $response = $this->getJson('/email/review?per_page=1')->assertOk();

        $response->assertJsonPath('meta.total', 2)->assertJsonPath('meta.last_page', 2);
        $this->assertSame([$newer->uuid], array_column($response->json('items'), 'id'));
        $this->assertSame(
            [$older->uuid],
            array_column($this->getJson('/email/review?per_page=1&page=2')->json('items'), 'id'),
        );

        $this->getJson("/email/review/{$linked->uuid}")->assertStatus(404);
        $this->getJson("/email/review/{$dismissed->uuid}")->assertStatus(404);
    }

    public function test_another_users_review_copy_cannot_be_listed_or_opened(): void
    {
        $colleague = $this->makeEmailUser($this->company);
        $stranger = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forCompany($stranger->company_id)->create();

        $mine = $this->ingest($this->connection, 'stranger@example.test');
        $theirs = [
            $this->ingest(EmailConnection::factory()->forUser($colleague)->create(), 'stranger@example.test'),
            $this->ingest(EmailConnection::factory()->forUser($stranger)->create(), 'stranger@example.test'),
        ];

        $this->signIn($this->agent);

        $this->assertSame([$mine->uuid], array_column($this->getJson('/email/review')->json('items'), 'id'));

        foreach ($theirs as $copy) {
            $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
            $this->getJson("/email/review/{$copy->uuid}")->assertStatus(404);
        }

        // A colleague in the same company gets nothing of mine either.
        $this->signIn($colleague);

        $this->getJson("/email/review/{$mine->uuid}")->assertStatus(404);
        $this->assertNotContains($mine->uuid, array_column($this->getJson('/email/review')->json('items'), 'id'));

        $this->getJson('/email/review/'.Str::uuid())->assertStatus(404);
        $this->getJson('/email/review/'.$mine->id)->assertStatus(404);
    }

    public function test_access_conflict_says_a_record_exists_and_nothing_about_it(): void
    {
        $colleague = $this->makeEmailUser($this->company);
        $lead = $this->makeEmailLead($this->company, 'theirs@example.test', [
            'lead_owner' => $colleague->id,
            'client_name' => 'Confidential Buyer',
        ]);

        $conflict = $this->ingest($this->connection, 'theirs@example.test');
        $unknown = $this->ingest($this->connection, 'nobody@example.test');
        $this->signIn($this->agent);

        $response = $this->getJson('/email/review')->assertOk();
        $items = collect($response->json('items'))->keyBy('id');

        $this->assertTrue($items[$conflict->uuid]['record_exists']);
        $this->assertFalse($items[$unknown->uuid]['record_exists']);
        $this->assertSame(array_keys($items[$unknown->uuid]), array_keys($items[$conflict->uuid]));
        $this->assertStringNotContainsString('Confidential Buyer', $response->getContent());
        $this->assertStringNotContainsString('lead', strtolower(implode(',', array_keys($items[$conflict->uuid]))));

        $show = $this->getJson("/email/review/{$conflict->uuid}")->assertOk()->assertJsonPath('item.record_exists', true);

        $this->assertStringNotContainsString('Confidential Buyer', $show->getContent());
        $this->assertArrayNotHasKey('lead_id', $show->json('item'));
        $this->assertNotNull($lead->id);
    }

    public function test_review_sits_behind_the_flag_auth_and_the_pilot_allowlist(): void
    {
        $copy = $this->ingest($this->connection, 'stranger@example.test');
        $uris = ['/email/review', "/email/review/{$copy->uuid}"];

        foreach ($uris as $uri) {
            $this->getJson($uri)->assertStatus(401);
        }

        $outsider = $this->makeEmailUser();
        $this->signIn($outsider);

        foreach ($uris as $uri) {
            $this->getJson($uri)->assertStatus(403);
        }

        $this->signIn($this->agent);
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        foreach ($uris as $uri) {
            $this->getJson($uri)->assertStatus(404);
        }
    }

    /**
     * @param  array<string, mixed>  $with
     */
    private function ingest(EmailConnection $connection, string $from, array $with = []): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($from),
            to: [$connection->identity_email],
            cc: $with['cc'] ?? [],
            sentAt: new DateTimeImmutable('2026-10-01T09:30:00+00:00'),
            subject: $with['subject'] ?? 'Hello',
            textBody: array_key_exists('textBody', $with) ? $with['textBody'] : 'Plain text body.',
            htmlRaw: $with['htmlRaw'] ?? null,
            rfcMessageId: '<'.Str::random(12).'@mail.test>',
            folder: 'INBOX',
        ));
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }

    /** Stands in for the user's permission rows, which live in tables this schema does not build. */
    private function grantViewLead(User $user, string $scope): void
    {
        $this->app->instance('user.permission-map.'.$user->id, ['view_lead' => $scope]);
    }
}
