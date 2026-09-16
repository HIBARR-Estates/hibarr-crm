<?php

namespace Tests\Unit\Support;

use App\Models\User;
use App\Support\RequestCompany;
use Illuminate\Http\Request;
use Tests\TestCase;

class RequestCompanyTest extends TestCase
{
    public function test_client_header_alone_is_not_trusted(): void
    {
        $this->assertNull(RequestCompany::id($this->requestWithCompanyHeader('7')));
    }

    public function test_token_bound_company_is_used_instead_of_the_header(): void
    {
        $request = $this->requestWithCompanyHeader('7');
        $request->attributes->set(RequestCompany::TOKEN_COMPANY_ATTRIBUTE, 3);

        $this->assertSame(3, RequestCompany::id($request));
    }

    public function test_session_user_acts_for_their_own_company(): void
    {
        $user = new User();
        $user->setRawAttributes(['id' => 1, 'company_id' => 5]);

        $request = $this->requestWithCompanyHeader('7');
        $request->setUserResolver(fn () => $user);

        $this->assertSame(5, RequestCompany::id($request));
    }

    private function requestWithCompanyHeader(string $companyId): Request
    {
        return Request::create('/api/v1/crm-events', 'GET', [], [], [], ['HTTP_X_COMPANY_ID' => $companyId]);
    }
}
