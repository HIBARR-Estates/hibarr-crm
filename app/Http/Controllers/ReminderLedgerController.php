<?php

namespace App\Http\Controllers;

use App\Models\Deal;
use App\Models\DealFollowUp;
use App\Models\DealNote;
use App\Models\DeveloperProject;
use App\Models\DeveloperProjectUnitType;
use App\Models\Lead;
use App\Models\LeadFlightItinerary;
use App\Models\LeadNote;
use App\Models\Property;
use App\Models\Reminder;
use App\Models\Task;
use App\Models\User;
use App\Services\Reminders\ReminderSender;
use Carbon\CarbonInterface;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;

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
        $timezone = company()->timezone ?? config('app.timezone');
        $now = Carbon::now($timezone);

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

        $tabs = ['all', 'delayed', 'sent', 'cancelled', 'failed'];
        $dateRanges = ['all', 'today', 'yesterday', '7d', 'custom'];
        $perPageOptions = [25, 50, 100];

        $validated = $request->validate([
            'tab' => ['nullable', 'string', Rule::in($tabs)],
            'entity_type' => ['nullable', 'string', Rule::in(array_merge(['all'], $entityTypes))],
            'search' => ['nullable', 'string', 'max:191'],
            'date_range' => ['nullable', 'string', Rule::in($dateRanges)],
            'custom_date' => ['nullable', 'date_format:Y-m-d'],
            'per_page' => ['nullable', 'integer', Rule::in($perPageOptions)],
        ]);

        $tab = $validated['tab'] ?? 'all';
        $entityType = $validated['entity_type'] ?? 'all';
        $search = isset($validated['search']) ? trim((string) $validated['search']) : '';
        $dateRange = $validated['date_range'] ?? 'all';
        $customDate = $validated['custom_date'] ?? null;
        $perPage = (int) ($validated['per_page'] ?? 25);

        $base = Reminder::query()->where('company_id', $companyId);

        $statusCounts = (clone $base)
            ->selectRaw('status, COUNT(*) as aggregate')
            ->groupBy('status')
            ->pluck('aggregate', 'status')
            ->all();

        $delayedCount = (clone $base)
            ->whereIn('status', [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED, Reminder::STATUS_SENDING])
            ->where('remind_at', '<=', Carbon::now('UTC'))
            ->count();

        $stats = [
            'sent' => (int) ($statusCounts[Reminder::STATUS_SENT] ?? 0),
            'delayed' => $delayedCount,
            'cancelled' => (int) ($statusCounts[Reminder::STATUS_CANCELLED] ?? 0),
            'failed' => (int) ($statusCounts[Reminder::STATUS_FAILED] ?? 0),
        ];

        $query = Reminder::query()
            ->where('company_id', $companyId)
            ->orderByDesc('remind_at')
            ->orderByDesc('id');

        match ($tab) {
            'delayed' => $query
                ->whereIn('status', [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED, Reminder::STATUS_SENDING])
                ->where('remind_at', '<=', Carbon::now('UTC')),
            'sent' => $query->where('status', Reminder::STATUS_SENT),
            'cancelled' => $query->where('status', Reminder::STATUS_CANCELLED),
            'failed' => $query->where('status', Reminder::STATUS_FAILED),
            default => null,
        };

        if ($entityType !== 'all' && $entityType !== '') {
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

        $this->applyDateRangeFilter($query, $dateRange, $customDate, $timezone);

        $reminders = $query->paginate($perPage)->withQueryString();

        $userIds = $reminders->getCollection()
            ->where('recipient_type', Reminder::RECIPIENT_USER)
            ->pluck('recipient_id')
            ->filter()
            ->unique()
            ->values();

        $users = $userIds->isEmpty()
            ? collect()
            : User::query()->whereIn('id', $userIds)->get(['id', 'name', 'email'])->keyBy('id');

        $creatorIds = $reminders->getCollection()->pluck('created_by')->filter()->unique()->values();
        $creators = $creatorIds->isEmpty()
            ? collect()
            : User::query()->whereIn('id', $creatorIds)->get(['id', 'name'])->keyBy('id');

        $entityContexts = $this->loadEntityContexts($reminders->getCollection());
        $groups = $this->buildGroups($reminders->getCollection(), $users, $creators, $entityContexts, $timezone, $now);

        $worstDelayMinutes = $this->worstDelayMinutesToday($companyId, $timezone);
        $showDelayBanner = $delayedCount > 0 || $worstDelayMinutes >= 5;

        $this->groups = $groups;
        $this->reminders = $reminders;
        $this->stats = $stats;
        $this->tabCounts = [
            'all' => array_sum(array_map('intval', $statusCounts)),
            'delayed' => $delayedCount,
            'sent' => $stats['sent'],
            'cancelled' => $stats['cancelled'],
            'failed' => $stats['failed'],
        ];
        $this->filters = [
            'tab' => $tab,
            'entity_type' => $entityType,
            'search' => $search,
            'date_range' => $dateRange,
            'custom_date' => $customDate ?? '',
            'per_page' => $perPage,
        ];
        $this->entityTypes = $entityTypes;
        $this->showDelayBanner = $showDelayBanner;
        $this->delayBannerText = $delayedCount > 0
            ? $delayedCount.' reminder'.($delayedCount === 1 ? '' : 's').' overdue'
            : 'Some reminders were delayed';
        $this->worstDelay = $worstDelayMinutes > 0
            ? $this->formatDuration($worstDelayMinutes)
            : '—';
        $this->hasFilters = $search !== ''
            || ($entityType !== 'all' && $entityType !== '')
            || $tab !== 'all'
            || ($dateRange !== 'all' && $dateRange !== '');
        $this->isEmpty = count($groups) === 0;

        if ($request->header('X-Inertia')) {
            return Inertia::location(route('reminder-ledger.index', $request->query()));
        }

        return view('reminder-ledger.index', $this->data);
    }

    /**
     * Cancel a not-yet-sent reminder.
     */
    public function cancel(Reminder $reminder)
    {
        abort_403((int) $reminder->company_id !== (int) company()->id);

        if (! $reminder->cancel()) {
            return back()->with('error', __('messages.reminderCannotBeCancelled') ?: 'This reminder can no longer be cancelled.');
        }

        return back()->with('success', __('messages.reminderCancelled') ?: 'Reminder cancelled.');
    }

    /**
     * Send a not-yet-sent reminder immediately, ahead of its schedule.
     */
    public function sendNow(Reminder $reminder, ReminderSender $sender)
    {
        abort_403((int) $reminder->company_id !== (int) company()->id);

        if (! in_array($reminder->status, [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED], true)) {
            return back()->with('error', __('messages.reminderCannotBeSent') ?: 'This reminder can no longer be sent manually.');
        }

        $sender->send($reminder);
        $reminder->refresh();

        if ($reminder->status === Reminder::STATUS_FAILED) {
            return back()->with(
                'error',
                $reminder->last_error ?: (__('messages.reminderSendFailed') ?: 'Reminder failed to send.')
            );
        }

        return back()->with('success', __('messages.reminderSent') ?: 'Reminder sent.');
    }

    /**
     * @param  Collection<int, Reminder>  $reminders
     * @param  Collection<int, User>  $users
     * @param  Collection<int, User>  $creators
     * @return array<int, array{label: string, sub: string, rows: array<int, array<string, mixed>>}>
     */
    private function buildGroups(Collection $reminders, Collection $users, Collection $creators, array $entityContexts, string $timezone, CarbonInterface $now): array
    {
        $grouped = [];

        foreach ($reminders as $reminder) {
            $remindAtLocal = $reminder->remind_at?->copy()->timezone($timezone);
            $dayKey = $remindAtLocal?->toDateString() ?? 'unknown';
            $label = $this->dayLabel($remindAtLocal, $now);

            if (! isset($grouped[$dayKey])) {
                $grouped[$dayKey] = [
                    'label' => $label,
                    'rows' => [],
                ];
            }

            $context = $entityContexts[$this->entityContextKey($reminder)] ?? [];
            $grouped[$dayKey]['rows'][] = $this->mapRow($reminder, $users, $creators, $context, $timezone, $now);
        }

        $out = [];
        foreach ($grouped as $group) {
            $count = count($group['rows']);
            $out[] = [
                'label' => $group['label'],
                'sub' => $count.' reminder'.($count === 1 ? '' : 's'),
                'shortSub' => (string) $count,
                'rows' => $group['rows'],
            ];
        }

        return $out;
    }

    /**
     * @param  Collection<int, User>  $users
     * @param  Collection<int, User>  $creators
     * @return array<string, mixed>
     */
    private function mapRow(Reminder $reminder, Collection $users, Collection $creators, array $context, string $timezone, CarbonInterface $now): array
    {
        $user = $reminder->recipient_type === Reminder::RECIPIENT_USER
            ? $users->get($reminder->recipient_id)
            : null;

        $name = $user?->name
            ?: Str::before((string) $reminder->recipient_email, '@')
            ?: 'Recipient';
        $email = (string) ($reminder->recipient_email ?? '');
        $initials = $this->initials($name);
        $avatar = $this->avatarColors($name);

        $chip = $this->entityChip((string) $reminder->entity_type);
        $status = $this->statusMeta((string) $reminder->status, $reminder, $now);
        $delivery = $this->deliveryMeta($reminder, $timezone, $now);

        $remindAtLocal = $reminder->remind_at?->copy()->timezone($timezone);
        $sentAtLocal = $reminder->sent_at?->copy()->timezone($timezone);
        $creator = $reminder->created_by ? $creators->get($reminder->created_by) : null;

        $entityName = (string) ($context['name'] ?? '');
        if ($entityName === '' && $reminder->entity_id) {
            $entityName = '#'.$reminder->entity_id;
        }
        $entityDetail = (string) ($context['detail'] ?? '');
        if ($entityDetail === '' && $reminder->entity_id) {
            $entityDetail = $chip['label'].' #'.$reminder->entity_id;
        }

        $message = trim((string) ($reminder->message ?? ''));
        $about = $message !== '' ? $message : ($entityName !== '' ? $entityName : '—');
        $sub = $entityName !== '' && $message !== ''
            ? $chip['label'].' · '.$entityName
            : ($entityDetail !== '' ? $entityDetail : $chip['label']);

        $subject = $message !== '' ? $message : ($entityName.' reminder');
        $body = $message !== '' ? $message : $entityDetail;

        return [
            'id' => $reminder->id,
            'entityType' => $reminder->entity_type,
            'entityId' => $reminder->entity_id,
            'chipLabel' => $chip['label'],
            'chipBg' => $chip['bg'],
            'chipColor' => $chip['color'],
            'about' => $about,
            'sub' => $sub,
            'entityName' => $entityName,
            'entityDetail' => $entityDetail,
            'subject' => $subject,
            'body' => $body,
            'timeline' => $this->buildTimeline($reminder, $timezone),
            'msg' => $about,
            'name' => $name,
            'email' => $email,
            'initials' => $initials,
            'avatarBg' => $avatar['bg'],
            'avatarColor' => $avatar['color'],
            'timeText' => $remindAtLocal?->format('H:i') ?? '—',
            'remindAtFull' => $remindAtLocal?->format('D, M j, Y \a\t H:i'),
            'sentAtFull' => $sentAtLocal?->format('D, M j, Y \a\t H:i'),
            'deliveryText' => $delivery['text'],
            'deliveryColor' => $delivery['color'],
            'deliveryWeight' => $delivery['weight'],
            'statusLabel' => $status['label'],
            'statusBg' => $status['bg'],
            'statusColor' => $status['color'],
            'dotColor' => $status['dot'],
            'status' => $reminder->status,
            'lastError' => $reminder->last_error,
            'createdBy' => $creator?->name ?? '—',
            'cancellable' => in_array($reminder->status, [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED], true),
            'rowBg' => 'transparent',
        ];
    }

    private function dayLabel(?CarbonInterface $at, CarbonInterface $now): string
    {
        if ($at === null) {
            return 'Unknown';
        }

        if ($at->isSameDay($now)) {
            return 'Today';
        }

        if ($at->isSameDay($now->copy()->subDay())) {
            return 'Yesterday';
        }

        if ($at->isSameDay($now->copy()->addDay())) {
            return 'Tomorrow';
        }

        return $at->format('D, M j, Y');
    }

    /**
     * @return array{label: string, bg: string, color: string}
     */
    private function entityChip(string $entityType): array
    {
        return match ($entityType) {
            Reminder::ENTITY_MEETING => ['label' => 'Meeting', 'bg' => '#eff8ff', 'color' => '#175cd3'],
            Reminder::ENTITY_TASK => ['label' => 'Task', 'bg' => '#f4f3ff', 'color' => '#5925dc'],
            Reminder::ENTITY_DEAL_NOTE, Reminder::ENTITY_LEAD_NOTE => ['label' => 'Note', 'bg' => '#f8f9fc', 'color' => '#363f72'],
            Reminder::ENTITY_DEAL => ['label' => 'Deal', 'bg' => '#ecfdf3', 'color' => '#067647'],
            Reminder::ENTITY_LEAD => ['label' => 'Lead', 'bg' => '#fff6ed', 'color' => '#c4320a'],
            Reminder::ENTITY_PROPERTY => ['label' => 'Property', 'bg' => '#f0f9ff', 'color' => '#026aa2'],
            Reminder::ENTITY_DEVELOPER_PROJECT => ['label' => 'Project', 'bg' => '#fdf2fa', 'color' => '#c11574'],
            Reminder::ENTITY_UNIT => ['label' => 'Unit', 'bg' => '#fef3f2', 'color' => '#b42318'],
            Reminder::ENTITY_FLIGHT_ITINERARY => ['label' => 'Flight', 'bg' => '#eef4ff', 'color' => '#3538cd'],
            default => ['label' => Str::title(str_replace('_', ' ', $entityType)), 'bg' => '#f2f4f7', 'color' => '#344054'],
        };
    }

    /**
     * @return array{label: string, bg: string, color: string, dot: string}
     */
    private function statusMeta(string $status, Reminder $reminder, CarbonInterface $now): array
    {
        $isDelayed = in_array($status, [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED, Reminder::STATUS_SENDING], true)
            && $reminder->remind_at
            && $reminder->remind_at->lessThanOrEqualTo(Carbon::now('UTC'));

        if ($isDelayed) {
            return ['label' => 'Delayed', 'bg' => '#fffaeb', 'color' => '#b54708', 'dot' => '#f79009'];
        }

        return match ($status) {
            Reminder::STATUS_SENT => ['label' => 'Sent', 'bg' => '#ecfdf3', 'color' => '#067647', 'dot' => '#12b76a'],
            Reminder::STATUS_FAILED => ['label' => 'Failed', 'bg' => '#fef3f2', 'color' => '#b42318', 'dot' => '#f04438'],
            Reminder::STATUS_CANCELLED => ['label' => 'Cancelled', 'bg' => '#f2f4f7', 'color' => '#475467', 'dot' => '#98a2b3'],
            Reminder::STATUS_SENDING => ['label' => 'Sending', 'bg' => '#fffaeb', 'color' => '#b54708', 'dot' => '#f79009'],
            Reminder::STATUS_SCHEDULED => ['label' => 'Scheduled', 'bg' => '#eff8ff', 'color' => '#175cd3', 'dot' => '#2e90fa'],
            default => ['label' => 'Pending', 'bg' => '#f8f9fc', 'color' => '#363f72', 'dot' => '#717bbc'],
        };
    }

    /**
     * @return array{text: string, color: string, weight: string}
     */
    private function deliveryMeta(Reminder $reminder, string $timezone, CarbonInterface $now): array
    {
        if ($reminder->status === Reminder::STATUS_FAILED) {
            return ['text' => 'Failed', 'color' => '#b42318', 'weight' => '600'];
        }

        if ($reminder->status === Reminder::STATUS_CANCELLED) {
            return ['text' => '—', 'color' => '#98a2b3', 'weight' => '400'];
        }

        if ($reminder->status === Reminder::STATUS_SENT && $reminder->sent_at && $reminder->remind_at) {
            $lateMinutes = (int) max(0, $reminder->remind_at->diffInMinutes($reminder->sent_at, false));
            if ($lateMinutes <= 1) {
                return ['text' => 'On time', 'color' => '#067647', 'weight' => '500'];
            }

            return [
                'text' => $this->formatDuration($lateMinutes).' late',
                'color' => '#b54708',
                'weight' => '600',
            ];
        }

        if (
            in_array($reminder->status, [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED, Reminder::STATUS_SENDING], true)
            && $reminder->remind_at
            && $reminder->remind_at->lessThanOrEqualTo(Carbon::now('UTC'))
        ) {
            $overdue = (int) max(1, $reminder->remind_at->diffInMinutes(Carbon::now('UTC')));

            return [
                'text' => $this->formatDuration($overdue).' overdue',
                'color' => '#b54708',
                'weight' => '600',
            ];
        }

        $local = $reminder->remind_at?->copy()->timezone($timezone);
        if ($local && $local->greaterThan($now)) {
            return ['text' => 'Queued', 'color' => '#667085', 'weight' => '400'];
        }

        return ['text' => '—', 'color' => '#98a2b3', 'weight' => '400'];
    }

    private function worstDelayMinutesToday(int $companyId, string $timezone): int
    {
        $startUtc = Carbon::now($timezone)->startOfDay()->utc();
        $endUtc = Carbon::now($timezone)->endOfDay()->utc();

        $rows = Reminder::query()
            ->where('company_id', $companyId)
            ->where('status', Reminder::STATUS_SENT)
            ->whereNotNull('sent_at')
            ->whereNotNull('remind_at')
            ->whereBetween('sent_at', [$startUtc, $endUtc])
            ->get(['remind_at', 'sent_at']);

        $worst = 0;
        foreach ($rows as $row) {
            $late = (int) max(0, $row->remind_at->diffInMinutes($row->sent_at, false));
            $worst = max($worst, $late);
        }

        $overdue = Reminder::query()
            ->where('company_id', $companyId)
            ->whereIn('status', [Reminder::STATUS_PENDING, Reminder::STATUS_SCHEDULED, Reminder::STATUS_SENDING])
            ->where('remind_at', '<=', Carbon::now('UTC'))
            ->get(['remind_at']);

        foreach ($overdue as $row) {
            $late = (int) max(0, $row->remind_at->diffInMinutes(Carbon::now('UTC')));
            $worst = max($worst, $late);
        }

        return $worst;
    }

    private function formatDuration(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes.'m';
        }

        $hours = intdiv($minutes, 60);
        $rem = $minutes % 60;
        if ($hours < 24) {
            return $rem > 0 ? "{$hours}h {$rem}m" : "{$hours}h";
        }

        $days = intdiv($hours, 24);
        $h = $hours % 24;

        return $h > 0 ? "{$days}d {$h}h" : "{$days}d";
    }

    private function initials(string $name): string
    {
        $parts = preg_split('/\s+/', trim($name)) ?: [];
        $parts = array_values(array_filter($parts));
        if ($parts === []) {
            return '?';
        }
        if (count($parts) === 1) {
            return Str::upper(Str::substr($parts[0], 0, 2));
        }

        return Str::upper(Str::substr($parts[0], 0, 1).Str::substr($parts[1], 0, 1));
    }

    /**
     * @return array{bg: string, color: string}
     */
    private function avatarColors(string $seed): array
    {
        $palette = [
            ['bg' => '#eff8ff', 'color' => '#175cd3'],
            ['bg' => '#f4f3ff', 'color' => '#5925dc'],
            ['bg' => '#ecfdf3', 'color' => '#067647'],
            ['bg' => '#fff6ed', 'color' => '#c4320a'],
            ['bg' => '#fdf2fa', 'color' => '#c11574'],
            ['bg' => '#eef4ff', 'color' => '#3538cd'],
        ];

        $idx = abs(crc32($seed)) % count($palette);

        return $palette[$idx];
    }

    private function applyDateRangeFilter($query, string $dateRange, ?string $customDate, string $timezone): void
    {
        if ($dateRange === 'all' || $dateRange === '') {
            return;
        }

        $now = Carbon::now($timezone);

        if ($dateRange === 'today') {
            $query->whereBetween('remind_at', [
                $now->copy()->startOfDay()->utc(),
                $now->copy()->endOfDay()->utc(),
            ]);

            return;
        }

        if ($dateRange === 'yesterday') {
            $day = $now->copy()->subDay();
            $query->whereBetween('remind_at', [
                $day->copy()->startOfDay()->utc(),
                $day->copy()->endOfDay()->utc(),
            ]);

            return;
        }

        if ($dateRange === '7d') {
            $query->where('remind_at', '>=', $now->copy()->subDays(6)->startOfDay()->utc());

            return;
        }

        if ($dateRange === 'custom' && is_string($customDate) && $customDate !== '') {
            try {
                $day = Carbon::parse($customDate, $timezone);
                $query->whereBetween('remind_at', [
                    $day->copy()->startOfDay()->utc(),
                    $day->copy()->endOfDay()->utc(),
                ]);
            } catch (\Throwable) {
                // Ignore invalid custom dates.
            }
        }
    }

    /**
     * @param  Collection<int, Reminder>  $reminders
     * @return array<string, array{name: string, detail: string}>
     */
    private function loadEntityContexts(Collection $reminders): array
    {
        $map = [];
        $byType = $reminders->groupBy('entity_type');

        foreach ($byType as $type => $items) {
            $ids = $items->pluck('entity_id')->filter()->unique()->values()->all();
            if ($ids === []) {
                continue;
            }

            match ((string) $type) {
                Reminder::ENTITY_MEETING => $this->mapMeetingContexts($ids, $map),
                Reminder::ENTITY_TASK => $this->mapSimpleContexts($map, Reminder::ENTITY_TASK, Task::query()->whereIn('id', $ids)->get(['id', 'heading']), 'heading', 'Task'),
                Reminder::ENTITY_DEAL_NOTE => $this->mapNoteContexts($map, DealNote::query()->with('deal:id,name')->whereIn('id', $ids)->get(['id', 'title', 'deal_id']), 'deal'),
                Reminder::ENTITY_LEAD_NOTE => $this->mapNoteContexts($map, LeadNote::query()->with('lead:id,client_name')->whereIn('id', $ids)->get(['id', 'title', 'lead_id']), 'lead'),
                Reminder::ENTITY_DEAL => $this->mapSimpleContexts($map, Reminder::ENTITY_DEAL, Deal::query()->whereIn('id', $ids)->get(['id', 'name']), 'name', 'Deal'),
                Reminder::ENTITY_LEAD => $this->mapSimpleContexts($map, Reminder::ENTITY_LEAD, Lead::query()->whereIn('id', $ids)->get(['id', 'client_name']), 'client_name', 'Lead'),
                Reminder::ENTITY_PROPERTY => $this->mapSimpleContexts($map, Reminder::ENTITY_PROPERTY, Property::query()->whereIn('id', $ids)->get(['id', 'title']), 'title', 'Property'),
                Reminder::ENTITY_DEVELOPER_PROJECT => $this->mapSimpleContexts($map, Reminder::ENTITY_DEVELOPER_PROJECT, DeveloperProject::query()->whereIn('id', $ids)->get(['id', 'name']), 'name', 'Project'),
                Reminder::ENTITY_UNIT => $this->mapUnitContexts($ids, $map),
                Reminder::ENTITY_FLIGHT_ITINERARY => $this->mapFlightContexts($ids, $map),
                default => null,
            };
        }

        return $map;
    }

    private function entityContextKey(Reminder $reminder): string
    {
        return (string) $reminder->entity_type.':'.(int) $reminder->entity_id;
    }

    /**
     * @param  array<string, array{name: string, detail: string}>  $map
     * @param  Collection<int, mixed>  $rows
     */
    private function mapSimpleContexts(array &$map, string $entityType, Collection $rows, string $nameField, string $fallbackLabel): void
    {
        foreach ($rows as $row) {
            $name = trim((string) ($row->{$nameField} ?? ''));
            $map[$entityType.':'.$row->id] = [
                'name' => $name !== '' ? $name : '#'.$row->id,
                'detail' => $fallbackLabel.' #'.$row->id,
            ];
        }
    }

    /**
     * @param  array<string, array{name: string, detail: string}>  $map
     * @param  array<int, int>  $ids
     */
    private function mapMeetingContexts(array $ids, array &$map): void
    {
        $rows = DealFollowUp::query()
            ->with(['deal:id,name', 'lead:id,client_name'])
            ->whereIn('id', $ids)
            ->get(['id', 'remark', 'deal_id', 'lead_id', 'next_follow_up_date']);

        foreach ($rows as $row) {
            $parent = $row->deal?->name ?: $row->lead?->client_name;
            $name = trim((string) ($row->remark ?? ''));
            if ($name === '' && $parent) {
                $name = (string) $parent;
            }
            if ($name === '') {
                $name = 'Meeting #'.$row->id;
            }
            $detail = $parent ? 'Meeting · '.$parent : 'Meeting #'.$row->id;
            $map[Reminder::ENTITY_MEETING.':'.$row->id] = ['name' => $name, 'detail' => $detail];
        }
    }

    /**
     * @param  array<string, array{name: string, detail: string}>  $map
     */
    private function mapNoteContexts(array &$map, Collection $rows, string $relation): void
    {
        $entityType = $relation === 'deal' ? Reminder::ENTITY_DEAL_NOTE : Reminder::ENTITY_LEAD_NOTE;
        $label = 'Note';

        foreach ($rows as $row) {
            $parent = $relation === 'deal'
                ? ($row->deal?->name ?? null)
                : ($row->lead?->client_name ?? null);
            $name = trim((string) ($row->title ?? ''));
            if ($name === '') {
                $name = $parent ? $label.' · '.$parent : $label.' #'.$row->id;
            }
            $detail = $parent ? $label.' · '.$parent : $label.' #'.$row->id;
            $map[$entityType.':'.$row->id] = ['name' => $name, 'detail' => $detail];
        }
    }

    /**
     * @param  array<string, array{name: string, detail: string}>  $map
     * @param  array<int, int>  $ids
     */
    private function mapUnitContexts(array $ids, array &$map): void
    {
        $rows = DeveloperProjectUnitType::query()->whereIn('id', $ids)->get(['id', 'reference_code', 'property_type']);

        foreach ($rows as $row) {
            $name = trim((string) ($row->reference_code ?: $row->property_type ?: ''));
            if ($name === '') {
                $name = 'Unit #'.$row->id;
            }
            $map[Reminder::ENTITY_UNIT.':'.$row->id] = [
                'name' => $name,
                'detail' => 'Unit #'.$row->id,
            ];
        }
    }

    /**
     * @param  array<string, array{name: string, detail: string}>  $map
     * @param  array<int, int>  $ids
     */
    private function mapFlightContexts(array $ids, array &$map): void
    {
        $rows = LeadFlightItinerary::query()->whereIn('id', $ids)->get(['id', 'airport_name', 'flight_number', 'direction']);

        foreach ($rows as $row) {
            $parts = array_filter([
                trim((string) ($row->airport_name ?? '')),
                trim((string) ($row->flight_number ?? '')),
            ]);
            $name = $parts !== [] ? implode(' · ', $parts) : 'Flight #'.$row->id;
            $detail = 'Flight #'.$row->id.($row->direction ? ' · '.ucfirst((string) $row->direction) : '');
            $map[Reminder::ENTITY_FLIGHT_ITINERARY.':'.$row->id] = ['name' => $name, 'detail' => $detail];
        }
    }

    /**
     * @return array<int, array{dot: string, color: string, label: string, when: string}>
     */
    private function buildTimeline(Reminder $reminder, string $timezone): array
    {
        $events = [];

        if ($reminder->created_at) {
            $when = $reminder->created_at->copy()->timezone($timezone)->format('M j, Y · H:i');
            $events[] = ['dot' => '#98a2b3', 'color' => '#344054', 'label' => 'Created', 'when' => $when];
        }

        if ($reminder->remind_at) {
            $when = $reminder->remind_at->copy()->timezone($timezone)->format('M j, Y · H:i');
            $events[] = ['dot' => '#2e90fa', 'color' => '#344054', 'label' => 'Scheduled', 'when' => $when];
        }

        if ($reminder->sent_at) {
            $when = $reminder->sent_at->copy()->timezone($timezone)->format('M j, Y · H:i');
            $events[] = ['dot' => '#12b76a', 'color' => '#067647', 'label' => 'Sent', 'when' => $when];
        }

        if ($reminder->status === Reminder::STATUS_FAILED && $reminder->updated_at) {
            $when = $reminder->updated_at->copy()->timezone($timezone)->format('M j, Y · H:i');
            $events[] = ['dot' => '#f04438', 'color' => '#b42318', 'label' => 'Failed', 'when' => $when];
        }

        if ($reminder->status === Reminder::STATUS_CANCELLED && $reminder->updated_at) {
            $when = $reminder->updated_at->copy()->timezone($timezone)->format('M j, Y · H:i');
            $events[] = ['dot' => '#98a2b3', 'color' => '#475467', 'label' => 'Cancelled', 'when' => $when];
        }

        return $events;
    }
}
