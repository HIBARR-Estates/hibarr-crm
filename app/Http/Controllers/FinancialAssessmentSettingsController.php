<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Services\FinancialAssessment\FinancialAssessmentSettingsService;
use App\Support\FeatureFlags;
use Illuminate\Http\Request;

/**
 * JSON endpoints behind the "Financial assessments" tab of the lead settings
 * hub. Same access rule as the hub itself (admins who manage lead settings),
 * and invisible (404) while the feature flag is off.
 */
class FinancialAssessmentSettingsController extends AccountBaseController
{
    public function __construct(private readonly FinancialAssessmentSettingsService $settings)
    {
        parent::__construct();
        $this->middleware(function ($request, $next) {
            abort_403(! (user()->permission('manage_lead_setting') == 'all' && in_array('leads', user_modules())));
            abort_if(! FeatureFlags::enabled('crm.lead-financial-assessments'), 404);

            return $next($request);
        });
    }

    public function storeKind(Request $request)
    {
        $data = $request->validate([
            'label' => 'required|string|max:120',
            'role' => 'required|string',
        ]);

        return $this->saved(['kind' => $this->settings->createKind((int) company()->id, $data['label'], $data['role'])]);
    }

    public function updateKind(Request $request, int $kind)
    {
        $data = $request->validate([
            'label' => 'sometimes|string|max:120',
            'is_active' => 'sometimes|boolean',
        ]);

        return $this->updated(['kind' => $this->settings->updateKind((int) company()->id, $kind, $data)]);
    }

    public function storeType(Request $request)
    {
        $data = $request->validate([
            'kind_id' => 'required|integer',
            'label' => 'required|string|max:120',
            'default_frequency' => 'nullable|string',
            'default_certainty' => 'nullable|string',
        ]);

        return $this->saved(['type' => $this->settings->createType(
            (int) company()->id,
            (int) $data['kind_id'],
            $data['label'],
            $data['default_frequency'] ?? null,
            $data['default_certainty'] ?? null,
        )]);
    }

    public function updateType(Request $request, int $type)
    {
        $data = $request->validate([
            'label' => 'sometimes|string|max:120',
            'default_frequency' => 'sometimes|nullable|string',
            'default_certainty' => 'sometimes|nullable|string',
            'is_active' => 'sometimes|boolean',
        ]);

        return $this->updated(['type' => $this->settings->updateType((int) company()->id, $type, $data)]);
    }

    public function storeCryptoAsset(Request $request)
    {
        $data = $request->validate([
            'ticker' => 'required|string|max:10',
            'provider_id' => 'required|string|max:120',
            'name' => 'required|string|max:120',
        ]);

        return $this->saved(['asset' => $this->settings->createCryptoAsset((int) company()->id, $data['ticker'], $data['provider_id'], $data['name'])]);
    }

    public function updateCryptoAsset(Request $request, int $asset)
    {
        $data = $request->validate([
            'provider_id' => 'sometimes|string|max:120',
            'name' => 'sometimes|string|max:120',
            'is_active' => 'sometimes|boolean',
        ]);

        return $this->updated(['asset' => $this->settings->updateCryptoAsset((int) company()->id, $asset, $data)]);
    }

    public function testRates()
    {
        return response()->json(Reply::successWithData('', ['result' => $this->settings->testRateFetch((int) company()->id)]));
    }

    public function updateDefaults(Request $request)
    {
        $data = $request->validate([
            'reporting_currency' => 'required|string|size:3',
            'refresh_after_days' => 'required|integer',
        ]);

        return $this->updated(['defaults' => $this->settings->updateDefaults(
            (int) company()->id,
            (int) user()->id,
            $data['reporting_currency'],
            $data['refresh_after_days'],
        )]);
    }

    private function saved(array $data)
    {
        return response()->json(Reply::successWithData(__('messages.recordSaved'), $data));
    }

    private function updated(array $data)
    {
        return response()->json(Reply::successWithData(__('messages.updateSuccess'), $data));
    }
}
