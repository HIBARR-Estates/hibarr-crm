<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Lead;
use App\Models\LeadAgent;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * Manages which agents are flagged as partners — the pool
 * referred_by_agent_id is selected from. Gated by manage_partners,
 * distinct from manage_partner_network (MLM hierarchy admin) and
 * manage_partner_flags (resolving partner flags on leads).
 */
class PartnerAdminController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(!\App\Support\PermissionGates::canManagePartners(user()));

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        $companyId = company()->id;

        $query = LeadAgent::where('company_id', $companyId)
            ->where('is_partner', true)
            ->withCount('referredLeads')
            ->with('user:id,name,email,image,status');

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%"));
        }

        $agents = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));

        return Inertia::render('Partners/Index', [
            'pageTitle' => 'Partners',
            'agents' => [
                'data' => $agents->items(),
                'current_page' => $agents->currentPage(),
                'last_page' => $agents->lastPage(),
                'per_page' => $agents->perPage(),
                'total' => $agents->total(),
                'from' => $agents->firstItem(),
                'to' => $agents->lastItem(),
            ],
            'filters' => $request->only(['search']),
            'stats' => [
                'total_partners' => LeadAgent::where('company_id', $companyId)->where('is_partner', true)->count(),
                'total_referred_leads' => Lead::where('company_id', $companyId)->whereNotNull('referred_by_agent_id')->count(),
                'converted_referred_leads' => Lead::where('company_id', $companyId)
                    ->whereNotNull('referred_by_agent_id')
                    ->whereExists(function ($sub) {
                        $sub->selectRaw('1')->from('deals')
                            ->whereColumn('deals.lead_id', 'leads.id')
                            ->where('deals.outcome_status', 'won');
                    })
                    ->count(),
            ],
        ]);
    }

    /**
     * Flag an existing agent as a partner. This is the only way a partner
     * is added — no inline toggle in the table.
     */
    public function store(Request $request)
    {
        $request->validate([
            'agent_id' => 'required|integer|exists:lead_agents,id',
        ]);

        $agent = LeadAgent::where('company_id', company()->id)
            ->where('id', $request->agent_id)
            ->firstOrFail();

        $agent->update(['is_partner' => true]);
        $agent->loadCount('referredLeads')->load('user:id,name,email,image,status');

        return Reply::successWithData(__('messages.recordSaved'), [
            'agent' => $agent,
        ]);
    }

    /**
     * Remove the partner flag from an agent.
     */
    public function destroy($id)
    {
        $agent = LeadAgent::where('company_id', company()->id)->findOrFail($id);
        $agent->update(['is_partner' => false]);

        return Reply::success(__('messages.updateSuccess'));
    }
}
