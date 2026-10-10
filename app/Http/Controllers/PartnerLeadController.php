<?php

namespace App\Http\Controllers;

use App\Services\Partner\PartnerLeadService;
use Illuminate\Http\JsonResponse;
use Inertia\Inertia;

/**
 * A partner's own leads: a list, and one lead in a modal.
 *
 * Gated on view_partner_dashboard and on having a partner agent record. Which
 * leads appear is decided in PartnerLeadService by referred_by_agent_id; a lead
 * that is not the caller's is a 404, not a 403, so its existence is not
 * confirmed either.
 *
 * Mounted under /account/partner/, not /account/leads/: RestrictPartnerAccounts
 * blocks the internal lead pages for partners, and this is deliberately not one
 * of them.
 */
class PartnerLeadController extends AccountBaseController
{
    public function __construct(private PartnerLeadService $leads)
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('view_partner_dashboard') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $agent = $this->leads->agentFor((int) user()->id);

        return Inertia::render('Partner/Leads/Index', [
            'pageTitle' => 'My leads',
            // Deferred like every other panel: the shell paints first.
            'leads' => Inertia::defer(fn () => $agent ? $this->page($this->leads->list($agent)) : null),
            'hasAgent' => (bool) $agent,
        ]);
    }

    /**
     * The paginator as plain fields, like PartnerAdminController: the default
     * serialisation carries pre-rendered pagination links the page never uses.
     *
     * @return array<string, mixed>
     */
    private function page(\Illuminate\Pagination\LengthAwarePaginator $page): array
    {
        return [
            'data' => $page->items(),
            'current_page' => $page->currentPage(),
            'last_page' => $page->lastPage(),
            'per_page' => $page->perPage(),
            'total' => $page->total(),
            'from' => $page->firstItem(),
            'to' => $page->lastItem(),
        ];
    }

    public function show(int $lead): JsonResponse
    {
        $agent = $this->leads->agentFor((int) user()->id);
        $detail = $agent ? $this->leads->detail($agent, $lead) : null;

        abort_if(is_null($detail), 404);

        return response()->json(['data' => $detail]);
    }
}
