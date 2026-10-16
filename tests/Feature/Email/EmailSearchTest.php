<?php

namespace Tests\Feature\Email;

use App\Email\Data\AttachmentRef;
use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\ConversationLinker;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailSearchTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $owner;

    private User $leadOwner;

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

        $this->owner = $this->user(['view_lead' => 'all']);
        $this->leadOwner = $this->user(['view_lead' => 'owned']);
        $this->manager = $this->user(['view_lead' => 'all', 'view_deals' => 'all']);
        $this->mailbox = EmailConnection::factory()->forUser($this->owner)->create();

        $lead = $this->makeEmailLead($this->company, null, ['lead_owner' => $this->leadOwner->id]);
        $this->lead = Lead::withoutGlobalScopes()->findOrFail($lead->id);
    }

    public function test_record_search_matches_participants_subject_body_and_file_names(): void
    {
        $offer = $this->onLead($this->ingest($this->mailbox, [
            'from' => 'Maria Schmidt <maria@example.test>',
            'cc' => ['Notary Office <notary@example.test>'],
            'subject' => 'Kyrenia villa offer',
            'text' => 'We would like to proceed. The deposit of 15% can be wired on Monday morning.',
            'attachments' => [new AttachmentRef('part-1', 'Floorplan_Villa.pdf', 'application/pdf', 100)],
        ]));
        $this->onLead($this->ingest($this->mailbox, [
            'from' => 'other@example.test',
            'subject' => 'Lunch',
            'text' => 'Nothing to see here.',
        ]));
        $htmlOnly = $this->onLead($this->ingest($this->mailbox, [
            'from' => 'other@example.test',
            'subject' => 'Newsletter',
            'text' => null,
            'html' => '<div class="deposit"><p>Our <b>seaside</b> apartments</p></div>',
        ]));

        $this->signIn($this->owner);

        foreach (['schmidt', 'MARIA@example', 'notary', 'kyrenia', 'deposit of 15%', 'floorplan'] as $term) {
            $response = $this->getJson($this->searchUri($term))->assertOk();

            $this->assertSame([$offer->message->uuid], array_column($response->json('events'), 'id'), $term);
        }

        // The snippet is the text around the match, not the whole body.
        $this->getJson($this->searchUri('wired'))
            ->assertOk()
            ->assertJsonPath('events.0.snippet', 'We would like to proceed. The deposit of 15% can be wired on Monday morning.');

        // HTML-only mail is found by its words, never by its markup.
        $this->assertSame([$htmlOnly->message->uuid], array_column($this->getJson($this->searchUri('seaside'))->json('events'), 'id'));
        $this->assertSame([], $this->getJson($this->searchUri('class='))->json('events'));

        // Wildcards are searched for literally.
        $this->assertSame([$offer->message->uuid], array_column($this->getJson($this->searchUri('15%'))->json('events'), 'id'));
        $this->assertSame([], $this->getJson($this->searchUri('1_%'))->json('events'));
        $this->assertSame([], $this->getJson($this->searchUri('zzzz'))->json('events'));

        $this->getJson($this->searchUri('a'))->assertStatus(422);
        $this->getJson("/email/records/lead/{$this->lead->id}/search")->assertStatus(422);
    }

    public function test_an_unauthorized_user_gets_no_result_and_no_snippet(): void
    {
        $secret = 'The deposit of 15% can be wired on Monday morning.';
        $copy = $this->onLead($this->ingest($this->mailbox, ['subject' => 'Kyrenia villa offer', 'text' => $secret]));

        // The lead's owner may read linked mail, so they find it.
        $this->signIn($this->leadOwner);
        $this->getJson($this->searchUri('deposit'))->assertOk()->assertJsonPath('events.0.snippet', $secret);

        // A manager sees the lead but has no communications access: nothing comes back, snippet included.
        $this->signIn($this->manager);

        foreach (['deposit', 'kyrenia', 'wired'] as $term) {
            $response = $this->getJson($this->searchUri($term))->assertOk();

            $response->assertExactJson([
                'events' => [],
                'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 50, 'total' => 0],
            ]);
            $this->assertStringNotContainsStringIgnoringCase('deposit', $response->getContent());
            $this->assertStringNotContainsStringIgnoringCase('kyrenia', $response->getContent());
        }

        // Someone who may not see the lead at all cannot search it.
        $this->signIn($this->user(['view_lead' => 'owned']));
        $this->getJson($this->searchUri('deposit'))->assertStatus(404);

        // Unlinked: the lead owner's search goes empty at once.
        app(ConversationLinker::class)->unlink($copy->message->conversation, $this->lead, $this->owner);

        $this->signIn($this->leadOwner);
        $response = $this->getJson($this->searchUri('deposit'))->assertOk()->assertJsonPath('meta.total', 0);
        $this->assertStringNotContainsString('wired', $response->getContent());

        $this->signIn($this->owner);
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->getJson($this->searchUri('deposit'))->assertStatus(404);
    }

    public function test_review_search_cannot_see_another_users_unlinked_body(): void
    {
        $colleague = $this->user(['view_lead' => 'all']);
        $theirMailbox = EmailConnection::factory()->forUser($colleague)->create();

        $mine = $this->ingest($this->mailbox, ['subject' => 'Viewing', 'text' => 'Can we visit the penthouse on Friday?']);
        $this->ingest($this->mailbox, ['subject' => 'Other', 'text' => 'Unrelated words.']);
        $theirs = $this->ingest($theirMailbox, ['subject' => 'Private', 'text' => 'The penthouse budget is confidential: 900k.']);

        $this->signIn($this->owner);

        $response = $this->getJson('/email/review?q=penthouse')->assertOk();

        $this->assertSame([$mine->uuid], array_column($response->json('items'), 'id'));
        $response->assertJsonPath('meta.total', 1)
            ->assertJsonPath('items.0.snippet', 'Can we visit the penthouse on Friday?');
        $this->assertStringNotContainsString('confidential', $response->getContent());
        $this->assertStringNotContainsString('900k', $response->getContent());

        // Words that exist only in the colleague's unlinked mail find nothing — for the owner or a manager.
        foreach ([$this->owner, $this->manager, $this->leadOwner] as $user) {
            $this->signIn($user);

            $this->getJson('/email/review?q=confidential')->assertOk()->assertExactJson([
                'items' => [],
                'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 25, 'total' => 0],
            ]);
        }

        // And the colleague finds their own, not mine.
        $this->signIn($colleague);

        $this->assertSame([$theirs->uuid], array_column($this->getJson('/email/review?q=penthouse')->json('items'), 'id'));

        // Without a term the review is the plain list, with no snippet field.
        $this->assertArrayNotHasKey('snippet', $this->getJson('/email/review')->json('items.0'));
        $this->getJson('/email/review?q=a')->assertStatus(422);
    }

    private function searchUri(string $term): string
    {
        return "/email/records/lead/{$this->lead->id}/search?q=".rawurlencode($term);
    }

    private function onLead(EmailMailboxCopy $copy): EmailMailboxCopy
    {
        app(ConversationLinker::class)->link($copy->message->conversation, $this->lead, $this->owner, $this->mailbox);

        return $copy;
    }

    /**
     * @param  array<string, mixed>  $with
     */
    private function ingest(EmailConnection $connection, array $with): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($with['from'] ?? 'stranger@example.test'),
            to: [$connection->identity_email],
            cc: $with['cc'] ?? [],
            subject: $with['subject'] ?? 'Hello',
            textBody: array_key_exists('text', $with) ? $with['text'] : 'Body.',
            htmlRaw: $with['html'] ?? null,
            attachments: $with['attachments'] ?? [],
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
