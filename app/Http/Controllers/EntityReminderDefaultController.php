<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\EntityReminderDefault;
use App\Models\ReminderEmailTemplate;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class EntityReminderDefaultController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.reminderDefaults';
        $this->activeSettingMenu = 'reminder_defaults';

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index()
    {
        $companyId = (int) company()->id;
        $allowed = EntityReminderDefault::allowedEntityTypes();

        $rows = EntityReminderDefault::query()
            ->where('company_id', $companyId)
            ->whereIn('entity_type', $allowed)
            ->get()
            ->keyBy('entity_type');

        $order = array_flip($allowed);
        $defaults = $rows->sortBy(fn ($row) => $order[$row->entity_type] ?? 999)->values();

        $configured = $defaults->pluck('entity_type')->all();
        $availableToAdd = array_values(array_diff($allowed, $configured));

        $this->defaults = $defaults->map(function (EntityReminderDefault $row) {
            return [
                'id' => $row->id,
                'entity_type' => $row->entity_type,
                'reminders' => EntityReminderDefault::minutesListToOffsets(
                    array_map('intval', $row->reminders ?? [])
                ),
                'is_active' => (bool) $row->is_active,
            ];
        })->all();

        $this->availableToAdd = $availableToAdd;
        $this->entityTypeLabels = collect($allowed)->mapWithKeys(fn ($type) => [
            $type => __('modules.settings.entityTypes.'.$type),
        ])->all();
        $this->fallbackOffsets = EntityReminderDefault::minutesListToOffsets(
            EntityReminderDefault::configDefaultsAsMinutes()
        );

        ReminderEmailTemplate::seedDefaultsForCompany($companyId);
        $this->emailTemplates = ReminderEmailTemplate::mapForCompany($companyId);
        $this->mailEntityTypeLabels = collect(ReminderEmailTemplate::MAIL_ENTITY_TYPES)->mapWithKeys(fn ($type) => [
            $type => __('modules.settings.mailEntityTypes.'.$type),
        ])->all();

        return view('entity-reminder-defaults.index', $this->data);
    }

    public function update(Request $request)
    {
        $allowed = EntityReminderDefault::allowedEntityTypes();

        $validated = $request->validate([
            'entity_type' => ['required', 'string', Rule::in($allowed)],
            'reminders' => 'required|array|min:1|max:20',
            'reminders.*.time' => 'required|integer|min:0',
            'reminders.*.type' => 'required|in:minute,hour,day',
            'is_active' => 'boolean',
        ]);

        $minutes = array_values(array_filter(array_map(
            static fn ($item) => EntityReminderDefault::offsetToMinutes($item),
            $validated['reminders']
        )));

        if ($minutes === []) {
            return Reply::error(__('messages.reminderDefaultsInvalid'));
        }

        $row = EntityReminderDefault::query()->updateOrCreate(
            [
                'company_id' => (int) company()->id,
                'entity_type' => $validated['entity_type'],
            ],
            [
                'reminders' => $minutes,
                'is_active' => $request->boolean('is_active', true),
            ]
        );

        return Reply::successWithData(__('messages.updateSuccess'), [
            'default' => [
                'id' => $row->id,
                'entity_type' => $row->entity_type,
                'reminders' => EntityReminderDefault::minutesListToOffsets($row->reminders ?? []),
                'is_active' => (bool) $row->is_active,
            ],
        ]);
    }

    public function updateEmailTemplates(Request $request)
    {
        $mailTypes = ReminderEmailTemplate::MAIL_ENTITY_TYPES;

        $validated = $request->validate([
            'templates' => 'required|array',
            'templates.*' => ['nullable', 'string', 'max:128'],
        ]);

        $templates = [];
        foreach ($mailTypes as $type) {
            if (! array_key_exists($type, $validated['templates'])) {
                continue;
            }
            $templates[$type] = $validated['templates'][$type];
        }

        if ($templates === []) {
            return Reply::error(__('messages.noRecordFound'));
        }

        ReminderEmailTemplate::syncForCompany((int) company()->id, $templates);

        return Reply::successWithData(__('messages.updateSuccess'), [
            'templates' => ReminderEmailTemplate::mapForCompany((int) company()->id),
        ]);
    }

    public function destroy(string $entityType)
    {
        abort_403(!EntityReminderDefault::isAllowedEntityType($entityType));

        $deleted = EntityReminderDefault::query()
            ->where('company_id', (int) company()->id)
            ->where('entity_type', $entityType)
            ->delete();

        if (!$deleted) {
            return Reply::error(__('messages.noRecordFound'));
        }

        return Reply::success(__('messages.deleteSuccess'));
    }
}
