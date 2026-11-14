<?php

namespace Tests\Feature\AgentWorkspace;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * The bell on the agent band (L7-36) runs on the CRM's own notification API,
 * so what is checked is that those routes are still what it calls, that the
 * layout mounts it, and that its wording exists in every language.
 */
class AgentWorkspaceNotificationsTest extends TestCase
{
    public function test_the_bell_calls_the_crms_own_notification_endpoints(): void
    {
        foreach (['index', 'unread_summary', 'mark_read', 'mark_all_read'] as $name) {
            $this->assertNotNull(Route::getRoutes()->getByName("notifications.api.{$name}"), "notifications.api.{$name} is missing");
        }

        $this->assertNotNull(Route::getRoutes()->getByName('notifications.index'));
    }

    public function test_the_agent_layout_mounts_the_agent_bell(): void
    {
        $layout = file_get_contents(base_path('resources/js/Components/Redesign/agent/AgentWorkspaceLayout.tsx'));

        $this->assertStringContainsString('<AgentNotificationBell />', $layout);
    }

    public function test_the_bell_wording_exists_in_every_language(): void
    {
        $keys = ['title', 'label_new', 'mark_all', 'settings', 'today', 'yesterday', 'earlier', 'empty_all', 'empty_unread', 'empty_read', 'failed', 'retry', 'mark_read', 'foot', 'see_all', 'alerts_on', 'alerts_off', 'manage'];

        foreach (['eng', 'de', 'tr', 'ru'] as $locale) {
            $bell = (include base_path("resources/lang/{$locale}/pages.php"))['agent_workspace']['bell'] ?? [];

            foreach ($keys as $key) {
                $this->assertNotEmpty($bell[$key] ?? null, "{$locale} is missing bell.{$key}");
            }
            foreach (['all', 'unread', 'unread_count', 'read'] as $tab) {
                $this->assertNotEmpty($bell['tabs'][$tab] ?? null, "{$locale} is missing bell.tabs.{$tab}");
            }
            $this->assertStringContainsString('{{count}}', $bell['tabs']['unread_count']);
            $this->assertStringContainsString('{{count}}', $bell['label_new']);
        }
    }
}
