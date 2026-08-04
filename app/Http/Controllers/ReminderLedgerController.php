<?php

namespace App\Http\Controllers;

use App\Models\Reminder;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ReminderLedgerController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'app.menu.reminderLedger';
        $this->activeSettingMenu = 'reminder_ledger';

        $this->middleware(function ($request, $next) {
            abort_403(user()->permission('manage_company_setting') !== 'all');

            return $next($request);
        });
    }

    public function index(Request $request)
    {
        $companyId = (int) company()->id;

        $statuses = [
            Reminder::STATUS_PENDING,
            Reminder::STATUS_SCHEDULED,
            Reminder::STATUS_SENDING,
            Reminder::STATUS_SENT,
            Reminder::STATUS_FAILED,
            Reminder::STATUS_CANCELLED,
        ];

        $entityTypes = [
            Reminder::ENTITY_MEETING,
            Reminder::ENTITY_TASK,
            Reminder::ENTITY_DEAL_NOTE,
            Reminder::ENTITY_LEAD_NOTE,
            Reminder::ENTITY_DEAL,
            Reminder::ENTITY_LEAD,
            Reminder::ENTITY_PROPERTY,
            Reminder::ENTITY_DEVELOPER_PROJECT,
            Reminder::ENTITY_UNIT,
            Reminder::ENTITY_FLIGHT_ITINERARY,
        ];

        $perPageOptions = [25, 50, 100];

        $validated = $request->validate([
            'status' => ['nullable', 'string', Rule::in($statuses)],
            'entity_type' => ['nullable', 'string', Rule::in($entityTypes)],
            'search' => ['nullable', 'string', 'max:191'],
            'date_from' => ['nullable', 'date'],
            'date_to' => ['nullable', 'date', 'after_or_equal:date_from'],
            'per_page' => ['nullable', 'integer', Rule::in($perPageOptions)],
        ]);

        $status = $validated['status'] ?? null;
        $entityType = $validated['entity_type'] ?? null;
        $search = isset($validated['search']) ? trim((string) $validated['search']) : '';
        $dateFrom = $validated['date_from'] ?? null;
        $dateTo = $validated['date_to'] ?? null;
        $perPage = (int) ($validated['per_page'] ?? 25);

        $query = Reminder::query()
            ->where('company_id', $companyId)
            ->orderByDesc('remind_at')
            ->orderByDesc('id');

        if ($status) {
            $query->where('status', $status);
        }

        if ($entityType) {
            $query->where('entity_type', $entityType);
        }

        if ($search !== '') {
            $query->where(function ($q) use ($search) {
                $q->where('recipient_email', 'like', '%'.$search.'%')
                    ->orWhere('message', 'like', '%'.$search.'%')
                    ->orWhere('last_error', 'like', '%'.$search.'%');

                if (ctype_digit($search)) {
                    $q->orWhere('id', (int) $search)
                        ->orWhere('entity_id', (int) $search);
                }
            });
        }

        if ($dateFrom) {
            $query->whereDate('remind_at', '>=', $dateFrom);
        }

        if ($dateTo) {
            $query->whereDate('remind_at', '<=', $dateTo);
        }

        $this->reminders = $query->paginate($perPage)->withQueryString();
        $this->filters = [
            'status' => $status,
            'entity_type' => $entityType,
            'search' => $search,
            'date_from' => $dateFrom,
            'date_to' => $dateTo,
            'per_page' => $perPage,
        ];
        $this->statuses = $statuses;
        $this->entityTypes = $entityTypes;
        $this->perPageOptions = $perPageOptions;
        $this->statusCounts = Reminder::query()
            ->where('company_id', $companyId)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->all();

        return view('reminder-ledger.index', $this->data);
    }
}
