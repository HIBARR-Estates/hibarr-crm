<?php

namespace Tests\Feature;

use App\Models\DealExpose;
use App\Models\ExposeSnapshot;
use App\Models\User;
use App\Services\PdfExpose\ExposeSnapshotService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\Concerns\SetsFeatureFlags;
use Tests\TestCase;

class DealExposeControllerTest extends TestCase
{
    use SetsFeatureFlags;

    private const COMPANY_ID = 1;

    private const OTHER_COMPANY_ID = 2;

    protected function setUp(): void
    {
        parent::setUp();

        $this->ensureSchema();
        // Default off, which also avoids a remote FeatureFlagService fetch.
        $this->setFeatureFlag('crm.deal-exposes-tab', false);
        // Base Controller middleware runs migrate/company boot (needs full schema).
        $this->withoutMiddleware();
        session(['check_migrate_status' => 'Good']);
    }

    public function test_deal_exposes_flag_is_known(): void
    {
        $this->assertContains('crm.deal-exposes-tab', config('features.known_flags'));
    }

    public function test_deal_exposes_routes_are_registered(): void
    {
        $this->assertTrue(Route::has('deals.exposes.index'));
        $this->assertTrue(Route::has('deals.exposes.available'));
        $this->assertTrue(Route::has('deals.exposes.store'));
        $this->assertTrue(Route::has('leads.exposes.index'));
        $this->assertTrue(Route::has('deal-exposes.update'));
        $this->assertTrue(Route::has('deal-exposes.status'));
        $this->assertTrue(Route::has('deal-exposes.destroy'));
    }

    /**
     * The whole feature is gated, so with the flag off every entry point must
     * 404 — not merely render an empty tab.
     */
    public function test_every_endpoint_404s_when_flag_disabled(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', false);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');
        $this->grantPermission($agent, 'add_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $exposeId = $this->createExpose($dealId, $leadId);

        $this->beAgent($agent);

        $this->getJson(route('deals.exposes.index', $dealId))->assertStatus(404);
        $this->getJson(route('deals.exposes.available', $dealId))->assertStatus(404);
        $this->getJson(route('leads.exposes.index', $leadId))->assertStatus(404);
        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'manual',
            'title' => 'Blocked',
        ])->assertStatus(404);
        $this->patchJson(route('deal-exposes.update', $exposeId), [
            'title' => 'Renamed',
        ])->assertStatus(404);
        $this->patchJson(route('deal-exposes.status', $exposeId), [
            'status' => 'shown',
        ])->assertStatus(404);
        $this->deleteJson(route('deal-exposes.destroy', $exposeId))->assertStatus(404);
    }

    public function test_index_returns_deal_exposes_with_summary_when_enabled(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $this->createExpose($dealId, $leadId, ['title' => 'Villa v3', 'status' => 'shown']);
        $this->createExpose($dealId, $leadId, ['title' => 'Villa v4', 'status' => 'accepted']);

        $this->beAgent($agent);

        $response = $this->getJson(route('deals.exposes.index', $dealId));

        $response->assertStatus(200)
            ->assertJsonPath('summary.total', 2)
            ->assertJsonPath('summary.shown', 1)
            ->assertJsonPath('summary.accepted', 1);

        $titles = array_column($response->json('exposes'), 'title');
        sort($titles);
        $this->assertSame(['Villa v3', 'Villa v4'], $titles);
    }

    public function test_index_does_not_leak_exposes_from_another_company(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $this->createExpose($dealId, $leadId, ['title' => 'Ours']);
        $this->createExpose($dealId, $leadId, [
            'title' => 'Theirs',
            'company_id' => self::OTHER_COMPANY_ID,
        ]);

        $this->beAgent($agent);

        $response = $this->getJson(route('deals.exposes.index', $dealId));

        $response->assertStatus(200)->assertJsonPath('summary.total', 1);
        $this->assertSame(
            ['Ours'],
            array_column($response->json('exposes'), 'title'),
        );
    }

    public function test_lead_index_rolls_up_exposes_across_deals(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');
        $leadId = $this->createLead();
        $firstDeal = $this->createDeal($leadId, ['name' => 'Deal One']);
        $secondDeal = $this->createDeal($leadId, ['name' => 'Deal Two']);
        $this->createExpose($firstDeal, $leadId, ['title' => 'From deal one']);
        $this->createExpose($secondDeal, $leadId, ['title' => 'From deal two']);

        $this->beAgent($agent);

        $response = $this->getJson(route('leads.exposes.index', $leadId));

        $response->assertStatus(200)->assertJsonPath('summary.total', 2);

        // The deal name travels with each row so the client can group by deal.
        $dealNames = array_column($response->json('exposes'), 'deal_name');
        sort($dealNames);
        $this->assertSame(['Deal One', 'Deal Two'], $dealNames);
    }

    public function test_status_update_persists_and_stamps_changed_at(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $exposeId = $this->createExpose($dealId, $leadId, ['status' => 'not_sent']);

        $this->beAgent($agent);

        $this->patchJson(route('deal-exposes.status', $exposeId), [
            'status' => 'accepted',
        ])->assertStatus(200)->assertJsonPath('expose.status', 'accepted');

        $row = DB::table('deal_exposes')->where('id', $exposeId)->first();
        $this->assertSame('accepted', $row->status);
        $this->assertNotNull($row->status_changed_at);
    }

    public function test_update_persists_title_and_amount(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $exposeId = $this->createExpose($dealId, $leadId, [
            'title' => 'Original',
            'amount' => 100000,
        ]);

        $this->beAgent($agent);

        $this->patchJson(route('deal-exposes.update', $exposeId), [
            'title' => 'Renamed',
            'amount' => 250000.5,
        ])
            ->assertStatus(200)
            ->assertJsonPath('expose.title', 'Renamed')
            ->assertJsonPath('expose.amount', 250000.5);

        $row = DB::table('deal_exposes')->where('id', $exposeId)->first();
        $this->assertSame('Renamed', $row->title);
        $this->assertEqualsWithDelta(250000.5, (float) $row->amount, 0.001);
    }

    public function test_update_status_and_destroy_are_rejected_when_the_deal_is_locked(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId, ['is_locked' => true]);
        $exposeId = $this->createExpose($dealId, $leadId, ['title' => 'Original']);

        $this->beAgent($agent);

        $this->patchJson(route('deal-exposes.update', $exposeId), [
            'title' => 'Renamed',
        ])->assertStatus(403);

        $this->patchJson(route('deal-exposes.status', $exposeId), [
            'status' => 'shown',
        ])->assertStatus(403);

        $this->deleteJson(route('deal-exposes.destroy', $exposeId))
            ->assertStatus(403);

        $row = DB::table('deal_exposes')->where('id', $exposeId)->first();
        $this->assertSame('Original', $row->title, 'A locked deal\'s expose must be untouched.');
        $this->assertSame('not_sent', $row->status);
    }

    public function test_status_update_rejects_an_unknown_status(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $exposeId = $this->createExpose($dealId, $leadId);

        $this->beAgent($agent);

        $this->patchJson(route('deal-exposes.status', $exposeId), [
            'status' => 'archived',
        ])->assertStatus(422);
    }

    public function test_index_is_forbidden_without_the_proposal_view_permission(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->beAgent($agent);

        $this->getJson(route('deals.exposes.index', $dealId))->assertStatus(403);
    }

    /**
     * Linking is a company-wide catalog browse now, not a lookup of
     * previously-generated snapshots — every property, developer project,
     * and unit type in the company should surface as a candidate. Each
     * entity type is its own paginated `scope`, not one combined list.
     */
    public function test_available_lists_properties_projects_and_unit_types_by_scope(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $propertyId = $this->createProperty([
            'title' => 'Seaside Villa',
            'price' => json_encode(['amount' => 250000, 'currency' => 'TRY']),
        ]);
        $projectId = $this->createDeveloperProject([
            'name' => 'Akacan Residences',
            'starting_price' => 180000,
        ]);
        $unitTypeId = $this->createDeveloperProjectUnitType($projectId, [
            'bedrooms' => 2,
            'starting_price' => 195000,
        ]);

        $this->beAgent($agent);

        $propertyResponse = $this->getJson(route('deals.exposes.available', $dealId).'?scope=property');
        $propertyResponse->assertStatus(200)->assertJsonPath('total', 1);
        $property = collect($propertyResponse->json('entities'))->first();
        $this->assertSame($propertyId, $property['entity_id']);
        $this->assertNull($property['unit_type_id']);
        $this->assertSame('Seaside Villa', $property['title']);
        $this->assertEqualsWithDelta(250000.0, (float) $property['suggested_amount'], 0.001);

        $projectResponse = $this->getJson(route('deals.exposes.available', $dealId).'?scope=developer_project');
        $projectResponse->assertStatus(200)->assertJsonPath('total', 1);
        $project = collect($projectResponse->json('entities'))->first();
        $this->assertSame($projectId, $project['entity_id']);
        $this->assertSame('Akacan Residences', $project['title']);
        $this->assertEqualsWithDelta(180000.0, (float) $project['suggested_amount'], 0.001);

        $unitTypeResponse = $this->getJson(
            route('deals.exposes.available', $dealId)."?scope=unit_type&project_id={$projectId}"
        );
        $unitTypeResponse->assertStatus(200)->assertJsonPath('total', 1);
        $unitType = collect($unitTypeResponse->json('entities'))->first();
        $this->assertSame($projectId, $unitType['entity_id']);
        $this->assertSame($unitTypeId, $unitType['unit_type_id']);
        $this->assertStringContainsString('Akacan Residences', $unitType['title']);
        $this->assertEqualsWithDelta(195000.0, (float) $unitType['suggested_amount'], 0.001);
    }

    public function test_available_unit_type_scope_requires_a_project(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->beAgent($agent);

        $this->getJson(route('deals.exposes.available', $dealId).'?scope=unit_type')
            ->assertStatus(200)
            ->assertJsonPath('status', 'fail');
    }

    public function test_available_paginates_and_searches_properties(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->createProperty(['title' => 'Seaside Villa']);
        $this->createProperty(['title' => 'Mountain Cabin']);
        $this->createProperty(['title' => 'Seaside Apartment']);

        $this->beAgent($agent);

        $paged = $this->getJson(
            route('deals.exposes.available', $dealId).'?scope=property&per_page=2&page=1'
        );
        $paged->assertStatus(200)
            ->assertJsonPath('total', 3)
            ->assertJsonPath('per_page', 2)
            ->assertJsonPath('last_page', 2);
        $this->assertCount(2, $paged->json('entities'));

        $searched = $this->getJson(
            route('deals.exposes.available', $dealId).'?scope=property&search=Seaside'
        );
        $titles = collect($searched->json('entities'))->pluck('title')->sort()->values()->all();
        $this->assertSame(['Seaside Apartment', 'Seaside Villa'], $titles);
    }

    public function test_available_does_not_leak_entities_from_another_company(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->createProperty(['title' => 'Ours']);
        $this->createProperty(['title' => 'Theirs', 'company_id' => self::OTHER_COMPANY_ID]);

        $this->beAgent($agent);

        $response = $this->getJson(route('deals.exposes.available', $dealId).'?scope=property');

        $titles = collect($response->json('entities'))->pluck('title')->all();

        $this->assertSame(['Ours'], $titles);
    }

    /**
     * This is an internal picker for agents managing their own inventory,
     * not a public listing — draft properties and hidden projects must
     * still show up, unlike on a customer-facing page.
     */
    public function test_available_includes_draft_properties_and_hidden_projects(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->createProperty([
            'title' => 'Draft Property',
            'is_published' => false,
            'added_by' => null,
            'responsible_agent_id' => null,
        ]);
        $this->createDeveloperProject([
            'name' => 'Hidden Project',
            'is_hidden' => true,
        ]);

        $this->beAgent($agent);

        $propertyTitles = collect(
            $this->getJson(route('deals.exposes.available', $dealId).'?scope=property')->json('entities')
        )->pluck('title')->all();
        $this->assertContains('Draft Property', $propertyTitles);

        $projectTitles = collect(
            $this->getJson(route('deals.exposes.available', $dealId).'?scope=developer_project')->json('entities')
        )->pluck('title')->all();
        $this->assertContains('Hidden Project', $projectTitles);
    }

    public function test_available_lists_entities_even_when_deal_has_no_lead(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'view_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId, ['lead_id' => null]);
        $this->createProperty(['title' => 'Still listed']);

        $this->beAgent($agent);

        $response = $this->getJson(route('deals.exposes.available', $dealId).'?scope=property');

        $response->assertStatus(200);
        $titles = collect($response->json('entities'))->pluck('title')->all();
        $this->assertSame(['Still listed'], $titles);
    }

    /**
     * Linking mints a brand-new ExposeSnapshot for the deal's lead and
     * stores the resulting share link — ExposeSnapshotService is mocked
     * here so the PDF-config build pipeline it drives (extensive
     * assets/developer/location relations) isn't exercised by this
     * controller test; that belongs to ExposeSnapshotServiceTest.
     */
    public function test_store_linked_expose_mints_a_snapshot_and_stores_the_share_link(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $propertyId = $this->createProperty([
            'title' => 'Linked villa',
            'price' => json_encode(['amount' => 180000, 'currency' => 'TRY']),
        ]);

        $snapshotId = $this->createExposeSnapshot([
            'lead_id' => $leadId,
            'entity_type' => 'property',
            'entity_id' => $propertyId,
        ]);

        $this->mock(ExposeSnapshotService::class, function ($mock) use ($snapshotId) {
            $mock->shouldReceive('mint')
                ->once()
                ->andReturnUsing(fn () => [
                    'snapshot' => ExposeSnapshot::find($snapshotId),
                    'token' => 'exp_test_token_123',
                ]);
        });

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'linked',
            'entity_type' => 'property',
            'entity_id' => $propertyId,
        ])
            ->assertStatus(200)
            ->assertJsonPath('expose.source', 'linked')
            ->assertJsonPath('expose.entity_type', 'property')
            ->assertJsonPath('expose.entity_id', $propertyId)
            ->assertJsonPath('expose.expose_snapshot_id', $snapshotId)
            ->assertJsonPath('expose.amount', 180000)
            ->assertJsonPath('expose.title', 'Linked villa');

        $row = DB::table('deal_exposes')->where('deal_id', $dealId)->first();
        $this->assertSame($snapshotId, $row->expose_snapshot_id);
        $this->assertStringEndsWith('/exp_test_token_123', $row->external_url);
    }

    /** Matches update/status/destroy — a locked deal accepts no new exposes either. */
    public function test_store_is_rejected_when_the_deal_is_locked(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId, ['is_locked' => true]);

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'manual',
            'title' => 'Blocked',
            'download_url' => 'https://cdn.example.test/backend-uploads/brochure.pdf',
            'object_path' => 'backend-uploads/brochure.pdf',
        ])->assertStatus(403);

        $this->assertDatabaseMissing('deal_exposes', ['deal_id' => $dealId]);
    }

    public function test_store_linked_expose_rejects_an_entity_from_another_company(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $foreignPropertyId = $this->createProperty(['company_id' => self::OTHER_COMPANY_ID]);

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'linked',
            'title' => 'Not ours',
            'entity_type' => 'property',
            'entity_id' => $foreignPropertyId,
        ])->assertStatus(200)->assertJsonPath('status', 'fail');

        $this->assertDatabaseMissing('deal_exposes', ['deal_id' => $dealId]);
    }

    /** Minting an expose "for that lead" is meaningless without one. */
    public function test_store_linked_expose_requires_a_lead(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId, ['lead_id' => null]);
        $propertyId = $this->createProperty();

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'linked',
            'entity_type' => 'property',
            'entity_id' => $propertyId,
        ])->assertStatus(200)->assertJsonPath('status', 'fail');

        $this->assertDatabaseMissing('deal_exposes', ['deal_id' => $dealId]);
    }

    public function test_store_manual_expose_links_to_an_uploaded_deal_file(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $dealFileId = $this->createDealFile($dealId, [
            'filename' => 'brochure.pdf',
            'external_url' => 'https://cdn.example.test/backend-uploads/brochure.pdf',
            'object_path' => 'backend-uploads/brochure.pdf',
            'size' => 204800,
        ]);

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'manual',
            'title' => 'Brochure',
            'deal_file_id' => $dealFileId,
        ])
            ->assertStatus(200)
            ->assertJsonPath('expose.source', 'manual')
            ->assertJsonPath('expose.filename', 'brochure.pdf')
            ->assertJsonPath('expose.download_url', 'https://cdn.example.test/backend-uploads/brochure.pdf');

        $this->assertDatabaseHas('deal_exposes', [
            'deal_id' => $dealId,
            'source' => 'manual',
            'filename' => 'brochure.pdf',
            'object_path' => 'backend-uploads/brochure.pdf',
            'size' => 204800,
        ]);
    }

    public function test_store_rejects_a_non_http_download_url(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');
        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'manual',
            'title' => 'Brochure',
            'download_url' => 'javascript:alert(1)',
            'object_path' => 'backend-uploads/brochure.pdf',
        ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('download_url');

        $this->assertDatabaseMissing('deal_exposes', ['deal_id' => $dealId]);
    }

    public function test_store_manual_expose_rejects_a_deal_file_from_another_deal(): void
    {
        $this->setFeatureFlag('crm.deal-exposes-tab', true);

        $agent = $this->createAgent();
        $this->grantPermission($agent, 'add_lead_proposals', 'all');

        $leadId = $this->createLead();
        $dealId = $this->createDeal($leadId);
        $otherDealId = $this->createDeal($leadId);
        $foreignFileId = $this->createDealFile($otherDealId);

        $this->beAgent($agent);

        $this->postJson(route('deals.exposes.store', $dealId), [
            'source' => 'manual',
            'title' => 'Brochure',
            'deal_file_id' => $foreignFileId,
        ])->assertStatus(200)->assertJsonPath('status', 'fail');

        $this->assertDatabaseMissing('deal_exposes', ['deal_id' => $dealId]);
    }

    private function beAgent(User $agent): void
    {
        // Prefer session user over actingAs so CompanyScope does not require
        // full schema (mirrors ExposeSnapshotShareTest).
        $this->withSession([
            'user' => $agent,
            'check_migrate_status' => 'Good',
        ]);
    }

    private function createAgent(): User
    {
        $id = (int) DB::table('users')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'name' => 'Default Agent',
            'email' => 'agent'.uniqid('', true).'@test.com',
            'status' => 'active',
            'is_client_contact' => null,
            'image' => null,
            'mobile' => null,
            'salutation' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return User::query()->withoutGlobalScopes()->findOrFail($id);
    }

    private function grantPermission(User $user, string $permission, string $type): void
    {
        $permissionId = (int) DB::table('permissions')->insertGetId([
            'name' => $permission,
        ]);
        $typeId = (int) DB::table('permission_types')->insertGetId([
            'name' => $type,
        ]);
        DB::table('user_permissions')->insert([
            'user_id' => $user->id,
            'permission_id' => $permissionId,
            'permission_type_id' => $typeId,
        ]);
    }

    private function createLead(array $overrides = []): int
    {
        return (int) DB::table('leads')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'client_name' => 'Default Lead',
            'client_email' => 'lead'.uniqid('', true).'@test.com',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createDeal(int $leadId, array $overrides = []): int
    {
        return (int) DB::table('deals')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'lead_id' => $leadId,
            'name' => 'Test Deal',
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createExpose(int $dealId, int $leadId, array $overrides = []): int
    {
        return (int) DB::table('deal_exposes')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'deal_id' => $dealId,
            'lead_id' => $leadId,
            'source' => DealExpose::SOURCE_MANUAL,
            'title' => 'Test expose',
            'source_label' => 'Manual upload',
            'amount' => 100000,
            'status' => DealExpose::STATUS_NOT_SENT,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createDealFile(int $dealId, array $overrides = []): int
    {
        return (int) DB::table('deal_files')->insertGetId(array_merge([
            'deal_id' => $dealId,
            'filename' => 'document.pdf',
            'external_url' => 'https://cdn.example.test/backend-uploads/document.pdf',
            'object_path' => 'backend-uploads/document.pdf',
            'size' => 102400,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createProperty(array $overrides = []): int
    {
        $productId = (int) DB::table('products')->insertGetId([
            'company_id' => self::COMPANY_ID,
            'name' => 'Test property product',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return (int) DB::table('properties')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'product_id' => $productId,
            'title' => 'Test Property',
            'slug' => 'prop-'.uniqid(),
            'price' => null,
            'is_published' => true,
            'added_by' => null,
            'responsible_agent_id' => null,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createDeveloperProject(array $overrides = []): int
    {
        return (int) DB::table('developer_projects')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'developer_id' => null,
            'name' => 'Test Project',
            'reference_code' => 'PROJ-'.uniqid(),
            'starting_price' => null,
            'is_hidden' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createDeveloperProjectUnitType(int $projectId, array $overrides = []): int
    {
        return (int) DB::table('developer_project_unit_types')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'developer_project_id' => $projectId,
            'reference_code' => 'UT-'.uniqid(),
            'starting_price' => null,
            'currency' => 'TRY',
            'bedrooms' => null,
            'property_type' => null,
            'primary_category' => null,
            'is_sold_out' => false,
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    private function createExposeSnapshot(array $overrides = []): int
    {
        return (int) DB::table('expose_snapshots')->insertGetId(array_merge([
            'company_id' => self::COMPANY_ID,
            'token_hash' => hash('sha256', uniqid('exp_', true)),
            'token_prefix' => 'exp_test',
            'entity_type' => 'property',
            'entity_id' => 1,
            'agent_user_id' => 1,
            'lead_id' => 1,
            'layout' => 'expose-template',
            'request_payload' => json_encode([]),
            'agent_snapshot' => json_encode([]),
            'lead_snapshot' => json_encode([]),
            'expose_payload' => json_encode(['title' => 'Snapshot']),
            'schema_version' => 1,
            'warnings' => json_encode([]),
            'created_at' => now(),
            'updated_at' => now(),
        ], $overrides));
    }

    private function ensureSchema(): void
    {
        if (! Schema::hasTable('companies')) {
            Schema::create('companies', function (Blueprint $table) {
                $table->id();
                $table->string('company_name')->nullable();
                $table->timestamps();
            });
        }

        if (DB::table('companies')->where('id', self::COMPANY_ID)->doesntExist()) {
            DB::table('companies')->insert([
                'id' => self::COMPANY_ID,
                'company_name' => 'Test Co',
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (! Schema::hasTable('sessions')) {
            Schema::create('sessions', function (Blueprint $table) {
                $table->string('id')->primary();
                $table->unsignedInteger('user_id')->nullable();
                $table->text('payload')->nullable();
                $table->integer('last_activity')->nullable();
            });
        }

        if (! Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id')->nullable();
                $table->unsignedInteger('company_id')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('users')) {
            Schema::create('users', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name')->nullable();
                $table->string('email')->nullable();
                $table->string('status')->default('active');
                $table->unsignedInteger('is_client_contact')->nullable();
                $table->string('image')->nullable();
                $table->string('mobile')->nullable();
                $table->string('salutation')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('users')->delete();
        }

        if (! Schema::hasTable('leads')) {
            Schema::create('leads', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('client_name')->nullable();
                $table->string('client_email')->nullable();
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('leads')->delete();
        }

        if (! Schema::hasTable('deals')) {
            Schema::create('deals', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('lead_id')->nullable();
                $table->string('name')->nullable();
                $table->boolean('is_locked')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('deals')->delete();
        }

        foreach (['permissions', 'permission_types'] as $table) {
            if (! Schema::hasTable($table)) {
                Schema::create($table, function (Blueprint $blueprint) {
                    $blueprint->increments('id');
                    $blueprint->string('name')->nullable();
                });
            } else {
                DB::table($table)->delete();
            }
        }

        if (! Schema::hasTable('user_permissions')) {
            Schema::create('user_permissions', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('user_id');
                $table->unsignedInteger('permission_id');
                $table->unsignedInteger('permission_type_id');
            });
        } else {
            DB::table('user_permissions')->delete();
        }

        if (! Schema::hasTable('deal_exposes')) {
            Schema::create('deal_exposes', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id');
                $table->unsignedBigInteger('deal_id');
                $table->unsignedBigInteger('lead_id')->nullable();
                $table->string('source', 16)->default('manual');
                $table->unsignedBigInteger('expose_snapshot_id')->nullable();
                $table->string('entity_type', 32)->nullable();
                $table->unsignedBigInteger('entity_id')->nullable();
                $table->unsignedBigInteger('unit_type_id')->nullable();
                $table->string('title');
                $table->string('source_label')->nullable();
                $table->decimal('amount', 15, 2)->nullable();
                $table->string('status', 24)->default('not_sent');
                $table->timestamp('status_changed_at')->nullable();
                $table->string('filename')->nullable();
                $table->string('external_url')->nullable();
                $table->string('object_path')->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->unsignedBigInteger('added_by')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('deal_exposes')->delete();
        }

        if (! Schema::hasTable('deal_files')) {
            Schema::create('deal_files', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('deal_id');
                $table->unsignedBigInteger('user_id')->nullable();
                $table->string('filename')->nullable();
                $table->string('hashname')->nullable();
                $table->string('external_url')->nullable();
                $table->string('object_path')->nullable();
                $table->unsignedBigInteger('size')->nullable();
                $table->string('description')->nullable();
                $table->unsignedBigInteger('added_by')->nullable();
                $table->unsignedBigInteger('last_updated_by')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('deal_files')->delete();
        }

        if (! Schema::hasTable('products')) {
            Schema::create('products', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('name')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('products')->delete();
        }

        if (! Schema::hasTable('properties')) {
            Schema::create('properties', function (Blueprint $table) {
                $table->increments('id');
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('product_id')->nullable();
                $table->unsignedInteger('developer_project_id')->nullable();
                $table->unsignedInteger('developer_project_unit_type_id')->nullable();
                $table->string('title')->nullable();
                $table->string('slug')->nullable();
                $table->string('price')->nullable();
                $table->text('photos')->nullable();
                $table->boolean('is_published')->default(true);
                $table->unsignedInteger('added_by')->nullable();
                $table->unsignedInteger('responsible_agent_id')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('properties')->delete();
        }

        if (! Schema::hasTable('developer_projects')) {
            Schema::create('developer_projects', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('developer_id')->nullable();
                $table->string('name')->nullable();
                $table->string('reference_code')->nullable();
                $table->decimal('starting_price', 15, 2)->nullable();
                $table->boolean('is_hidden')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('developer_projects')->delete();
        }

        if (! Schema::hasTable('developer_project_unit_types')) {
            Schema::create('developer_project_unit_types', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('company_id')->nullable();
                $table->unsignedInteger('developer_project_id');
                $table->string('reference_code')->nullable();
                $table->decimal('starting_price', 15, 2)->nullable();
                $table->string('currency')->nullable();
                $table->unsignedInteger('bedrooms')->nullable();
                $table->string('property_type')->nullable();
                $table->string('primary_category')->nullable();
                $table->boolean('is_sold_out')->default(false);
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('developer_project_unit_types')->delete();
        }

        // Empty in every test — only here so DeveloperProject::thumbnail() /
        // DeveloperProjectUnitType::thumbnail() eager-loads don't 500 on a
        // missing table.
        if (! Schema::hasTable('developer_project_assets')) {
            Schema::create('developer_project_assets', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('developer_project_id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('asset_type')->nullable();
                $table->string('file_path')->nullable();
                $table->string('external_url')->nullable();
                $table->text('tags')->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->softDeletes();
                $table->timestamps();
            });
        } else {
            DB::table('developer_project_assets')->delete();
        }

        if (! Schema::hasTable('developer_project_unit_type_assets')) {
            Schema::create('developer_project_unit_type_assets', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('unit_type_id');
                $table->unsignedInteger('company_id')->nullable();
                $table->string('asset_type')->nullable();
                $table->string('file_path')->nullable();
                $table->string('external_url')->nullable();
                $table->text('tags')->nullable();
                $table->unsignedInteger('order')->default(0);
                $table->timestamps();
            });
        } else {
            DB::table('developer_project_unit_type_assets')->delete();
        }

        if (! Schema::hasTable('expose_snapshots')) {
            Schema::create('expose_snapshots', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('company_id');
                $table->string('token_hash');
                $table->string('token_prefix', 12);
                $table->string('entity_type');
                $table->unsignedBigInteger('entity_id');
                $table->unsignedBigInteger('sub_entity_id')->nullable();
                $table->unsignedBigInteger('agent_user_id')->nullable();
                $table->unsignedBigInteger('lead_id')->nullable();
                $table->string('layout')->nullable();
                $table->text('request_payload')->nullable();
                $table->text('agent_snapshot')->nullable();
                $table->text('lead_snapshot')->nullable();
                $table->text('expose_payload')->nullable();
                $table->unsignedInteger('schema_version')->default(1);
                $table->text('warnings')->nullable();
                $table->timestamps();
            });
        } else {
            DB::table('expose_snapshots')->delete();
        }
    }
}
