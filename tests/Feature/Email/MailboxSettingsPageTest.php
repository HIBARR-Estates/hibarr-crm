<?php

namespace Tests\Feature\Email;

use App\Email\EmailFeature;
use App\Email\Models\EmailPilotAllowlistEntry;
use App\Http\Middleware\HandleInertiaRequests;
use App\Models\Company;
use App\Models\User;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class MailboxSettingsPageTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    private Company $company;

    private User $agent;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->company = $this->makeEmailCompany();
        $this->agent = $this->makeEmailUser($this->company);
        EmailPilotAllowlistEntry::factory()->forUser($this->agent)->create();

        $this->withoutMiddleware(HandleInertiaRequests::class);
    }

    public function test_allowlisted_agent_gets_the_mailbox_settings_page(): void
    {
        $this->signIn($this->agent);

        $this->get('/account/settings/mailbox', $this->inertia())
            ->assertOk()
            ->assertJsonPath('component', 'Settings/Mailbox');
    }

    public function test_flag_off_answers_404(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, false);
        $this->signIn($this->agent);

        $this->get('/account/settings/mailbox')->assertStatus(404);
    }

    public function test_non_allowlisted_user_answers_403(): void
    {
        $outsider = $this->makeEmailUser($this->company);
        $this->signIn($outsider);

        $this->get('/account/settings/mailbox')->assertStatus(403);
    }

    /** @return array<string, string> */
    private function inertia(): array
    {
        return ['X-Inertia' => 'true', 'Accept' => 'text/html, application/xhtml+xml'];
    }

    private function signIn(User $user): void
    {
        cache()->forever('user_is_active_'.$user->id, true);
        session()->forget('user');

        $this->actingAs($user);
    }
}
