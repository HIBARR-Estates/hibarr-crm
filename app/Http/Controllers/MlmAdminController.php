<?php

namespace App\Http\Controllers;

use App\Enums\MlmCommissionStatus;
use App\Models\AgentLevelHistory;
use App\Models\AgentMetric;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmLevel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class MlmAdminController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * MLM Admin Dashboard
     */
    public function dashboard()
    {
        $companyId = company()->id;

        $stats = [
            'total_agents' => LeadAgent::where('company_id', $companyId)->count(),
            'total_deals_won' => \App\Models\Deal::where('company_id', $companyId)->whereNotNull('close_date')->count(),
            'total_commissions_paid' => (float) MlmCommission::where('company_id', $companyId)->where('status', MlmCommissionStatus::Paid->value)->sum('amount'),
            'pending_commissions' => (float) MlmCommission::where('company_id', $companyId)->where('status', MlmCommissionStatus::Pending->value)->sum('amount'),
        ];

        return Inertia::render('Mlm/Admin/Dashboard', [
            'stats' => $stats,
        ]);
    }

    /**
     * MLM Levels Management
     */
    public function levels()
    {
        $levels = MlmLevel::where('company_id', company()->id)
            ->ordered()
            ->with('criteria')
            ->get();

        return Inertia::render('Mlm/Admin/Levels', [
            'levels' => $levels,
        ]);
    }

    /**
     * Level Qualification Rules
     */
    public function levelRules(Request $request, $level)
    {
        $mlmLevel = MlmLevel::where('company_id', company()->id)
            ->with('criteria')
            ->findOrFail($level);

        return Inertia::render('Mlm/Admin/LevelRules', [
            'level' => $mlmLevel,
            'criteria' => $mlmLevel->criteria ?? [],
        ]);
    }

    /**
     * Commission Settings
     */
    public function commissionSettings()
    {
        return Inertia::render('Mlm/Admin/CommissionSettings', [
            'settings' => [
                'max_commission_percentage' => (float) config('mlm.max_commission_percentage'),
                'auto_evaluate_ancestors' => (bool) config('mlm.auto_evaluate_ancestors'),
                'enable_commission_reversal' => true,
            ],
            'agents' => LeadAgent::where('company_id', company()->id)
            ->with('user:id,name,email,image')
            ->get()
            ->map(fn ($a) => [
                'id' => $a->id,
                'name' => $a->user?->name ?? 'Unknown',
                'email' => $a->user?->email,
            ]),
        ]);
    }

    /**
     * Agent Hierarchy
     */
    public function agentHierarchy()
    {
        return Inertia::render('Mlm/Admin/AgentHierarchy', [
            'agents' => LeadAgent::where('company_id', company()->id)
                ->with('user:id,name,email,image')
                ->get()
                ->map(fn ($a) => [
                    'id' => $a->id,
                    'name' => $a->user?->name ?? 'Unknown',
                    'email' => $a->user?->email,
                ]),
        ]);
    }

    /**
     * Commission Ledger
     */
    public function commissionLedger()
    {
        return Inertia::render('Mlm/Admin/CommissionLedger', [
            'agents' => LeadAgent::where('company_id', company()->id)
                ->with('user:id,name')
                ->get()
                ->map(fn ($a) => ['id' => $a->id, 'name' => $a->user?->name ?? 'Unknown']),
            'levels' => MlmLevel::where('company_id', company()->id)->ordered()->get(['id', 'name']),
        ]);
    }

    /**
     * Agent Metrics
     */
    public function agentMetrics()
    {
        return Inertia::render('Mlm/Admin/AgentMetrics');
    }

    /**
     * Level Assignment History
     */
    public function levelHistory()
    {
        $levels = MlmLevel::where('company_id', company()->id)->ordered()->get(['id', 'name']);
        $agents = LeadAgent::where('company_id', company()->id)
            ->with('user:id,name')
            ->get()
            ->map(fn ($a) => ['id' => $a->id, 'name' => $a->user?->name ?? 'Unknown']);

        return Inertia::render('Mlm/Admin/LevelHistory', [
            'levels' => $levels,
            'agents' => $agents,
        ]);
    }
}
