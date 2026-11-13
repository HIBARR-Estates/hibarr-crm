<?php

namespace Tests\Feature\AgentWorkspace;

use App\Http\Controllers\DealController;
use App\Models\Lead;
use App\Models\User;
use App\Services\AgentWorkspace\LeadVisibility;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Deal-only view (L7-30): someone who can see a deal but not its lead gets the
 * deal, with the lead's own details left out of what the server sends.
 */
class AgentWorkspaceDealOnlyTest extends TestCase
{
    public function test_the_deal_page_is_the_one_that_applies_the_rule(): void
    {
        $route = Route::getRoutes()->getByName('agent.people.deal');

        $this->assertNotNull($route);
        $this->assertSame(DealController::class.'@agentShow', $route->getActionName());
    }

    public function test_the_owner_may_open_the_lead_and_an_agent_of_the_deal_may_not(): void
    {
        $lead = new Lead;
        $lead->id = 40;
        $lead->lead_owner = 7;
        $lead->added_by = 7;

        $this->assertTrue(LeadVisibility::canView($this->viewer(7, 'owned'), $lead));
        $this->assertFalse(LeadVisibility::canView($this->viewer(9, 'owned'), $lead));
        $this->assertTrue(LeadVisibility::canView($this->viewer(9, 'all'), $lead));
        $this->assertFalse(LeadVisibility::canView($this->viewer(9, 'none'), $lead));
    }

    public function test_a_lead_you_added_stays_yours_under_the_added_scope(): void
    {
        $lead = new Lead;
        $lead->id = 41;
        $lead->lead_owner = 7;
        $lead->added_by = 9;

        $this->assertTrue(LeadVisibility::canView($this->viewer(9, 'added'), $lead));
        $this->assertFalse(LeadVisibility::canView($this->viewer(9, 'owned'), $lead));
    }

    public function test_nothing_of_the_leads_own_details_is_left_in_what_is_sent(): void
    {
        $props = [
            'deal' => [
                'id' => 31,
                'lead_id' => 40,
                'name' => 'Hartmann · Iskele investment',
                'added_by' => 9,
                'value' => 6500,
                'contact' => [
                    'id' => 40,
                    'client_name' => 'Oliver Hartmann',
                    'client_email' => 'oliver@example.com',
                    'mobile' => '+49 160 1234567',
                    'lead_owner' => 7,
                    'marketing' => ['lead_score' => 72],
                    'date_of_birth' => '1980-01-01',
                ],
            ],
            'leadCustomFields' => [['id' => 1, 'label' => 'Household']],
            'leadCustomFieldsData' => ['household' => 'Married, two children'],
            'visibleLeadFieldKeys' => ['household'],
            'consents' => [['id' => 5]],
            'permissions' => ['view_deals' => 'owned'],
        ];

        $safe = LeadVisibility::withoutLeadDetails($props, 'Daniel Ruf', 9);

        $this->assertSame(['id', 'client_name', 'lead_owner'], array_keys($safe['deal']['contact']));
        $this->assertSame('Oliver Hartmann', $safe['deal']['contact']['client_name']);
        $this->assertSame(['id' => 7, 'name' => 'Daniel Ruf'], $safe['deal']['contact']['lead_owner']);
        $this->assertSame([], $safe['leadCustomFields']);
        $this->assertSame([], $safe['leadCustomFieldsData']);
        $this->assertSame([], $safe['visibleLeadFieldKeys']);
        $this->assertSame([], $safe['consents']);
        $this->assertStringNotContainsString('oliver@example.com', json_encode($safe));
        $this->assertStringNotContainsString('1234567', json_encode($safe));
        $this->assertStringNotContainsString('Married', json_encode($safe));

        // The deal itself is untouched.
        $this->assertSame(6500, $safe['deal']['value']);
        $this->assertSame(['view_deals' => 'owned'], $safe['permissions']);
        $this->assertSame(['owner_name' => 'Daniel Ruf', 'created_by_me' => true], $safe['leadRestricted']);
    }

    public function test_it_says_when_the_deal_was_created_by_someone_else(): void
    {
        $safe = LeadVisibility::withoutLeadDetails(['deal' => ['added_by' => 3, 'contact' => ['id' => 1]]], null, 9);

        $this->assertSame(['owner_name' => null, 'created_by_me' => false], $safe['leadRestricted']);
    }

    public function test_the_page_wording_exists_in_every_language(): void
    {
        $keys = ['created_by_you', 'meta', 'meta_no_owner', 'call_hidden', 'edit_deal', 'lock_title', 'lock_title_no_owner', 'lock_text', 'lock_text_no_owner', 'deal_facts', 'notes_title', 'files_title'];

        foreach (['eng', 'de', 'tr', 'ru'] as $locale) {
            $restricted = (include base_path("resources/lang/{$locale}/pages.php"))['agent_workspace']['deal']['restricted'] ?? [];

            foreach ($keys as $key) {
                $this->assertNotEmpty($restricted[$key] ?? null, "{$locale} is missing deal.restricted.{$key}");
            }
            $this->assertStringContainsString('{{owner}}', $restricted['meta']);
            $this->assertStringContainsString('{{name}}', $restricted['lock_text']);
        }
    }

    private function viewer(int $id, string $scope): User
    {
        $user = new class extends User
        {
            public string $scope = 'none';

            public function permission($permission)
            {
                return $this->scope;
            }
        };
        $user->id = $id;
        $user->scope = $scope;

        return $user;
    }
}
