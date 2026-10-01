<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\Lead;
use App\Models\Role;
use App\Models\LeadAgent;
use App\Models\User;
use App\Notifications\PartnerInvited;
use App\Support\PartnerRole;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
     * Create a brand-new partner account and tell them how to sign in.
     *
     * The user gets `employee` + `partner` and only the partner role's
     * permissions (PartnerRole). An email that already has an account is
     * refused rather than converted: turning an existing staff user into a
     * partner would be a role change nobody asked for — flag them from the
     * Add Partner picker instead.
     *
     * Sign-in is Keycloak SSO, which this app does not provision. The account
     * here only becomes usable once the same, verified email exists at the
     * identity provider; the invite mail says so.
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

        $companyId = company()->id;
        $partnerRole = PartnerRole::ensureFor($companyId);

        $employeeRole = Role::where('name', 'employee')
            ->where('company_id', $companyId)
            ->first();

        $agent = DB::transaction(function () use ($data, $companyId, $partnerRole, $employeeRole) {
            $user = new User;
            $user->company_id = $companyId;
            $user->name = $data['name'];
            $user->email = $data['email'];
            $user->mobile = $data['mobile'] ?? null;
            // Never used and never shared: sign-in is SSO only.
            $user->password = bcrypt(str()->random(32));
            $user->save();

            if ($employeeRole) {
                $user->attachRole($employeeRole->id);
            }

            $user->attachRole($partnerRole->id);
            $user->assignUserRolePermission($partnerRole->id);

            return LeadAgent::create([
                'company_id' => $companyId,
                'user_id' => $user->id,
                'lead_category_id' => null,
                'added_by' => user()->id,
                'status' => 'enabled',
                'is_partner' => true,
            ]);
        });

        $agent->loadCount('referredLeads')->load('user:id,name,email,image,status');

        $agent->user->notify(new PartnerInvited($agent->user, user()->name));

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
