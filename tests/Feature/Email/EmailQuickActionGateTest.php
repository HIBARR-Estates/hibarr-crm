<?php

namespace Tests\Feature\Email;

use App\Email\EmailFeature;
use App\Email\Models\EmailConnection;
use App\Email\Models\EmailPilotAllowlistEntry;
use Tests\Concerns\BuildsEmailSchema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class EmailQuickActionGateTest extends TestCase
{
    use BuildsEmailSchema;
    use SetsFeatureFlags;

    protected function setUp(): void
    {
        parent::setUp();

        $this->buildEmailSchema();
    }

    public function test_flag_off_hides_quick_action_even_when_allowlisted_with_connection(): void
    {
        $agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();
        EmailConnection::factory()->forUser($agent)->create();
        $this->setFeatureFlag(EmailFeature::FLAG, false);

        $this->assertNull(EmailFeature::quickActionFor($agent));
    }

    public function test_not_allowlisted_hides_quick_action_when_flag_on(): void
    {
        $agent = $this->makeEmailUser();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->assertNull(EmailFeature::quickActionFor($agent));
    }

    public function test_allowlisted_without_connection_exposes_connect_cta_gate(): void
    {
        $agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->assertSame(
            ['has_connection' => false],
            EmailFeature::quickActionFor($agent),
        );
    }

    public function test_allowlisted_with_connection_exposes_composer_gate(): void
    {
        $agent = $this->makeEmailUser();
        EmailPilotAllowlistEntry::factory()->forUser($agent)->create();
        EmailConnection::factory()->forUser($agent)->create();
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->assertSame(
            ['has_connection' => true],
            EmailFeature::quickActionFor($agent),
        );
    }

    public function test_null_user_hides_quick_action(): void
    {
        $this->setFeatureFlag(EmailFeature::FLAG, true);

        $this->assertNull(EmailFeature::quickActionFor(null));
    }

}
