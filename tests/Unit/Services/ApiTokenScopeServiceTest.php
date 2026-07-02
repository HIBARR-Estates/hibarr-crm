<?php

namespace Tests\Unit\Services;

use App\Services\ApiTokenScopeService;
use Tests\TestCase;

class ApiTokenScopeServiceTest extends TestCase
{
    public function test_empty_permissions_are_unrestricted(): void
    {
        $this->assertTrue(ApiTokenScopeService::isUnrestricted(null));
        $this->assertTrue(ApiTokenScopeService::isUnrestricted([]));
        $this->assertTrue(ApiTokenScopeService::isUnrestricted(['scopes' => []]));
    }

    public function test_restricted_token_allows_only_configured_route(): void
    {
        $permissions = ['scopes' => ['api.v2.tasks.create']];

        $this->assertTrue(ApiTokenScopeService::routeAllowed('api.v2.tasks.create', $permissions));
        $this->assertFalse(ApiTokenScopeService::routeAllowed('api.v2.notes.create', $permissions));
    }

    public function test_unrestricted_token_allows_any_route(): void
    {
        $this->assertTrue(ApiTokenScopeService::routeAllowed('api.v2.notes.create', null));
    }

    public function test_encode_scopes_filters_unknown_keys(): void
    {
        $encoded = ApiTokenScopeService::encodeScopes([
            'api.v2.tasks.create',
            'invalid.scope.key',
        ]);

        $this->assertSame(['scopes' => ['api.v2.tasks.create']], $encoded);
    }
}
