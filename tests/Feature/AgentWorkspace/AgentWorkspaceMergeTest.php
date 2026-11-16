<?php

namespace Tests\Feature\AgentWorkspace;

use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Merge leads (L7-35): the agent workspace opens the CRM's own merge dialog,
 * drawn for the workspace, and keeps the person in the workspace afterwards.
 * Nothing about the merge itself changes, so what is checked is that the same
 * endpoints are used, that the agent pages ask for the agent look and where
 * they go afterwards, and that the new wording exists in every language.
 */
class AgentWorkspaceMergeTest extends TestCase
{
    public function test_it_runs_on_the_existing_review_and_merge_endpoints(): void
    {
        $this->assertNotNull(Route::getRoutes()->getByName('lead-contact.merge-review'));
        $this->assertNotNull(Route::getRoutes()->getByName('lead-contact.merge'));
        $this->assertStringEndsWith('/agent/people/7', route('agent.people.show', 7, false));
    }

    public function test_the_agent_pages_open_the_dialog_in_the_agent_look_and_stay_in_the_workspace(): void
    {
        $edit = file_get_contents(base_path('resources/js/Pages/AgentWorkspace/edit/LeadEditPage.tsx'));
        $contact = file_get_contents(base_path('resources/js/Pages/AgentWorkspace/Contact.tsx'));
        $after = file_get_contents(base_path('resources/js/Pages/AgentWorkspace/contact/useAgentMerge.ts'));

        $this->assertStringContainsString('variant="agent"', $edit);
        $this->assertStringContainsString('variant="agent"', $contact);
        $this->assertStringContainsString('onMergedInto={afterMerge}', $contact);
        $this->assertStringContainsString('route("agent.people.show", keptId)', $after);
        $this->assertStringContainsString('router.reload()', $after);
    }

    public function test_the_classic_pages_keep_their_own_dialog_and_navigation(): void
    {
        $modal = file_get_contents(base_path('resources/js/Features/Leads/Merge/LeadMergeReviewModal.tsx'));

        // Without an agent host the classic redirect and partial reload are unchanged.
        $this->assertStringContainsString('router.visit(route("lead-contact.show", keptId))', $modal);
        $this->assertStringContainsString('router.reload({ only: ["leads", "lead"] })', $modal);
    }

    public function test_the_new_wording_exists_in_every_language(): void
    {
        foreach (['eng', 'de', 'tr', 'ru'] as $locale) {
            $pages = include base_path("resources/lang/{$locale}/pages.php");

            $this->assertNotEmpty($pages['lead_merge']['close'] ?? null, "{$locale} is missing lead_merge.close");
            $this->assertNotEmpty($pages['agent_workspace']['contact']['edit']['merge_unsaved'] ?? null, "{$locale} is missing contact.edit.merge_unsaved");
        }
    }
}
