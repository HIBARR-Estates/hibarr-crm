<?php

namespace Tests\Feature\Email;

use App\Email\Adapters\FakeMailAdapter;
use App\Email\EmailFeature;
use App\Email\Enums\SendAttemptStatus;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Email\Models\EmailSendAttempt;
use App\Enums\LeadContactMethodType;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class KnownRecipientsTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private FakeMailAdapter $fake;

    private Company $company;

    private User $agent;

    private EmailConnection $connection;

    private Lead $lead;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->fake = app(FakeMailAdapter::class);
        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        $this->connection = EmailConnection::factory()->forUser($this->agent)->create([
            'identity_email' => 'anna@agency.test',
            'from_email' => 'anna@agency.test',
        ]);
        $this->lead = $this->makeEmailLead($this->company, 'primary@example.test');

        DB::table('lead_contact_methods')->insert([
            'lead_id' => $this->lead->id,
            'company_id' => $this->company->id,
            'type' => LeadContactMethodType::Email->value,
            'identifier' => 'Spouse <secondary@example.test>',
            'normalized' => 'secondary@example.test',
            'is_main' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();
        $this->app->instance('user.permission-map.'.$this->agent->id, [
            'view_lead' => 'all',
            'view_deals' => 'all',
        ]);
    }

    public function test_timeline_lists_the_leads_known_addresses(): void
    {
        $this->signIn($this->agent);

        $this->getJson("/email/records/lead/{$this->lead->id}/timeline")
            ->assertOk()
            ->assertJsonPath('addresses.0.address', 'primary@example.test')
            ->assertJsonPath('addresses.1.address', 'secondary@example.test')
            ->assertJsonCount(2, 'addresses');
    }

    public function test_a_deal_uses_its_leads_addresses(): void
    {
        $deal = $this->makeEmailDeal($this->company, $this->lead);
        $this->signIn($this->agent);

        $this->getJson("/email/records/deal/{$deal->id}/timeline")
            ->assertOk()
            ->assertJsonPath('addresses.0.address', 'primary@example.test')
            ->assertJsonPath('addresses.1.address', 'secondary@example.test');
    }

    public function test_an_unknown_address_is_rejected_and_the_draft_is_kept(): void
    {
        $this->signIn($this->agent);

        $this->postJson('/email/send', $this->payload([
            'to' => ['stranger@example.test'],
            'subject' => 'Outside the lead',
            'text_body' => 'Should stay a draft.',
        ]))
            ->assertOk()
            ->assertJsonPath('attempt.status', 'failed')
            ->assertJsonPath('attempt.error_code', 'validation_unknown_recipient')
            ->assertJsonPath('attempt.draft.subject', 'Outside the lead')
            ->assertJsonPath('attempt.draft.text_body', 'Should stay a draft.');

        $attempt = EmailSendAttempt::withoutGlobalScopes()->sole();

        $this->assertSame(SendAttemptStatus::Failed, $attempt->status);
        $this->assertSame('Should stay a draft.', $attempt->draft()->textBody);
        $this->assertSame([], $this->fake->sendCalls($this->connection->uuid));
    }

    public function test_a_known_address_can_be_sent(): void
    {
        $this->signIn($this->agent);

        $this->postJson('/email/send', $this->payload([
            'to' => ['secondary@example.test'],
            'cc' => ['primary@example.test'],
        ]))->assertStatus(201)
            ->assertJsonPath('attempt.status', 'sent');

        $this->assertCount(1, $this->fake->sendCalls($this->connection->uuid));
    }

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return array_merge([
            'connection_id' => $this->connection->uuid,
            'to' => ['primary@example.test'],
            'cc' => [],
            'subject' => 'Hello',
            'text_body' => 'Body',
            'include_signature' => false,
            'record_type' => 'lead',
            'record_id' => $this->lead->id,
        ], $overrides);
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
