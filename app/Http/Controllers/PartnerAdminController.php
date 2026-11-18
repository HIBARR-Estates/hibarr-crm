<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Lead;
use App\Models\LeadAgent;
use App\Services\PartnerInviteService;
use Illuminate\Contracts\Cache\LockTimeoutException;
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
    public function __construct(
        private readonly PartnerInviteService $invites,
    ) {
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
            ->with(PartnerInviteService::AGENT_RELATIONS);

        if ($request->filled('search')) {
            $search = $request->get('search');
            $query->whereHas('user', fn ($q) => $q->where('name', 'like', "%{$search}%")
                ->orWhere('email', 'like', "%{$search}%"));
        }

        $agents = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));

        // Users and roles came with the page query; don't load them again per row.
        // One lookup for the page's Keycloak ids, not one per row.
        $keycloakIds = $this->invites->keycloakIdsFor($agents->getCollection());
        $agents->getCollection()->each(fn (LeadAgent $agent) => $this->invites->decorate($agent, $keycloakIds));

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

        try {
            $this->invites->add($agent);
        } catch (LockTimeoutException) {
            return Reply::error(__('pages.partners.msg_busy'));
        }
        $this->invites->present($agent);

        return Reply::successWithData(__('messages.recordSaved'), [
            'agent' => $agent,
        ]);
    }

    /**
     * Create a brand-new partner account and tell them how to sign in.
     *
     * The user gets `employee` + `partner` and only the partner role's
     * permissions (PartnerRole). An email that already has an account is
     * refused rather than converted: turning an existing staff user into a
     * partner would be a role change nobody asked for — flag them from the
     * Add Partner picker instead.
     *
     * When crm.partner-keycloak-provision is on, OL provisions a Keycloak
     * identity before the CRM invite mail goes out. On failure the local
     * user is kept in a failed invite state so Resend can retry.
     */
    public function invite(Request $request)
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email:rfc,strict|unique:users,email',
            'mobile' => 'nullable|string|max:50',
        ], [
            'email.unique' => __('messages.duplicateEntryForEmail'),
        ]);

        $result = $this->invites->invite($data, company()->id, user());

        return Reply::successWithData($result['message'], [
            'agent' => $result['agent'],
            'invite_sent' => $result['invite_sent'],
        ]);
    }

    /**
     * Send the invitation again to an account this flow created. Refused for
     * anyone who is also staff: a partner flag on a colleague is not an invite.
     */
    public function resendInvite($id)
    {
        $agent = LeadAgent::where('company_id', company()->id)
            ->where('is_partner', true)
            ->with(['user', 'user.roles'])
            ->findOrFail($id);

        $result = $this->invites->resend($agent, user());

        // The invite status may have changed either way (failed -> invited,
        // or failed again): send the row back so the page can patch it.
        $this->invites->present($agent);

        return $result['ok']
            ? Reply::successWithData($result['message'], ['agent' => $agent])
            : array_merge(Reply::error($result['message']), ['agent' => $agent]);
    }

    /**
     * Remove the partner flag from an agent.
     */
    public function destroy($id)
    {
        $agent = LeadAgent::where('company_id', company()->id)
            ->with('user')
            ->findOrFail($id);

        try {
            $this->invites->destroy($agent);
        } catch (LockTimeoutException) {
            return Reply::error(__('pages.partners.msg_busy'));
        }

        return Reply::success(__('messages.updateSuccess'));
    }
}
