<?php

namespace Tests\Unit\Services;

use App\Services\ApiTokenScopeService;
use Tests\TestCase;

class ApiTokenScopeServiceTest extends TestCase
{
    public function test_empty_permissions_grant_no_access(): void
    {
        foreach ([null, [], ['scopes' => []], ['scopes' => null]] as $permissions) {
            $this->assertSame([], ApiTokenScopeService::normalizeScopes($permissions));
            $this->assertFalse(ApiTokenScopeService::routeAllowed('api.v2.tasks.create', $permissions));
        }
    }

    public function test_restricted_token_allows_only_configured_route(): void
    {
        $permissions = ['scopes' => ['api.v2.tasks.create']];

        $this->assertTrue(ApiTokenScopeService::routeAllowed('api.v2.tasks.create', $permissions));
        $this->assertFalse(ApiTokenScopeService::routeAllowed('api.v2.notes.create', $permissions));
    }

    public function test_unrestricted_flag_allows_any_route(): void
    {
        $this->assertTrue(ApiTokenScopeService::routeAllowed('api.v2.notes.create', null, true));
        $this->assertTrue(ApiTokenScopeService::routeAllowed(null, null, true));
    }

    public function test_encode_scopes_filters_unknown_keys(): void
    {
        $encoded = ApiTokenScopeService::encodeScopes([
            'api.v2.tasks.create',
            'invalid.scope.key',
        ]);

        $this->assertSame(['scopes' => ['api.v2.tasks.create']], $encoded);
    }

    public function test_malformed_permissions_fail_closed(): void
    {
        $this->assertSame([], ApiTokenScopeService::normalizeScopes(''));
        $this->assertSame([], ApiTokenScopeService::normalizeScopes('not-json'));
        $this->assertSame([], ApiTokenScopeService::normalizeScopes('{"scopes":"invalid"}'));
        $this->assertFalse(ApiTokenScopeService::routeAllowed('api.v2.tasks.create', 'not-json'));
    }

    public function test_versioned_route_name_matches_unversioned_scope(): void
    {
        $permissions = ['scopes' => ['api.developer-projects.index']];

        $this->assertTrue(ApiTokenScopeService::routeAllowed('api.developer-projects.index.v1', $permissions));
        $this->assertFalse(ApiTokenScopeService::routeAllowed('api.developer-projects.show.v1', $permissions));
    }

    public function test_unnamed_route_is_denied_for_scoped_tokens(): void
    {
        $permissions = ['scopes' => ['api.v2.tasks.create']];

        $this->assertFalse(ApiTokenScopeService::routeAllowed(null, $permissions));
        $this->assertFalse(ApiTokenScopeService::routeAllowed('', $permissions));
    }
}
