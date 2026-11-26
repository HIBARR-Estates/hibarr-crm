<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\LeadFieldCatalog;

class LeadFieldApiController extends Controller
{
    /**
     * The lead fields the contact API can write (`lead_fields`), read live from the `leads` table so
     * new columns appear without a code change. System and identity columns are never listed.
     */
    public function index(LeadFieldCatalog $catalog)
    {
        $fields = collect($catalog->all());

        return response()->json([
            'status' => 'success',
            'total' => $fields->count(),
            'data' => $fields->values(),
        ]);
    }
}
