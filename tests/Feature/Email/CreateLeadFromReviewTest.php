<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Linking\RecordFeed;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailMessage;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailRecordLink;
use App\Email\Review\LeadCreator;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class CreateLeadFromReviewTest extends TestCase
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
        $this->anna = $this->makeEmailUser($this->company);
        $this->ben = $this->makeEmailUser($this->company);
        $this->annasMailbox = EmailConnection::factory()->forUser($this->anna)->create();
        $this->bensMailbox = EmailConnection::factory()->forUser($this->ben)->create();

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();
        $this->grant($this->anna, ['view_lead' => 'all', 'add_lead' => 'all']);
        $this->grant($this->ben, ['view_lead' => 'all', 'add_lead' => 'added']);

        // The lead observers need the full CRM schema, which these tests do not build.
        $this->app->bind(LeadCreator::class, fn () => new class extends LeadCreator
        {
            public function create(User $owner, string $email, string $name): Lead
            {
                return Lead::withoutEvents(fn () => parent::create($owner, $email, $name));
            }
        });
    }

    public function test_create_lead_makes_a_lead_for_the_sender_and_links_the_conversation(): void
    {
        $copy = $this->ingest($this->annasMailbox, 'New Customer <New.Customer@Example.test>');
        $this->signIn($this->anna);

        $response = $this->postJson("/email/copies/{$copy->uuid}/create-lead")->assertStatus(201);

        $lead = DB::table('leads')->sole();

        $response->assertExactJson([
            'copy' => ['id' => $copy->uuid, 'review_status' => 'none', 'linked' => true],
            'record' => ['record_type' => 'lead', 'record_id' => $lead->id],
        ]);

        $this->assertSame('new.customer@example.test', $lead->client_email);
        $this->assertSame('New Customer', $lead->client_name);
        $this->assertSame((int) $this->company->id, (int) $lead->company_id);
        $this->assertSame((int) $this->anna->id, (int) $lead->lead_owner);
        $this->assertSame((int) $this->anna->id, (int) $lead->added_by);

        $this->assertSame(
            [$copy->message_id],
            app(RecordFeed::class)->messages(Lead::withoutGlobalScopes()->findOrFail($lead->id))->pluck('id')->all(),
        );

        // Asking again for mail that is already on a record creates nothing.
        $this->postJson("/email/copies/{$copy->uuid}/create-lead")->assertStatus(409)->assertJsonPath('message', 'already_linked');
        $this->assertSame(1, DB::table('leads')->count());
    }

    public function test_duplicate_email_rejects_the_second_create_and_keeps_both_copies(): void
    {
        $annasCopy = $this->ingest($this->annasMailbox, 'customer@example.test', '<shared@mail.test>');
        $bensCopy = $this->ingest($this->bensMailbox, 'customer@example.test', '<shared@mail.test>');

        $this->signIn($this->anna);
        $this->postJson("/email/copies/{$annasCopy->uuid}/create-lead", ['client_name' => 'Customer Person'])->assertStatus(201);

        $leadId = DB::table('leads')->sole()->id;

        $this->signIn($this->ben);
        $this->postJson("/email/copies/{$bensCopy->uuid}/create-lead")
            ->assertStatus(409)
            ->assertExactJson([
                'message' => 'duplicate_lead',
                'record_exists' => true,
                'candidates' => [['record_type' => 'lead', 'record_id' => $leadId]],
            ]);

        // No second lead, and neither copy was lost or changed by the refusal.
        $this->assertSame(1, DB::table('leads')->count());
        $this->assertSame(2, EmailMailboxCopy::withoutGlobalScopes()->count());
        $this->assertSame(1, EmailMessage::withoutGlobalScopes()->count());
        $this->assertSame(ReviewStatus::None, $annasCopy->fresh()->review_status);
        $this->assertSame(ReviewStatus::Unlinked, $bensCopy->fresh()->review_status);
        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());

        // Reconciliation: Ben links his copy to the lead that already exists.
        $this->postJson("/email/copies/{$bensCopy->uuid}/link", ['record_type' => 'lead', 'record_id' => $leadId])
            ->assertOk()
            ->assertJsonPath('copy.linked', true);

        $this->assertSame(ReviewStatus::None, $bensCopy->fresh()->review_status);
        $this->assertSame(1, EmailRecordLink::withoutGlobalScopes()->count());
    }

    public function test_a_duplicate_the_user_may_not_see_is_reported_without_naming_it(): void
    {
        $this->makeEmailLead($this->company, 'customer@example.test', ['lead_owner' => $this->anna->id, 'client_name' => 'Confidential Buyer']);
        $this->grant($this->ben, ['view_lead' => 'owned', 'add_lead' => 'added']);

        $copy = $this->ingest($this->bensMailbox, 'customer@example.test');
        $this->signIn($this->ben);

        $response = $this->postJson("/email/copies/{$copy->uuid}/create-lead")
            ->assertStatus(409)
            ->assertExactJson(['message' => 'duplicate_lead', 'record_exists' => true, 'candidates' => []]);

        $this->assertStringNotContainsString('Confidential Buyer', $response->getContent());
        $this->assertSame(1, DB::table('leads')->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    public function test_create_lead_needs_permission_an_own_copy_and_a_single_other_party(): void
    {
        $copy = $this->ingest($this->annasMailbox, 'customer@example.test');
        $toTwoPeople = app(MessageIngestor::class)->ingestNormalized($this->annasMailbox, new NormalizedMessage(
            providerMessageId: 'prov-sent',
            direction: MessageDirection::Outbound,
            from: new EmailAddress($this->annasMailbox->identity_email),
            to: ['one@example.test', 'two@example.test'],
            subject: 'Hello',
            textBody: 'Hello',
            rfcMessageId: '<sent@mail.test>',
            folder: 'Sent',
        ));

        // Someone else's copy is not found.
        $this->signIn($this->ben);
        $this->postJson("/email/copies/{$copy->uuid}/create-lead")->assertStatus(404);

        $this->signIn($this->anna);
        $this->postJson("/email/copies/{$toTwoPeople->uuid}/create-lead")->assertStatus(409)->assertJsonPath('message', 'no_single_address');

        $this->grant($this->anna, ['view_lead' => 'all', 'add_lead' => 'none']);
        $this->postJson("/email/copies/{$copy->uuid}/create-lead")->assertStatus(403);

        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->postJson("/email/copies/{$copy->uuid}/create-lead")->assertStatus(404);

        $this->assertSame(0, DB::table('leads')->count());
        $this->assertSame(ReviewStatus::Unlinked, $copy->fresh()->review_status);
    }

    private function ingest(EmailConnection $connection, string $from, ?string $rfcMessageId = null): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($from),
            to: [$this->annasMailbox->identity_email, $this->bensMailbox->identity_email],
            subject: 'Hello',
            textBody: 'Plain text body.',
            rfcMessageId: $rfcMessageId ?? '<'.Str::random(12).'@mail.test>',
            folder: 'INBOX',
        ));
    }

    private function signIn(User $user): void
    {
        // The auth middleware's active-user lookup needs columns the hand-built users table lacks.
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');
        session()->forget('company');

        $this->actingAs($user);
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
}
