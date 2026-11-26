<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\LeadAssignmentPool;
use App\Models\User;
use App\Support\AutomationV2Feature;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * CRUD for lead assignment pools (Settings > Automation > Assignment pools): the groups of users the
 * assign_lead_owner action hands leads to in turn. JSON only; the screen lives in the Automation
 * settings workspace.
 */
class LeadAssignmentPoolController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.automation.assignmentPools';
        $this->middleware(function ($request, $next) {
            abort_403(! AutomationV2Feature::enabled());

            // JSON only: a refusal is a 403 the client can show, not a redirect it would follow to an HTML page.
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        if (! ($request->wantsJson() || $request->expectsJson())) {
            return redirect()->route('settings-automation.index');
        }

        $pools = LeadAssignmentPool::with('members')->orderBy('name')->get();
        $names = User::withoutGlobalScopes()
            ->where('company_id', company()->id)
            ->whereIn('id', $pools->flatMap(fn ($pool) => $pool->members->pluck('user_id'))->unique())
            ->pluck('name', 'id');

        return Reply::dataOnly([
            'status' => 'success',
            'data' => $pools->map(fn (LeadAssignmentPool $pool) => $this->present($pool, $names))->values(),
        ]);
    }

    public function store(Request $request)
    {
        $request->validate($this->rules());

        $pool = DB::transaction(function () use ($request) {
            $pool = LeadAssignmentPool::create([
                'company_id' => company()->id,
                'name' => trim($request->name),
                'strategy' => LeadAssignmentPool::STRATEGY_ROUND_ROBIN,
                'active' => $request->boolean('active', true),
            ]);
            $this->syncMembers($pool, (array) $request->input('members', []));

            return $pool;
        });

        return Reply::successWithData(__('messages.recordSaved'), ['data' => $this->presentFresh($pool)]);
    }

    public function update(Request $request, $id)
    {
        $request->validate($this->rules());

        $pool = LeadAssignmentPool::findOrFail($id);

        DB::transaction(function () use ($request, $pool) {
            $pool->update([
                'name' => trim($request->name),
                'active' => $request->boolean('active', true),
            ]);
            $this->syncMembers($pool, (array) $request->input('members', []));
        });

        return Reply::successWithData(__('messages.updateSuccess'), ['data' => $this->presentFresh($pool)]);
    }

    public function destroy($id)
    {
        $pool = LeadAssignmentPool::findOrFail($id);
        $pool->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    /**
     * Existing members are updated in place and only removed members are deleted, so a member keeps
     * its id (and the pool's round-robin cursor, which points at one) across edits.
     *
     * @param  array<int, array{user_id?: int|string, active?: bool}>  $members
     */
    private function syncMembers(LeadAssignmentPool $pool, array $members): void
    {
        $wanted = collect($members)
            ->filter(fn ($member) => ! empty($member['user_id']))
            ->keyBy(fn ($member) => (int) $member['user_id']);

        $pool->members()->whereNotIn('user_id', $wanted->keys())->delete();

        foreach ($wanted as $userId => $member) {
            $pool->members()->updateOrCreate(
                ['user_id' => $userId],
                ['active' => (bool) ($member['active'] ?? true)]
            );
        }

        // The cursor pointed at a member that is gone: start the rotation over.
        if ($pool->last_member_id && ! $pool->members()->whereKey($pool->last_member_id)->exists()) {
            $pool->update(['last_member_id' => null]);
        }
    }

    /** @return array<string, mixed> */
    private function rules(): array
    {
        return [
            'name' => 'required|string|max:191',
            'active' => 'nullable|boolean',
            'members' => 'nullable|array',
            'members.*.user_id' => ['required', 'integer', Rule::exists('users', 'id')->where('company_id', company()->id)],
            'members.*.active' => 'nullable|boolean',
        ];
    }

    private function presentFresh(LeadAssignmentPool $pool): array
    {
        $pool = $pool->fresh('members');
        $names = User::withoutGlobalScopes()->where('company_id', company()->id)->whereIn('id', $pool->members->pluck('user_id'))->pluck('name', 'id');

        return $this->present($pool, $names);
    }

    /**
     * @param  \Illuminate\Support\Collection<int, string>  $names
     * @return array<string, mixed>
     */
    private function present(LeadAssignmentPool $pool, $names): array
    {
        return [
            'id' => $pool->id,
            'name' => $pool->name,
            'strategy' => $pool->strategy,
            'active' => $pool->active,
            'members' => $pool->members->map(fn ($member) => [
                'user_id' => $member->user_id,
                'name' => $names[$member->user_id] ?? "#{$member->user_id}",
                'active' => $member->active,
            ])->values(),
        ];
    }
}
