<?php

namespace Tests\Feature\Email;

use App\Email\EmailFeature;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Str;
use Tests\TestCase;

class EmailModuleSkeletonTest extends TestCase
{
    public function test_module_config_resolves(): void
    {
        $this->assertSame(EmailFeature::FLAG, config('email.flag'));
        $this->assertSame('email-sync', config('email.queues.sync'));
        $this->assertSame('email-send', config('email.queues.send'));
        $this->assertSame('fake', config('email.default_provider'));
    }

    public function test_module_config_leaves_notification_template_settings_intact(): void
    {
        $this->assertIsArray(config('email.plunk_template_ids'));
        $this->assertNotEmpty(config('email.logo.light'));
    }

    /** Fortify's account email-verification routes; not part of the Email module. */
    private const PRE_EXISTING_EMAIL_URIS = [
        'email/verify',
        'email/verify/{id}/{hash}',
        'email/verification-notification',
    ];

    public function test_module_registers_no_endpoints(): void
    {
        $offenders = collect(Route::getRoutes()->getRoutes())
            ->filter(function (RoutingRoute $route) {
                $uri = trim($route->uri(), '/');
                $action = (string) ($route->getAction('controller') ?? '');

                if (in_array($uri, self::PRE_EXISTING_EMAIL_URIS, true)) {
                    return false;
                }

                return $uri === 'email'
                    || Str::startsWith($uri, 'email/')
                    || Str::startsWith(ltrim($action, '\\'), 'App\\Email\\');
            })
            ->map(fn (RoutingRoute $route) => $route->uri())
            ->values()
            ->all();

        $this->assertSame([], $offenders);
    }
}
