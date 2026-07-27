<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\UserProductTour;
use Illuminate\Http\JsonResponse;

class ProductTourController extends AccountBaseController
{
    /**
     * Mark a guided product tour as seen for the current user. Fired once
     * when a tour is finished or explicitly skipped — never per step, and
     * never by a manual "replay" (replaying doesn't touch seen-state).
     */
    public function markSeen(string $tourId): JsonResponse
    {
        $tourId = trim($tourId);

        if ($tourId === '') {
            return response()->json(Reply::error('Invalid tour id.'), 400);
        }

        UserProductTour::markSeen(user()->id, $tourId, company()->id ?? null);

        return response()->json(Reply::success('messages.recordSaved'));
    }
}
