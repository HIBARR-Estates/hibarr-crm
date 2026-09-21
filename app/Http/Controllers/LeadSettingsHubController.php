<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\LeadSetting\StoreLeadLifecycleStatus;
use App\Http\Requests\LeadSetting\UpdateLeadLifecycleStatus;
use App\Models\LeadLifecycleStatus;
use App\Models\LeadSetting;
use App\Models\LeadSource;
use App\Services\Dashboard\DashboardMetricsService;
use App\Services\LeadLifecycleStatusService;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;

/**
 * React lead settings hub on the admin settings overview.
 *
 * Sources, lead statuses (contact lifecycles), and first-contact SLA live
 * here; more lead settings will move here from the legacy Blade screens.
 * Both UIs write the same tables.
 */
class LeadSettingsHubController extends AccountBaseController
{
    public function __construct(
        private readonly LeadLifecycleStatusService $lifecycleStatusService,
    ) {
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
            'leadStatuses' => $this->lifecycleStatusService
                ->listForCompany((int) company()->id)
                ->map(fn (LeadLifecycleStatus $status) => $this->serializeStatus($status))
                ->values()
                ->all(),
            'currentUserId' => (int) user()->id,
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'first_contact_sla_seconds' => [
                'required',
                'integer',
                'min:'.DashboardMetricsService::SLA_SECONDS_MIN,
                'max:'.DashboardMetricsService::SLA_SECONDS_MAX,
            ],
        ]);

        LeadSetting::persistFirstContactSlaSeconds(
            (int) $validated['first_contact_sla_seconds'],
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

    public function updateSource(Request $request, int $source)
    {
        $model = LeadSource::findOrFail($source);
        abort_403(! $this->canEditSource($model));

        $validated = $request->validate([
            'type' => 'required|unique:lead_sources,type,'.$model->id.',id,company_id,'.company()->id,
        ]);

        $model->type = $validated['type'];
        $model->save();

        return response()->json(Reply::successWithData(__('messages.updateSuccess'), [
            'source' => $this->serializeSource($model->fresh()),
        ]));
    }

    public function destroySource(int $source)
    {
        $model = LeadSource::findOrFail($source);
        abort_403(! $this->canDeleteSource($model));

        $model->delete();

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

    public function storeStatus(StoreLeadLifecycleStatus $request)
    {
        $status = $this->lifecycleStatusService->create(
            (int) company()->id,
            $request->validated(),
        );

        return response()->json(Reply::successWithData(__('messages.recordSaved'), [
            'lead_status' => $this->serializeStatus($status),
        ]));
    }

    public function updateStatus(UpdateLeadLifecycleStatus $request, int $status)
    {
        $model = LeadLifecycleStatus::findOrFail($status);
        $updated = $this->lifecycleStatusService->update($model, $request->validated());

        return response()->json(Reply::successWithData(__('messages.updateSuccess'), [
            'lead_status' => $this->serializeStatus($updated),
        ]));
    }

    public function destroyStatus(int $status)
    {
        $model = LeadLifecycleStatus::findOrFail($status);

        try {
            $this->lifecycleStatusService->delete($model);
        } catch (\InvalidArgumentException $exception) {
            throw ValidationException::withMessages([
                'status' => [$exception->getMessage()],
            ]);
        }

        return response()->json(Reply::success(__('messages.deleteSuccess')));
    }

    public function reorderStatuses(Request $request)
    {
        $validated = $request->validate([
            'statusIds' => 'required|array',
            'statusIds.*' => 'required|integer',
        ]);

        try {
            $statuses = $this->lifecycleStatusService->reorder(
                (int) company()->id,
                array_map('intval', $validated['statusIds']),
            );
        } catch (\InvalidArgumentException $exception) {
            return response()->json(['message' => $exception->getMessage()], 400);
        }

        return response()->json(Reply::successWithData(__('messages.updateSuccess'), [
            'lead_statuses' => $statuses
                ->map(fn (LeadLifecycleStatus $status) => $this->serializeStatus($status))
                ->values()
                ->all(),
        ]));
    }

    /**
     * @return array{first_contact_sla_seconds: int, min_seconds: int, max_seconds: int, default_seconds: int}
     */
    private function settingsData(): array
    {
        return [
            'first_contact_sla_seconds' => DashboardMetricsService::clampSlaSeconds(
                LeadSetting::value('first_contact_sla_seconds'),
            ),
            'min_seconds' => DashboardMetricsService::SLA_SECONDS_MIN,
            'max_seconds' => DashboardMetricsService::SLA_SECONDS_MAX,
            'default_seconds' => DashboardMetricsService::SLA_SECONDS_DEFAULT,
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

    /**
     * @return array{id: int, key: string, label: string, description: string|null, sort_order: int, label_color: string, leads_count: int, is_system: bool, is_default: bool}
     */
    private function serializeStatus(LeadLifecycleStatus $status): array
    {
        if (! array_key_exists('leads_count', $status->getAttributes())) {
            $status->loadCount('leads');
        }

        return [
            'id' => (int) $status->id,
            'key' => (string) $status->key,
            'label' => (string) $status->label,
            'description' => $status->description !== null ? (string) $status->description : null,
            'sort_order' => (int) $status->sort_order,
            'label_color' => (string) ($status->label_color ?: '#6c757d'),
            'leads_count' => (int) $status->leads_count,
            'is_system' => $status->isSystemKey(),
            'is_default' => $status->isDefaultForNewLeads(),
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
