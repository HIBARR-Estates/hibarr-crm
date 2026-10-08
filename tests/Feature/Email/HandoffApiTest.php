<?php

namespace Tests\Feature\Email;

use App\Email\Data\EmailAddress;
use App\Email\Data\MessageDirection;
use App\Email\Data\NormalizedMessage;
use App\Email\EmailFeature;
use App\Email\Enums\HandoffStatus;
use App\Email\Enums\LinkAuditAction;
use App\Email\Enums\ReviewStatus;
use App\Email\Ingest\MessageIngestor;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailHandoff;
use App\Email\Models\EmailLinkAudit;
use App\Email\Models\EmailMailboxCopy;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use DateTimeImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class HandoffApiTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $anna;

    private User $ben;

    private EmailConnection $annasMailbox;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        $this->anna = $this->makeEmailUser($this->company);
        $this->ben = $this->makeEmailUser($this->company);
        $this->annasMailbox = EmailConnection::factory()->forUser($this->anna)->create();

        EmailPilotAllowlistEntry::factory()->forCompany($this->company->id)->create();
        $this->grant($this->anna, ['view_lead' => 'owned', 'add_lead' => 'all']);
        $this->grant($this->ben, ['view_lead' => 'owned', 'add_lead' => 'all']);
    }

    public function test_handoff_does_not_change_lead_owner(): void
    {
        $owner = $this->makeEmailUser($this->company);
        $lead = $this->makeEmailLead($this->company, 'buyer@example.test', [
            'client_name' => 'Buyer Person',
            'lead_owner' => $owner->id,
        ]);
        $copy = $this->ingest($this->annasMailbox, 'buyer@example.test');
        $this->signIn($this->anna);

        $this->postJson("/email/copies/{$copy->uuid}/handoff", [
            'to_user_id' => $this->ben->id,
            'note' => 'Please take a look',
        ])->assertStatus(201)
            ->assertJsonPath('handoff.status', 'pending')
            ->assertJsonPath('handoff.type', 'handoff')
            ->assertJsonPath('copy.review_status', 'handed_off');

        $this->assertSame((int) $owner->id, (int) Lead::withoutGlobalScopes()->findOrFail($lead->id)->lead_owner);
        $this->assertSame(ReviewStatus::HandedOff, $copy->fresh()->review_status);
        $this->assertSame(
            (int) $this->annasMailbox->id,
            (int) $copy->fresh()->connection_id,
        );

        // Pending remains visible to the sender.
        $this->assertContains(
            $copy->uuid,
            array_column($this->getJson('/email/review')->json('items'), 'id'),
        );

        $audit = EmailLinkAudit::withoutGlobalScopes()->where('action', LinkAuditAction::Handoff)->sole();
        $this->assertSame($copy->id, (int) $audit->mailbox_copy_id);
        $this->assertSame((int) $this->anna->id, (int) $audit->actor_id);
        $this->assertSame($this->ben->id, $audit->meta['to_user_id']);
    }

    public function test_reject_leaves_copy_with_sender(): void
    {
        $copy = $this->ingest($this->annasMailbox, 'stranger@example.test');
        $this->signIn($this->anna);

        $handoffId = $this->postJson("/email/copies/{$copy->uuid}/handoff", [
            'to_user_id' => $this->ben->id,
        ])->assertStatus(201)->json('handoff.id');

        $this->signIn($this->ben);

        $incoming = $this->getJson('/email/handoffs/incoming')->assertOk()->json('items');
        $this->assertSame([$handoffId], array_column($incoming, 'id'));
        $this->assertNull($incoming[0]['preview']);
        $this->assertArrayNotHasKey('body', $incoming[0]);
        $this->assertArrayNotHasKey('text_body', $incoming[0]);

        $this->postJson("/email/handoffs/{$handoffId}/reject")->assertOk()
            ->assertJsonPath('handoff.status', 'rejected');

        $copy = $copy->fresh();
        $this->assertSame(ReviewStatus::Unlinked, $copy->review_status);
        $this->assertSame((int) $this->annasMailbox->id, (int) $copy->connection_id);
        $this->assertSame((int) $this->anna->id, (int) $copy->connection->user_id);

        $this->signIn($this->anna);
        $this->assertContains(
            $copy->uuid,
            array_column($this->getJson('/email/review')->json('items'), 'id'),
        );

        $this->assertSame(
            HandoffStatus::Rejected,
            EmailHandoff::withoutGlobalScopes()->where('uuid', $handoffId)->sole()->status,
        );
        $this->assertTrue(
            EmailLinkAudit::withoutGlobalScopes()->where('action', LinkAuditAction::Reject)->exists(),
        );
    }

    public function test_accept_requires_access_and_does_not_change_lead_owner(): void
    {
        $owner = $this->makeEmailUser($this->company);
        $lead = $this->makeEmailLead($this->company, 'keep@example.test', [
            'lead_owner' => $owner->id,
        ]);
        $copy = $this->ingest($this->annasMailbox, 'keep@example.test');
        $this->signIn($this->anna);

        $handoffId = $this->postJson("/email/copies/{$copy->uuid}/escalate", [
            'to_user_id' => $this->ben->id,
        ])->assertStatus(201)->json('handoff.id');

        $this->assertSame(
            'escalate',
            EmailHandoff::withoutGlobalScopes()->where('uuid', $handoffId)->sole()->type->value,
        );

        // Partner cannot accept.
        $partner = $this->makeEmailUser($this->company);
        DB::table('lead_agents')->insert([
            'company_id' => $this->company->id,
            'user_id' => $partner->id,
            'is_partner' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
        $this->signIn($this->anna);
        $this->postJson("/email/copies/{$this->ingest($this->annasMailbox, 'other@example.test')->uuid}/handoff", [
            'to_user_id' => $partner->id,
        ])->assertStatus(403)->assertJsonPath('message', 'recipient_cannot_accept');

        $this->signIn($this->ben);
        $this->postJson("/email/handoffs/{$handoffId}/accept")->assertOk()
            ->assertJsonPath('handoff.status', 'accepted');

        $this->assertSame((int) $owner->id, (int) Lead::withoutGlobalScopes()->findOrFail($lead->id)->lead_owner);
        $this->assertSame(ReviewStatus::HandedOff, $copy->fresh()->review_status);
        $this->assertSame((int) $this->annasMailbox->id, (int) $copy->fresh()->connection_id);

        // Resolved handoff leaves the sender's active review (pending no longer).
        $this->signIn($this->anna);
        $this->assertNotContains(
            $copy->uuid,
            array_column($this->getJson('/email/review')->json('items'), 'id'),
        );
    }

    public function test_another_users_handoff_cannot_be_accepted_or_rejected(): void
    {
        $copy = $this->ingest($this->annasMailbox, 'stranger@example.test');
        $this->signIn($this->anna);
        $handoffId = $this->postJson("/email/copies/{$copy->uuid}/handoff", [
            'to_user_id' => $this->ben->id,
        ])->json('handoff.id');

        $outsider = $this->makeEmailUser($this->company);
        $this->signIn($outsider);

        $this->postJson("/email/handoffs/{$handoffId}/accept")->assertStatus(404);
        $this->postJson("/email/handoffs/{$handoffId}/reject")->assertStatus(404);
        $this->assertSame(
            HandoffStatus::Pending,
            EmailHandoff::withoutGlobalScopes()->where('uuid', $handoffId)->sole()->status,
        );
    }

    public function test_handoff_sits_behind_the_flag_auth_and_the_pilot_allowlist(): void
    {
        $copy = $this->ingest($this->annasMailbox, 'stranger@example.test');
        $uris = [
            ["/email/copies/{$copy->uuid}/handoff", ['to_user_id' => $this->ben->id]],
            ['/email/handoffs/incoming', null],
        ];

        foreach ($uris as [$uri, $payload]) {
            if ($payload === null) {
                $this->getJson($uri)->assertStatus(401);
            } else {
                $this->postJson($uri, $payload)->assertStatus(401);
            }
        }

        $outsider = $this->makeEmailUser();
        $this->signIn($outsider);
        $this->getJson('/email/handoffs/incoming')->assertStatus(403);

        $this->signIn($this->anna);
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->postJson("/email/copies/{$copy->uuid}/handoff", ['to_user_id' => $this->ben->id])->assertStatus(404);
        $this->getJson('/email/handoffs/incoming')->assertStatus(404);
    }

    private function ingest(EmailConnection $connection, string $from): EmailMailboxCopy
    {
        return app(MessageIngestor::class)->ingestNormalized($connection, new NormalizedMessage(
            providerMessageId: 'prov-'.Str::random(10),
            direction: MessageDirection::Inbound,
            from: EmailAddress::tryParse($from),
            to: [$connection->identity_email],
            sentAt: new DateTimeImmutable('2026-10-01T09:30:00+00:00'),
            subject: 'Hello',
            textBody: 'Plain text body.',
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
