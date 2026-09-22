<?php

namespace Tests\Unit\Http;

use Tests\TestCase;

class CrmEventTimelineWebRoutesTest extends TestCase
{
    public function test_timeline_json_routes_use_web_auth_not_api_token(): void
    {
        foreach ([
            'crm-events.feed',
            'crm-events.store',
            'crm-events.types',
            'deals.communication-activities',
            'communication-activities.store',
        ] as $name) {
            $route = app('router')->getRoutes()->getByName($name);

            $this->assertNotNull($route, $name.' is not registered');

            $middleware = $route->gatherMiddleware();

            $this->assertContains('web', $middleware, $name);
            $this->assertContains('auth', $middleware, $name);
            $this->assertFalse(
                in_array('api.token.or.session', $middleware, true),
                $name.' should not sit behind the token/session API middleware'
            );
        }
    }
}
