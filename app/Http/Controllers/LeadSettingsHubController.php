<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\LeadSetting;
use App\Models\LeadSource;
use App\Services\Dashboard\DashboardMetricsService;
use Illuminate\Http\Request;
use Inertia\Inertia;

/**
 * React lead settings hub on the admin settings overview.
 *
 * First-contact SLA and lead sources live here; more lead settings will move
 * here from the legacy Blade screens. Sources and the SLA column are still
 * editable from the Blade lead-settings tabs; both UIs write the same tables.
 */
class LeadSettingsHubController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.leadSettings';
        $this->activeSettingMenu = 'lead_settings';
        $this->middleware(function ($request, $next) {
            abort_403(! (user()->permission('manage_lead_setting') == 'all' && in_array('leads', user_modules())));

            return $next($request);
        });
    }

    public function page()
    {
        $editPermission = user()->permission('edit_lead_sources');
        $deletePermission = user()->permission('delete_lead_sources');

        return Inertia::render('Settings/Leads/Index', [
            'pageTitle' => __('app.menu.leadSettings'),
            'settings' => $this->settingsData(),
            'sources' => LeadSource::query()
                ->get()
                ->map(fn (LeadSource $source) => $this->serializeSource($source))
                ->values()
                ->all(),
            'sourcePermissions' => [
                'add' => in_array(user()->permission('add_lead_sources'), ['all', 'added'], true),
                'edit' => $editPermission,
                'delete' => $deletePermission,
                'reorder' => $editPermission === 'all',
            ],
            'currentUserId' => (int) user()->id,
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'first_contact_sla_hours' => [
                'required',
                'integer',
                'min:'.DashboardMetricsService::SLA_HOURS_MIN,
                'max:'.DashboardMetricsService::SLA_HOURS_MAX,
            ],
        ]);

        LeadSetting::persistFirstContactSlaHours(
            (int) $validated['first_contact_sla_hours'],
            (int) user()->id,
        );

        return response()->json(Reply::success(__('messages.updateSuccess')));
    }

    public function storeSource(Request $request)
    {
        abort_403(! in_array(user()->permission('add_lead_sources'), ['all', 'added'], true));

        $validated = $request->validate([
            'type' => 'required|unique:lead_sources,type,null,id,company_id,'.company()->id,
        ]);

        $source = new LeadSource;
        $source->type = $validated['type'];
        $source->company_id = company()->id;
        $source->save();

        return response()->json(Reply::successWithData(__('messages.recordSaved'), [
            'source' => $this->serializeSource($source),
        ]));
    }

    public function updateSource(Request $request, LeadSource $source)
    {
        abort_403(! $this->canEditSource($source));

        $validated = $request->validate([
            'type' => 'required|unique:lead_sources,type,'.$source->id.',id,company_id,'.company()->id,
        ]);

        $source->type = $validated['type'];
        $source->save();

        return response()->json(Reply::successWithData(__('messages.updateSuccess'), [
            'source' => $this->serializeSource($source->fresh()),
        ]));
    }

    public function destroySource(LeadSource $source)
    {
        abort_403(! $this->canDeleteSource($source));

        $source->delete();

        return response()->json(Reply::success(__('messages.deleteSuccess')));
    }

    public function reorderSources(Request $request)
    {
        abort_403(user()->permission('edit_lead_sources') !== 'all');

        $validated = $request->validate([
            'sourceIds' => 'required|array',
            'sourceIds.*' => 'required|integer',
        ]);

        $sourceIds = array_map('intval', $validated['sourceIds']);
        $existingIds = LeadSource::query()->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (array_diff($sourceIds, $existingIds) !== []) {
            return response()->json(['message' => 'One or more source IDs not found.'], 404);
        }

        if (array_diff($existingIds, $sourceIds) !== []) {
            return response()->json(['message' => 'Not all existing source IDs were provided.'], 400);
        }

        foreach ($sourceIds as $index => $id) {
            LeadSource::where('id', $id)->update(['sort_order' => $index + 1]);
        }

        $sources = LeadSource::query()
            ->get()
            ->map(fn (LeadSource $source) => $this->serializeSource($source))
            ->values()
            ->all();

        return response()->json(Reply::successWithData(__('messages.updateSuccess'), [
            'sources' => $sources,
        ]));
    }

    /**
     * @return array{first_contact_sla_hours: int, min_hours: int, max_hours: int, default_hours: int}
     */
    private function settingsData(): array
    {
        return [
            'first_contact_sla_hours' => DashboardMetricsService::clampSlaHours(
                LeadSetting::value('first_contact_sla_hours'),
            ),
            'min_hours' => DashboardMetricsService::SLA_HOURS_MIN,
            'max_hours' => DashboardMetricsService::SLA_HOURS_MAX,
            'default_hours' => DashboardMetricsService::SLA_HOURS_DEFAULT,
        ];
    }

    /**
     * @return array{id: int, type: string, sort_order: int, added_by: int|null}
     */
    private function serializeSource(LeadSource $source): array
    {
        return [
            'id' => (int) $source->id,
            'type' => (string) $source->type,
            'sort_order' => (int) $source->sort_order,
            'added_by' => $source->added_by !== null ? (int) $source->added_by : null,
        ];
    }

    private function canEditSource(LeadSource $source): bool
    {
        $permission = user()->permission('edit_lead_sources');

        return $permission === 'all'
            || ($permission === 'added' && (int) $source->added_by === (int) user()->id);
    }

    private function canDeleteSource(LeadSource $source): bool
    {
        $permission = user()->permission('delete_lead_sources');

        return $permission === 'all'
            || ($permission === 'added' && (int) $source->added_by === (int) user()->id);
    }
}
