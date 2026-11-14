<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\AgentWorkspace\PreferencesController;
use App\Http\Middleware\EnsureAgentWorkspaceAccess;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Preferences (L7-40): one agent page over the classic Preferences and
 * Reminder preferences pages. It adds no endpoint of its own for saving, so
 * what is checked is the page's gate and that the endpoints it calls exist.
 */
class AgentWorkspacePreferencesTest extends TestCase
{
    public function test_the_page_is_registered_behind_the_workspace_gate(): void
    {
        $route = Route::getRoutes()->getByName('agent.preferences');

        $this->assertNotNull($route);
        $this->assertSame(PreferencesController::class.'@show', $route->getActionName());
        $this->assertContains(EnsureAgentWorkspaceAccess::class, $route->gatherMiddleware());
        $this->assertContains('auth', $route->gatherMiddleware());
        $this->assertStringEndsWith('/agent/preferences', route('agent.preferences', [], false));
    }

    public function test_saving_goes_to_the_classic_pages_own_endpoints(): void
    {
        $this->assertSame('/account/settings/preferences/timezone', route('user-preferences.timezone', [], false));
        $this->assertSame('/account/settings/reminder-preferences', route('reminder-preferences.update', [], false));
        $this->assertSame('/account/settings/reminder-preferences/meeting/reset', route('reminder-preferences.reset', 'meeting', false));
        $this->assertSame('/account/settings/preferences/bypasses', route('user-preferences.bypasses', [], false));
    }

    public function test_the_account_menu_opens_the_agent_preferences(): void
    {
        $menu = file_get_contents(base_path('resources/js/Components/Redesign/agent/AgentAccountMenu.tsx'));

        $this->assertStringContainsString('router.visit("/agent/preferences")', $menu);
    }

    public function test_the_wording_exists_in_every_language(): void
    {
        $keys = ['title', 'subtitle', 'unsaved', 'cancel', 'save'];

        foreach (['eng', 'de', 'tr', 'ru'] as $locale) {
            $prefs = (include base_path("resources/lang/{$locale}/pages.php"))['agent_workspace']['prefs'] ?? [];

            foreach ($keys as $key) {
                $this->assertNotEmpty($prefs[$key] ?? null, "{$locale} is missing prefs.{$key}");
            }
            foreach (['timezone' => ['title', 'uses', 'uses_text', 'sync', 'sync_text'], 'notifications' => ['title', 'alerts', 'alerts_text', 'customise', 'events', 'events_text', 'events_hint', 'open'], 'reminders' => ['title', 'reset', 'reset_title', 'reset_message', 'reset_done', 'enable', 'enable_text', 'before', 'before_meeting', 'remove', 'add', 'limits', 'off'], 'pills' => ['label', 'preferences', 'notifications']] as $group => $groupKeys) {
                foreach ($groupKeys as $key) {
                    $this->assertNotEmpty($prefs[$group][$key] ?? null, "{$locale} is missing prefs.{$group}.{$key}");
                }
            }
            foreach (['day', 'hour', 'minute'] as $unit) {
                $this->assertNotEmpty($prefs['reminders']['units'][$unit] ?? null, "{$locale} is missing the {$unit} unit");
            }
            $this->assertStringContainsString('{{max}}', $prefs['reminders']['limits']);
            $this->assertStringContainsString('{{zone}}', $prefs['timezone']['uses_text']);
        }
    }
}
