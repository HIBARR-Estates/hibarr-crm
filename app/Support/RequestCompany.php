<?php

namespace App\Support;

use Illuminate\Http\Request;

/**
 * The company an API request acts for, derived server-side. A signed-in user
 * always acts for their own company; otherwise only the company ApiTokenAuth
 * bound from the token counts. A client-sent X-COMPANY-ID header on its own
 * is never trusted.
 */
class RequestCompany
{
    public const TOKEN_COMPANY_ATTRIBUTE = 'api_token_company_id';

    public static function id(Request $request): ?int
    {
        $user = $request->user();

        if ($user) {
            return $user->company_id ? (int) $user->company_id : null;
        }

        $tokenCompanyId = $request->attributes->get(self::TOKEN_COMPANY_ATTRIBUTE);

        return $tokenCompanyId ? (int) $tokenCompanyId : null;
    }
}
