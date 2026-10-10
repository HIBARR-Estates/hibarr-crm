<?php

namespace Tests\Feature\Partners;

use App\Http\Middleware\RestrictPartnerAccounts;
use App\Models\Role;
use App\Models\User;
use App\Support\PartnerRole;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

/**
 * A partner account must not reach the internal workspace, and ordinary staff
 * must be untouched. The section list is the user's: reports, projects,
 * properties, tasks — plus the rest of what the sidebar offers.
 */
class RestrictPartnerAccountsTest extends TestCase
{
    /** @return array<string, array{0: string}> */
    public static function blockedPaths(): array
    {
        return [
            'properties' => ['/account/properties'],
            'property detail' => ['/account/properties/12'],
            'developer projects' => ['/account/developer-projects'],
            'developers' => ['/account/developers'],
            'project locations' => ['/account/project-locations'],
            'projects' => ['/account/projects'],
            'tasks' => ['/account/tasks'],
            'task board' => ['/account/taskboards'],
            'agent reports' => ['/account/agent-reports'],
            'agent report export' => ['/account/agent-reports/leads'],
            'task report' => ['/account/task-report'],
            'sales report' => ['/account/sales-report'],
            'meetings' => ['/account/meetings'],
            'leads' => ['/account/lead-contact'],
            'deals' => ['/account/deals'],
            'offers' => ['/account/offers'],
        ];
    }

    /** @return array<string, array{0: string}> */
    public static function allowedPaths(): array
    {
        return [
            'dashboard' => ['/account/dashboard'],
            'dashboard v2' => ['/account/dashboard-v2'],
            'flag a referral' => ['/account/partner-flags'],
            'notifications' => ['/account/notifications'],
            'settings' => ['/account/settings/profile'],
            // Kept on purpose: partners keep the Affiliate workspace. What it
            // returns is redacted in MlmAgentController, not blocked here.
            // A partner's own leads view lives under /partner/, not /lead-contact/.
            'partner leads list' => ['/account/partner/leads'],
            'partner lead detail' => ['/account/partner/leads/12'],
            'affiliate dashboard' => ['/account/mlm/agent/dashboard'],
            'affiliate commissions' => ['/account/mlm/agent/api/commissions'],
            'affiliate deals api' => ['/account/mlm/agent/api/deals'],
            'outside account' => ['/login'],
        ];
    }

    /** @dataProvider blockedPaths */
    public function test_partner_is_redirected_home_from_internal_pages(string $path): void
    {
        $response = $this->run(['partner', 'employee'], 'GET', $path);

        $this->assertSame(302, $response->getStatusCode());
        $this->assertStringContainsString('view=partner', $response->headers->get('Location'));
    }

    /** @dataProvider blockedPaths */
    public function test_partner_gets_403_on_scripted_requests(string $path): void
    {
        $this->expectException(HttpException::class);

        $this->run(['partner', 'employee'], 'POST', $path);
    }

    public function test_partner_gets_403_on_json_gets(): void
    {
        $this->expectException(HttpException::class);

        $this->run(['partner', 'employee'], 'GET', '/account/properties', ['Accept' => 'application/json']);
    }

    /** @dataProvider allowedPaths */
    public function test_partner_can_reach_the_partner_surface(string $path): void
    {
        $response = $this->run(['partner', 'employee'], 'GET', $path);

        $this->assertSame(200, $response->getStatusCode());
    }

    /** @dataProvider blockedPaths */
    public function test_employee_without_partner_role_is_untouched(string $path): void
    {
        $this->assertSame(200, $this->run(['employee'], 'GET', $path)->getStatusCode());
    }

    public function test_staff_who_also_hold_partner_keep_staff_access(): void
    {
        $this->assertFalse(PartnerRole::isPartnerOnly($this->userWith(['partner', 'employee', 'sales-manager'])));
        $this->assertSame(200, $this->run(['partner', 'admin'], 'GET', '/account/properties')->getStatusCode());
    }

    public function test_partner_only_predicate(): void
    {
        $this->assertTrue(PartnerRole::isPartnerOnly($this->userWith(['partner'])));
        $this->assertTrue(PartnerRole::isPartnerOnly($this->userWith(['employee', 'partner'])));
        $this->assertFalse(PartnerRole::isPartnerOnly($this->userWith(['employee'])));
        $this->assertFalse(PartnerRole::isPartnerOnly($this->userWith([])));
        $this->assertFalse(PartnerRole::isPartnerOnly(null));
    }

    /** @param list<string> $roles */
    private function userWith(array $roles): User
    {
        $user = new User;
        $user->setRelation('roles', collect(array_map(function ($name) {
            $role = new Role;
            $role->name = $name;

            return $role;
        }, $roles)));

        return $user;
    }

    /**
     * @param  list<string>  $roles
     * @param  array<string, string>  $headers
     */
    private function run(array $roles, string $method, string $path, array $headers = [])
    {
        $request = Request::create($path, $method);

        foreach ($headers as $key => $value) {
            $request->headers->set($key, $value);
        }

        $user = $this->userWith($roles);
        $request->setUserResolver(fn () => $user);

        return (new RestrictPartnerAccounts)->handle($request, fn () => response('ok'));
    }
}
