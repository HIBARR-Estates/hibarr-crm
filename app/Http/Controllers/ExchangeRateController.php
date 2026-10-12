<?php

namespace App\Http\Controllers;

use App\Services\ExchangeRateService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Live reference FX rates for the deal value modal and the payment request
 * modal's preview — see ExchangeRateService for the source and caching.
 *
 * The rate is only ever a *suggestion* on the value modal: the deal snapshots
 * whatever rate is saved, and the field stays editable, so a failure here
 * degrades to "type it yourself" rather than an error.
 */
class ExchangeRateController extends Controller
{
    public function show(Request $request, ExchangeRateService $rates): JsonResponse
    {
        $validated = $request->validate([
            'from' => 'required|string|size:3|alpha',
            'to' => 'required|string|size:3|alpha',
        ]);

        $from = strtoupper($validated['from']);
        $to = strtoupper($validated['to']);

        if ($from === $to) {
            return response()->json(['rate' => 1.0, 'date' => null, 'source' => 'identity']);
        }

        $rate = $rates->rate($from, $to);

        if ($rate === null) {
            return response()->json([
                'rate' => null,
                'message' => 'Live rate unavailable — enter the rate manually.',
            ], 200);
        }

        return response()->json(['rate' => $rate, 'source' => 'frankfurter']);
    }
}
