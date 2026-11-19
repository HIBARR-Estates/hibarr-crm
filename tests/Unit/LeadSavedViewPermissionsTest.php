<?php

namespace Tests\Unit;

use App\Models\LeadSavedView;
use Tests\TestCase;

/**
 * Who may change a saved view: its owner always; an admin only when the view
 * is shared with the team. A private view is the owner's alone.
 */
class LeadSavedViewPermissionsTest extends TestCase
{
    private const OWNER = 10;

    private const OTHER = 20;

    private function makeView(string $visibility): LeadSavedView
    {
        return new LeadSavedView([
            'user_id' => self::OWNER,
            'visibility' => $visibility,
            'name' => 'Unassigned, not from Facebook',
            'filters' => ['lead_owner_id_mode' => 'empty'],
            'pinned' => true,
        ]);
    }

    public function test_the_owner_manages_their_own_views_whatever_the_visibility(): void
    {
        $this->assertTrue($this->makeView('private')->isManageableBy(self::OWNER));
        $this->assertTrue($this->makeView('team')->isManageableBy(self::OWNER));
    }

    public function test_a_teammate_who_is_not_an_admin_cannot_manage_a_team_view(): void
    {
        $this->assertFalse($this->makeView('team')->isManageableBy(self::OTHER));
        $this->assertFalse($this->makeView('team')->isManageableBy(self::OTHER, isAdmin: false));
    }

    public function test_an_admin_manages_team_views_they_do_not_own(): void
    {
        $this->assertTrue($this->makeView('team')->isManageableBy(self::OTHER, isAdmin: true));
    }

    public function test_an_admin_never_gets_to_manage_someone_elses_private_view(): void
    {
        $this->assertFalse($this->makeView('private')->isManageableBy(self::OTHER, isAdmin: true));
    }

    public function test_only_the_owner_can_change_who_a_view_is_shared_with(): void
    {
        $team = $this->makeView('team');

        $this->assertTrue($team->canSetVisibility(self::OWNER, 'private'));
        $this->assertFalse($team->canSetVisibility(self::OTHER, 'private'), 'An admin cannot take a team view private.');
        // Leaving it as it is stays allowed, so an admin can rename or re-pin.
        $this->assertTrue($team->canSetVisibility(self::OTHER, 'team'));
    }

    public function test_the_presented_view_tells_the_ui_what_the_viewer_may_do(): void
    {
        $view = $this->makeView('team');
        $view->setRelation('owner', (object) ['name' => 'Sara Okafor']);

        $asOwner = $view->presentFor(self::OWNER, false);
        $asAdmin = $view->presentFor(self::OTHER, true);
        $asMember = $view->presentFor(self::OTHER, false);

        $this->assertTrue($asOwner['is_owner']);
        $this->assertTrue($asOwner['can_manage']);

        $this->assertFalse($asAdmin['is_owner']);
        $this->assertTrue($asAdmin['can_manage']);

        $this->assertFalse($asMember['is_owner']);
        $this->assertFalse($asMember['can_manage']);

        $this->assertSame('Sara Okafor', $asMember['owner_name']);
        $this->assertSame(['lead_owner_id_mode' => 'empty'], $asMember['filters']);
    }
}
