<?php

namespace Tests\Unit\Support;

use App\Support\DemoSeeding;
use Illuminate\Support\Facades\Config;
use Tests\TestCase;

class DemoSeedingTest extends TestCase
{

    protected function setUp(): void
    {
        parent::setUp();

        DemoSeeding::forget();
        Config::set('app.seed_user_password', null);
        Config::set('app.seed_demo_data', false);
    }

    protected function tearDown(): void
    {
        DemoSeeding::forget();

        parent::tearDown();
    }

    public function test_demo_data_does_not_seed_in_production(): void
    {
        $this->app->detectEnvironment(fn () => 'production');

        $this->assertFalse(DemoSeeding::enabled());
    }

    public function test_production_can_opt_in_explicitly(): void
    {
        $this->app->detectEnvironment(fn () => 'production');
        Config::set('app.seed_demo_data', true);

        $this->assertTrue(DemoSeeding::enabled());
    }

    public function test_demo_data_seeds_outside_production(): void
    {
        $this->app->detectEnvironment(fn () => 'local');

        $this->assertTrue(DemoSeeding::enabled());
    }

    public function test_codecanyon_never_seeds_demo_data(): void
    {
        $this->app->detectEnvironment(fn () => 'codecanyon');

        $this->assertFalse(DemoSeeding::enabled());
    }

    public function test_the_configured_password_is_used_when_set(): void
    {
        Config::set('app.seed_user_password', 'a-configured-password');

        $this->assertSame('a-configured-password', DemoSeeding::password());
        $this->assertFalse(DemoSeeding::passwordWasGenerated());
    }

    public function test_an_unset_password_is_generated_once_and_is_not_guessable(): void
    {
        $password = DemoSeeding::password();

        $this->assertTrue(DemoSeeding::passwordWasGenerated());
        $this->assertNotSame('123456', $password);
        $this->assertGreaterThanOrEqual(20, strlen($password));
        $this->assertSame($password, DemoSeeding::password());
    }

}
