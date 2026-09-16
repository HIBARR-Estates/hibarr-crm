<?php

namespace Tests\Feature;

use App\Http\Middleware\EnsureUserIsAdmin;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Route as RoutingRoute;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Route;
use Mockery;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\MethodNotAllowedHttpException;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use Tests\TestCase;

class FroidenEnvatoRoutesTest extends TestCase
{
    private const PACKAGE_ROUTE_NAMES = [
        'verify-purchase',
        'purchase-verified',
        'admin.updateVersion.update',
        'admin.updateVersion.download',
        'admin.updateVersion.downloadPercent',
        'admin.updateVersion.checkIfFileExtracted',
        'admin.updateVersion.install',
        'admin.updateVersion.checkSupport',
        'admin.updateVersion.refresh',
        'admin.updateVersion.notify',
    ];

    public function test_package_route_file_endpoints_are_not_routed_to_the_package(): void
    {
        foreach (['update-database', 'clear-cache', 'refresh-cache', 'down/secret', 'up/secret', 'hide-review-modal/later'] as $uri) {
            $route = $this->matchRoute('GET', $uri);

            $this->assertFalse(
                $route !== null && str_starts_with($route->getActionName(), 'Froiden\\Envato\\'),
                "GET /{$uri} is still routed to froiden/envato."
            );
        }
    }

    public function test_only_the_expected_package_routes_are_registered_and_all_are_admin_only(): void
    {
        $packageRoutes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn (RoutingRoute $route) => str_starts_with($route->getActionName(), 'Froiden\\Envato\\'));

        $this->assertEqualsCanonicalizing(
            self::PACKAGE_ROUTE_NAMES,
            $packageRoutes->map(fn (RoutingRoute $route) => $route->getName())->values()->all()
        );

        foreach ($packageRoutes as $route) {
            $this->assertContains('auth', $route->middleware(), "Route [{$route->getName()}] is missing auth.");
            $this->assertContains(EnsureUserIsAdmin::class, $route->middleware(), "Route [{$route->getName()}] is missing the admin check.");
        }
    }

    public function test_package_services_other_than_routes_are_still_registered(): void
    {
        $this->assertArrayHasKey('migrate:check', Artisan::all());
        $this->assertSame(['widget_code'], config('froiden_envato.xss_ignore_index'));
    }

    public function test_admin_middleware_allows_admins(): void
    {
        session(['user' => $this->userWithAdminRole(true)]);

        $response = (new EnsureUserIsAdmin())->handle(Request::create('/verify-purchase'), fn () => response('ok'));

        $this->assertSame('ok', $response->getContent());
    }

    public function test_admin_middleware_rejects_non_admins(): void
    {
        session(['user' => $this->userWithAdminRole(false)]);

        $this->assertForbidden();
    }

    public function test_admin_middleware_rejects_guests(): void
    {
        session()->forget('user');

        $this->assertForbidden();
    }

    private function assertForbidden(): void
    {
        try {
            (new EnsureUserIsAdmin())->handle(Request::create('/verify-purchase'), fn () => response('ok'));
        } catch (HttpException $e) {
            $this->assertSame(403, $e->getStatusCode());

            return;
        }

        $this->fail('Expected the admin middleware to abort with 403.');
    }

    private function userWithAdminRole(bool $isAdmin): User
    {
        $user = Mockery::mock(User::class);
        $user->shouldReceive('hasRole')->with('admin')->andReturn($isAdmin);

        return $user;
    }

    private function matchRoute(string $method, string $uri): ?RoutingRoute
    {
        try {
            return Route::getRoutes()->match(Request::create('/' . $uri, $method));
        } catch (NotFoundHttpException|MethodNotAllowedHttpException) {
            return null;
        }
    }
}
