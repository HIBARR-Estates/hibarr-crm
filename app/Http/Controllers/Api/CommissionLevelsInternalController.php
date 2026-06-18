<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MlmLevel;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommissionLevelsInternalController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $companyId = (int) $request->header('X-COMPANY-ID');

        $levels = MlmLevel::where('company_id', $companyId)
            ->ordered()
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $levels->map(fn (MlmLevel $level) => [
                'id' => $level->id,
                'name' => $level->name,
                'slug' => $level->slug,
                'rank' => $level->rank,
                'commissionPercentage' => (float) $level->commission_percentage,
                'directRate' => (float) ($level->direct_rate ?? $level->commission_percentage),
                'overrideRate' => (float) ($level->override_rate ?? $level->commission_percentage),
                'isHidden' => (bool) $level->is_hidden,
            ])->values(),
        ]);
    }
}
