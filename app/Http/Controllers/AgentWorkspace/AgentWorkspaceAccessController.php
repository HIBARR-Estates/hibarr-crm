<?php

namespace App\Http\Controllers\AgentWorkspace;

use App\Helper\Reply;
use App\Http\Controllers\AccountBaseController;
use App\Models\AgentWorkspaceAccessEntry;
use App\Models\LeadAgent;
use App\Models\User;
use App\Scopes\ActiveScope;
use App\Support\AgentWorkspaceAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

/**
 * Settings → Agent workspace access. Lead agents get the workspace by
 * default; this list holds the exceptions: "allow" for someone who is not a
 * lead agent, "block" for a lead agent who should not have it. Admins only,
 * and the page does not exist while crm.agent-workspace is off.
 */
class AgentWorkspaceAccessController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'pages.agent_workspace.access.title';

        $this->middleware(function ($request, $next) {
            self::ensureAllowed();

            return $next($request);
        });
    }

    /** Flag on and an admin; anything else is as if the page were not there. */
    public static function ensureAllowed(): void
    {
        abort_unless(AgentWorkspaceAccess::enabled(), 404);
        abort_403(! in_array('admin', user_roles()));
    }

    public function index()
    {
        return Inertia::render('Settings/AgentWorkspaceAccess', [
            'pageTitle' => __('pages.agent_workspace.access.title'),
            'entries' => $this->entries(),
            'defaultMemberCount' => $this->defaultMemberCount(),
            // Everyone who could be added; only needed once the picker opens.
            'people' => Inertia::defer(fn () => User::withoutGlobalScope(ActiveScope::class)
                ->where('company_id', company()->id)
                ->where('status', 'active')
                ->orderBy('name')
                ->get(['id', 'name', 'email', 'image'])
                ->map(fn (User $user) => [
                    'id' => (int) $user->id,
                    'name' => $user->name,
                    'designation' => $user->email,
                    'image' => $user->image_url,
                ])
                ->values()),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where('company_id', company()->id),
            ],
            'access' => ['required', Rule::in(AgentWorkspaceAccessEntry::ACCESS_VALUES)],
        ]);

        AgentWorkspaceAccessEntry::query()->updateOrCreate(
            ['company_id' => company()->id, 'user_id' => (int) $data['user_id']],
            ['access' => $data['access'], 'added_by' => user()->id],
        );

        return Reply::successWithData(__('messages.recordSaved'), ['entries' => $this->entries()]);
    }

    public function destroy(int $userId)
    {
        AgentWorkspaceAccessEntry::query()
            ->where('company_id', company()->id)
            ->where('user_id', $userId)
            ->delete();

        return Reply::successWithData(__('messages.deleteSuccess'), ['entries' => $this->entries()]);
    }

    /**
     * @return list<array{user_id: int, name: string, email: string|null, image: string|null, active: bool, access: string, lead_agent: bool, added_by_name: string|null, updated_at: string|null}>
     */
    private function entries(): array
    {
        /** @var \Illuminate\Database\Eloquent\Collection<int, AgentWorkspaceAccessEntry> $rows */
        $rows = AgentWorkspaceAccessEntry::query()
            ->where('company_id', company()->id)
            ->with(['user:id,name,email,image,status', 'addedBy:id,name'])
            ->get();

        $leadAgentIds = LeadAgent::query()
            ->withoutGlobalScopes()
            ->whereIn('user_id', $rows->pluck('user_id'))
            ->where('status', 'enabled')
            ->where('is_partner', false)
            ->pluck('user_id')
            ->map(fn ($id) => (int) $id)
            ->all();

        return $rows
            ->filter(fn (AgentWorkspaceAccessEntry $entry) => $entry->user !== null)
            ->sortBy(fn (AgentWorkspaceAccessEntry $entry) => mb_strtolower($entry->user->name))
            ->map(fn (AgentWorkspaceAccessEntry $entry) => [
                'user_id' => (int) $entry->user_id,
                'name' => $entry->user->name,
                'email' => $entry->user->email,
                'image' => $entry->user->image_url,
                'active' => $entry->user->status === 'active',
                'access' => $entry->access,
                'lead_agent' => in_array((int) $entry->user_id, $leadAgentIds, true),
                'added_by_name' => $entry->addedBy?->name,
                'updated_at' => $entry->updated_at?->toIso8601String(),
            ])
            ->values()
            ->all();
    }

    /** Enabled, non-partner lead agents in the company: who has access with no entry. */
    private function defaultMemberCount(): int
    {
        return LeadAgent::query()
            ->withoutGlobalScopes()
            ->where('company_id', company()->id)
            ->where('status', 'enabled')
            ->where('is_partner', false)
            ->distinct()
            ->count('user_id');
    }
}
