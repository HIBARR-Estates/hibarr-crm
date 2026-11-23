<?php

namespace Tests\Feature;

use App\Http\Controllers\SuppressionController;
use App\Models\Company;
use App\Models\Lead;
use App\Models\User;
use App\Services\CrmEventService;
use App\Services\Suppression\SuppressionManagementClient;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class SuppressionControllerTest extends TestCase
{
    use RefreshDatabase;

    private function makeUserWithPermissions(Company $company, array $grantedPermissions): User
    {
        $user = User::factory()->create(['company_id' => $company->id]);

        $map = [];
        foreach ($grantedPermissions as $perm) {
            $map[$perm] = 'all';
        }

        // Stub permissionMap so tests do not depend on seeded permission rows.
        $mockUser = \Mockery::mock($user)->makePartial();
        $mockUser->shouldReceive('permissionMap')->andReturn($map);

        return $mockUser;
    }

    public function test_user_without_view_permission_receives_no_restriction_details(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'ol-secret');

        $company = Company::factory()->create();
        $lead = Lead::factory()->create(['company_id' => $company->id, 'client_email' => 'secret@example.com']);
        $user = $this->makeUserWithPermissions($company, []);

        Http::fake([
            "https://ol.test/v1/suppression-restrictions/lead/{$lead->id}" => Http::response([
                'success' => true,
                'data' => [
                    'restrictions' => [
                        [
                            'uuid' => 'supp-1',
                            'channel' => 'email',
                            'scope' => 'all',
                            'reason' => 'complained',
                            'source' => 'provider_feedback',
                            'author' => 'Admin User',
                            'createdAt' => '2026-11-20T10:00:00Z',
                            'expiresAt' => null,
                            'applyToFutureDetails' => false,
                            'email' => 'secret@example.com',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $request = Request::create("/suppressions/restrictions/lead/{$lead->id}", 'GET');
        $request->setUserResolver(fn () => $user);

        $controller = new SuppressionController(
            new SuppressionManagementClient,
            app(CrmEventService::class)
        );
        $response = $controller->entityRestrictions($request, 'lead', $lead->id);

        $json = $response->getData(true);
        $this->assertFalse($json['unavailable']);
        $this->assertFalse($json['canViewDetails']);
        $this->assertSame([], $json['restrictions']);
        $this->assertCount(1, $json['blockedChannels']);
        $this->assertArrayNotHasKey('reason', $json['blockedChannels'][0]);
        $this->assertArrayNotHasKey('author', $json['blockedChannels'][0]);
    }

    public function test_contact_details_are_masked_without_view_full_permission(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'ol-secret');

        $company = Company::factory()->create();
        $lead = Lead::factory()->create(['company_id' => $company->id, 'client_email' => 'alice@example.com']);
        $user = $this->makeUserWithPermissions($company, ['view_suppression_restrictions']);

        Http::fake([
            "https://ol.test/v1/suppression-restrictions/lead/{$lead->id}" => Http::response([
                'success' => true,
                'data' => [
                    'restrictions' => [
                        [
                            'uuid' => 'supp-2',
                            'channel' => 'email',
                            'scope' => 'non_transactional',
                            'reason' => 'unsubscribed',
                            'source' => 'unsubscribe_link',
                            'author' => null,
                            'createdAt' => '2026-11-20T10:00:00Z',
                            'expiresAt' => null,
                            'applyToFutureDetails' => false,
                            'email' => 'alice@example.com',
                        ],
                    ],
                ],
            ], 200),
        ]);

        $request = Request::create("/suppressions/restrictions/lead/{$lead->id}", 'GET');
        $request->setUserResolver(fn () => $user);

        $controller = new SuppressionController(
            new SuppressionManagementClient,
            app(CrmEventService::class)
        );
        $response = $controller->entityRestrictions($request, 'lead', $lead->id);

        $json = $response->getData(true);
        $this->assertTrue($json['canViewDetails']);
        $this->assertSame('a***@ex***', $json['restrictions'][0]['email']);
    }

    public function test_lift_stop_requires_consent_evidence_and_elevated_permission(): void
    {
        Config::set('services.ol.base_url', 'https://ol.test/v1');
        Config::set('services.ol.api_key', 'ol-secret');

        $company = Company::factory()->create();
        $lead = Lead::factory()->create(['company_id' => $company->id]);
        $basicUser = $this->makeUserWithPermissions($company, ['lift_suppressions']);
        $elevatedUser = $this->makeUserWithPermissions($company, [
            'lift_suppressions',
            'lift_restricted_suppressions',
        ]);

        Http::fake([
            "https://ol.test/v1/suppression-restrictions/lead/{$lead->id}" => Http::response([
                'success' => true,
                'data' => [
                    'restrictions' => [
                        [
                            'uuid' => '11111111-1111-4111-8111-111111111111',
                            'channel' => 'whatsapp',
                            'scope' => 'non_transactional',
                            'reason' => 'unsubscribed',
                            'source' => 'stop_keyword',
                            'author' => null,
                            'createdAt' => '2026-11-20T10:00:00Z',
                            'expiresAt' => null,
                            'applyToFutureDetails' => false,
                        ],
                    ],
                ],
            ], 200),
            'https://ol.test/v1/suppressions/11111111-1111-4111-8111-111111111111/lift' => Http::response([
                'success' => true,
                'message' => 'Suppression entry lifted.',
                'data' => ['entry' => ['uuid' => '11111111-1111-4111-8111-111111111111']],
            ], 200),
        ]);

        $controller = new SuppressionController(
            new SuppressionManagementClient,
            app(CrmEventService::class)
        );

        // Missing consent evidence → 422
        $noEvidenceReq = Request::create('/suppressions/11111111-1111-4111-8111-111111111111/lift', 'POST', [
            'reason' => 'Customer wants back in',
            'entityType' => 'lead',
            'entityId' => $lead->id,
        ]);
        $noEvidenceReq->setUserResolver(fn () => $elevatedUser);
        $this->assertSame(422, $controller->lift($noEvidenceReq, '11111111-1111-4111-8111-111111111111')->getStatusCode());

        // Missing lift_restricted_suppressions → 403
        $noPermReq = Request::create('/suppressions/11111111-1111-4111-8111-111111111111/lift', 'POST', [
            'reason' => 'Customer wants back in',
            'consentEvidence' => ['text' => 'Signed opt-in on call'],
            'entityType' => 'lead',
            'entityId' => $lead->id,
        ]);
        $noPermReq->setUserResolver(fn () => $basicUser);
        $this->assertSame(403, $controller->lift($noPermReq, '11111111-1111-4111-8111-111111111111')->getStatusCode());

        // Valid request with elevated permission → 200
        $validReq = Request::create('/suppressions/11111111-1111-4111-8111-111111111111/lift', 'POST', [
            'reason' => 'Customer wants back in',
            'consentEvidence' => ['text' => 'Signed opt-in on call'],
            'entityType' => 'lead',
            'entityId' => $lead->id,
        ]);
        $validReq->setUserResolver(fn () => $elevatedUser);
        $this->assertSame(200, $controller->lift($validReq, '11111111-1111-4111-8111-111111111111')->getStatusCode());
    }
}
