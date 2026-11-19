<?php

namespace Tests\Feature;

use App\Models\LeadSavedView;
use Illuminate\Auth\GenericUser;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * How LeadSavedViewController finds a view before checking whether the viewer
 * may change it: through visibleTo(), inside the viewer's own company.
 * A view the viewer cannot see answers like one that does not exist (404), so
 * a 403 never confirms that someone else's private view is real.
 */
class LeadSavedViewLookupTest extends TestCase
{
    private const ME = 10;

    private const COLLEAGUE = 20;

    protected function setUp(): void
    {
        parent::setUp();

        Config::set('database.default', 'sqlite');
        Config::set('database.connections.sqlite.database', ':memory:');

        DB::purge('sqlite');
        DB::reconnect('sqlite');

        Schema::dropIfExists('lead_saved_views');
        Schema::create('lead_saved_views', function (Blueprint $table) {
            $table->increments('id');
            $table->unsignedInteger('company_id')->nullable();
            $table->unsignedInteger('user_id');
            $table->string('name');
            $table->json('filters')->nullable();
            $table->string('visibility');
            $table->boolean('pinned')->default(true);
            $table->timestamps();
        });

        // The company scope narrows lookups only for a signed-in user (every
        // request to this controller is one), to the company in the session.
        $this->actingAs(new GenericUser(['id' => self::ME]));
        session(['company' => (object) ['id' => 1]]);
    }

    protected function tearDown(): void
    {
        Schema::dropIfExists('lead_saved_views');
        parent::tearDown();
    }

    public function test_someone_elses_private_view_is_not_found(): void
    {
        $private = $this->insertView(self::COLLEAGUE, 'private');

        $this->assertNull(LeadSavedView::query()->visibleTo(self::ME)->find($private));
    }

    public function test_a_team_view_of_someone_else_is_found_and_then_judged_on_permission(): void
    {
        $team = $this->insertView(self::COLLEAGUE, 'team');

        $view = LeadSavedView::query()->visibleTo(self::ME)->find($team);

        $this->assertNotNull($view);
        // Found, but a plain member still may not change it (that is the 403).
        $this->assertFalse($view->isManageableBy(self::ME, isAdmin: false));
        $this->assertTrue($view->isManageableBy(self::ME, isAdmin: true));
    }

    public function test_ones_own_views_are_found_whatever_the_visibility(): void
    {
        $private = $this->insertView(self::ME, 'private');
        $team = $this->insertView(self::ME, 'team');

        $this->assertNotNull(LeadSavedView::query()->visibleTo(self::ME)->find($private));
        $this->assertNotNull(LeadSavedView::query()->visibleTo(self::ME)->find($team));
    }

    public function test_an_admin_never_reaches_another_companys_team_view(): void
    {
        $otherCompany = $this->insertView(self::COLLEAGUE, 'team', companyId: 2);

        $this->assertNull(
            LeadSavedView::query()->visibleTo(self::ME)->find($otherCompany),
            'The company scope must keep an admin of one company out of another company\'s views.'
        );
    }

    private function insertView(int $userId, string $visibility, int $companyId = 1): int
    {
        return (int) DB::table('lead_saved_views')->insertGetId([
            'company_id' => $companyId,
            'user_id' => $userId,
            'name' => 'View',
            'filters' => json_encode([]),
            'visibility' => $visibility,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }
}
