<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LeadFieldCatalog;
use App\Support\RequestCompany;
use Illuminate\Http\Request;

class LeadFieldApiController extends Controller
{
    /**
     * The lead fields the contact API can write (`lead_fields`), read live from the `leads` table so
     * new columns appear without a code change. System and identity columns are never listed.
     *
     * When the financial assessments feature is on, the company's assessment fields are listed too
     * (group `financial_assessment`): writable `assessment.{type}` line fields and read-only
     * `assessment.metric.*` figures. They depend on the company's configured line types, so the
     * company is taken from the validated API token, never from a client-sent value.
     */
    public function index(Request $request, LeadFieldCatalog $catalog)
    {
        $companyId = RequestCompany::id($request);

        $fields = collect($companyId ? $catalog->allForCompany($companyId) : $catalog->all());

        return response()->json([
            'status' => 'success',
            'total' => $fields->count(),
            'data' => $fields->values(),
        ]);
    }
}
