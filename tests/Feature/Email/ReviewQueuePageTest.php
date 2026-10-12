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
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Company;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class ReviewQueuePageTest extends TestCase
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
        $this->grant($this->agent, ['view_lead' => 'owned', 'add_lead' => 'all']);

        // Shared Inertia props (roles, modules, …) need the full CRM schema.
        // Page props from ReviewController still resolve without that middleware.
        $this->withoutMiddleware(HandleInertiaRequests::class);
    }

    public function test_owner_gets_the_inertia_review_queue_page(): void
    {
        $copy = $this->ingest($this->connection, 'Stranger <stranger@example.test>', [
            'subject' => 'Villa viewing',
            'textBody' => 'See you Friday.',
        ]);
        $this->signIn($this->agent);

        $inertia = ['X-Inertia' => 'true', 'Accept' => 'text/html, application/xhtml+xml'];

        $this->get('/email/review', $inertia)
            ->assertOk()
            ->assertJsonPath('component', 'Email/ReviewQueue')
            ->assertJsonPath('props.items.0.id', $copy->uuid)
            ->assertJsonPath('props.items.0.subject', 'Villa viewing')
            ->assertJsonPath('props.items.0.preview', 'See you Friday.')
            ->assertJsonPath('props.canCreateLead', true)
            ->assertJsonPath('props.focusId', null);

        // JSON callers keep the E-15 API shape.
        $json = $this->getJson('/email/review')->assertOk();
        $json->assertJsonPath('items.0.id', $copy->uuid);
        $this->assertArrayNotHasKey('component', $json->json());
    }

    public function test_direct_url_to_another_users_item_is_not_found(): void
    {
        $colleague = $this->makeEmailUser($this->company);
        $theirs = $this->ingest(
            EmailConnection::factory()->forUser($colleague)->create(),
            'stranger@example.test',
        );
        $mine = $this->ingest($this->connection, 'mine@example.test');
        $this->signIn($this->agent);

        $inertia = ['X-Inertia' => 'true', 'Accept' => 'text/html, application/xhtml+xml'];

        // Direct URL — never opens someone else's review item.
        $this->get("/email/review/{$theirs->uuid}")->assertStatus(404);
        $this->getJson("/email/review/{$theirs->uuid}")->assertStatus(404);
        $this->get("/email/review/{$theirs->uuid}", $inertia)->assertStatus(404);

        $this->get("/email/review/{$mine->uuid}", $inertia)
            ->assertOk()
            ->assertJsonPath('component', 'Email/ReviewQueue')
            ->assertJsonPath('props.focusId', $mine->uuid)
            ->assertJsonPath('props.items.0.id', $mine->uuid);
    }

    public function test_candidates_only_return_leads_the_owner_may_see(): void
    {
        $colleague = $this->makeEmailUser($this->company);
        $visible = $this->makeEmailLead($this->company, 'visible@example.test', [
            'client_name' => 'Visible Buyer',
            'lead_owner' => $this->agent->id,
        ]);
        $hidden = $this->makeEmailLead($this->company, 'hidden@example.test', [
            'client_name' => 'Hidden Buyer',
            'lead_owner' => $colleague->id,
        ]);
        $this->signIn($this->agent);

        $response = $this->getJson('/email/review/candidates?q=Buyer')->assertOk();
        $ids = array_column($response->json('items'), 'record_id');

        $this->assertSame([$visible->id], $ids);
        $this->assertNotContains($hidden->id, $ids);
        $this->assertStringNotContainsString('Hidden Buyer', $response->getContent());
    }

    public function test_review_page_sits_behind_the_flag_auth_and_the_pilot_allowlist(): void
    {
        $copy = $this->ingest($this->connection, 'stranger@example.test');
        $uris = ['/email/review', "/email/review/{$copy->uuid}", '/email/review/candidates?q=ab'];

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
            $this->get(strtok($uri, '?'))->assertStatus(404);
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
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }

    /**
     * @param  array<string, string>  $permissions
     */
    private function grant(User $user, array $permissions): void
    {
        $this->app->instance('user.permission-map.'.$user->id, $permissions);
    }
}
