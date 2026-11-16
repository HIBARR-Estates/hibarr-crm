<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\AgentWorkspaceController;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * The incoming-call card (L7-13, L7-31): the one endpoint behind it, and the
 * wording it shows in all four languages.
 */
class AgentWorkspaceIncomingCallTest extends TestCase
{
    public function test_the_caller_glance_has_its_own_route_behind_the_workspace_guards(): void
    {
        $route = Route::getRoutes()->getByName('agent.people.caller');

        $this->assertNotNull($route);
        $this->assertSame(['GET', 'HEAD'], $route->methods());
        $this->assertSame('agent/people/{lead}/caller', $route->uri());
        $this->assertSame(AgentWorkspaceController::class.'@caller', $route->getActionName());
        // Same guards as every other agent page: a signed-in agent with workspace access.
        $this->assertContains('auth', $route->gatherMiddleware());
        $this->assertSame(['lead' => '[0-9]+'], $route->wheres);
    }

    public function test_the_caller_endpoint_checks_the_lead_before_it_answers(): void
    {
        $source = file_get_contents(app_path('Http/Controllers/AgentWorkspace/AgentWorkspaceController.php'));
        $start = strpos($source, 'public function caller(');

        $this->assertNotFalse($start);
        $body = substr($source, $start, 900);
        // The lead page's own rule decides, and it runs before anything about the lead is read.
        $this->assertStringContainsString("'view_lead'", $body);
        $this->assertLessThan(strpos($body, 'forLead('), strpos($body, 'abort_unless('));
    }

    public function test_every_line_on_the_card_exists_in_all_four_languages(): void
    {
        $english = require resource_path('lang/eng/pages.php');
        $keys = array_keys($english['agent_workspace']['incoming']);

        foreach (['de', 'tr', 'ru'] as $locale) {
            $lines = (require resource_path("lang/{$locale}/pages.php"))['agent_workspace']['incoming'];

            $this->assertSame($keys, array_keys($lines), $locale);
            foreach ($keys as $key) {
                $this->assertNotSame('', trim($lines[$key]), "{$locale}.{$key}");
                preg_match_all('/\{\{\w+\}\}/', $english['agent_workspace']['incoming'][$key], $wanted);
                preg_match_all('/\{\{\w+\}\}/', $lines[$key], $found);
                $this->assertEqualsCanonicalizing($wanted[0], $found[0], "{$locale}.{$key} placeholders");
            }
        }
    }
}
