<?php

namespace Tests\Feature\AgentWorkspace;

use Tests\TestCase;

/**
 * New activity (L7-42): one panel on every record page, wired to the lead
 * page's own create forms. What is checked is that the panel's wording exists
 * in every language the app ships and that the pages provide its scope.
 */
class AgentWorkspaceNewActivityTest extends TestCase
{
    private const KEYS = ['eyebrow', 'task', 'task_text', 'meeting', 'meeting_text', 'meeting_types_more', 'foot_deal', 'foot_person'];

    public function test_the_panel_wording_exists_in_every_language(): void
    {
        foreach (['eng', 'de', 'tr', 'ru'] as $locale) {
            $block = (include base_path("resources/lang/{$locale}/pages.php"))['agent_workspace']['new_activity'] ?? [];

            foreach (self::KEYS as $key) {
                $this->assertNotEmpty($block[$key] ?? null, "{$locale} is missing new_activity.{$key}");
            }
            $this->assertStringContainsString('{{types}}', $block['meeting_types_more']);
        }
    }

    public function test_both_record_pages_provide_the_panels_scope(): void
    {
        foreach (['Contact', 'ContactDeal'] as $page) {
            $source = file_get_contents(base_path("resources/js/Pages/AgentWorkspace/{$page}.tsx"));

            // Tolerant of formatting: the provider is rendered with some scope value.
            $this->assertMatchesRegularExpression('/<NewActivityProvider\s+value=\{\w+\}\s*>/', $source, "{$page} must provide the New activity scope");
        }
    }
}
