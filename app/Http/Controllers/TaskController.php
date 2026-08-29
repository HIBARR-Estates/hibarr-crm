<?php

namespace App\Http\Controllers;

use App\DataTables\WaitingForApprovalDataTable;
use App\Events\TaskEvent;
use App\Events\TaskReminderEvent;
use App\Helper\Files;
use App\Helper\Reply;
use App\Helper\UserService;
use App\Http\Requests\Tasks\ActionTask;
use App\Http\Requests\Tasks\StoreTask;
use App\Http\Requests\Tasks\UpdateTask;
use App\Models\BaseModel;
use App\Models\ClientContact;
use App\Models\Deal;
use App\Models\DeveloperProject;
use App\Models\Lead;
use App\Models\Leave;
use App\Models\Pinned;
use App\Models\Project;
use App\Models\ProjectMilestone;
use App\Models\ProjectTimeLog;
use App\Models\ProjectTimeLogBreak;
use App\Models\Property;
use App\Models\SubTask;
use App\Models\SubTaskFile;
use App\Models\Task;
use App\Models\TaskboardColumn;
use App\Models\TaskCategory;
use App\Models\TaskComment;
use App\Models\TaskFile;
use App\Models\TaskLabel;
use App\Models\TaskLabelList;
use App\Models\TaskSetting;
use App\Models\TaskUser;
use App\Models\User;
use App\Services\PermissionService;
use App\Services\Reminders\TaskReminderSync;
use App\Services\TaskFilterCountsService;
use App\Services\TaskService;
use App\Services\TaskVisibilityService;
use App\Support\TaskPresenter;
use App\Traits\ProjectProgress;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class TaskController extends AccountBaseController
{
    use ProjectProgress;

    protected $taskService;

    protected TaskFilterCountsService $taskFilterCounts;

    public function __construct(TaskService $taskService, TaskFilterCountsService $taskFilterCounts)
    {
        parent::__construct();
        $this->taskService = $taskService;
        $this->taskFilterCounts = $taskFilterCounts;
        $this->pageTitle = 'app.menu.tasks';
        $this->middleware(
            function ($request, $next) {
                abort_403(! in_array('tasks', $this->user->modules));

                return $next($request);
            }
        );
    }

    /**
     * Multi-select filters arrive as either a native array (`key[]=a&key[]=b`,
     * legacy links) or a comma-joined string (the redesigned filter modal —
     * FilterContext.tsx's applyFilters() joins multiselect values with "," so
     * its own URL parser can read them back). Mirrors LeadService::toValueArray().
     */
    private function taskFilterAsList($value): array
    {
        if (! is_array($value)) {
            $value = $value === null || $value === '' ? [] : explode(',', (string) $value);
        }

        return array_values(array_filter(
            array_map(fn ($item) => is_string($item) ? trim($item) : $item, $value),
            fn ($item) => $item !== null && $item !== '' && $item !== 'all'
        ));
    }

    /** Date ranges arrive as a `[from, to]` array (legacy) or separate start/end params (redesigned modal). */
    private function taskFilterDateRange(string $arrayKey, string $startKey, string $endKey): ?array
    {
        $range = request($arrayKey);
        if (is_array($range) && count($range) === 2 && $range[0] && $range[1]) {
            return [$range[0], $range[1]];
        }

        $start = request($startKey);
        $end = request($endKey);

        return $start && $end ? [$start, $end] : null;
    }

    /**
     * The exact Task query index() lists from (visibility scope + every
     * filter + quick filter), minus eager loads/sorting/pagination. Reused
     * by bulk actions' "select all matching filters" so that set can never
     * drift from what the user is actually looking at.
     *
     * $applyQuickFilter is false when the caller (index()) still needs the
     * pre-quick-filter query to compute each quick filter option's own
     * count — narrowing by the currently active one first would make every
     * other option's badge count against an already-filtered set.
     */
    private function filteredTasksQuery(bool $applyQuickFilter = true): \Illuminate\Database\Eloquent\Builder
    {
        $viewPermission = user()->permission('view_tasks');
        abort_403(! in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        $tasksQuery = Task::query();

        if ($viewPermission === 'none') {
            abort_403(true);
        }

        if ($viewPermission !== 'all') {
            TaskVisibilityService::scopeVisibleToUser($tasksQuery, user()->id);
        }

        if (request()->filled('search')) {
            $searchTerm = request('search');
            $tasksQuery->where(function ($query) use ($searchTerm) {
                $query->where('heading', 'like', "%{$searchTerm}%")
                    ->orWhere('description', 'like', "%{$searchTerm}%");
            });
        }

        $statuses = $this->taskFilterAsList(request('status'));
        if (! empty($statuses)) {
            $hasPending = in_array('pending', $statuses, true);
            $slugs = array_values(array_filter(
                $statuses,
                static fn (string $status) => $status !== 'pending'
            ));

            if ($hasPending && $slugs !== []) {
                $tasksQuery->where(function ($query) use ($slugs) {
                    $query->pending()
                        ->orWhereHas('boardColumn', function ($columnQuery) use ($slugs) {
                            $columnQuery->whereIn('slug', $slugs);
                        });
                });
            } elseif ($hasPending) {
                $tasksQuery->pending();
            } else {
                $tasksQuery->whereHas('boardColumn', function ($query) use ($slugs) {
                    $query->whereIn('slug', $slugs);
                });
            }
        }

        $priorities = $this->taskFilterAsList(request('priority'));
        if (! empty($priorities)) {
            $tasksQuery->whereIn('priority', $priorities);
        }

        if (request()->filled('project_id') && request('project_id') !== 'all') {
            $tasksQuery->where('project_id', request('project_id'));
        }

        $categoryIds = $this->taskFilterAsList(request('category_id'));
        if (! empty($categoryIds)) {
            $tasksQuery->whereIn('task_category_id', $categoryIds);
        }

        $assignedTo = $this->taskFilterAsList(request('assigned_to'));
        if (! empty($assignedTo)) {
            $tasksQuery->whereHas('users', function ($query) use ($assignedTo) {
                $query->whereIn('users.id', $assignedTo);
            });
        }

        $assignedBy = $this->taskFilterAsList(request('assigned_by'));
        if (! empty($assignedBy)) {
            $tasksQuery->where(function ($query) use ($assignedBy) {
                $query->whereIn('tasks.added_by', $assignedBy)
                    ->orWhereIn('tasks.created_by', $assignedBy);
            });
        }

        $labelIds = $this->taskFilterAsList(request('labels'));
        if (! empty($labelIds)) {
            $tasksQuery->whereHas('labels', function ($query) use ($labelIds) {
                $query->whereIn('id', $labelIds);
            });
        }

        $dueRange = $this->taskFilterDateRange('due_date_range', 'due_start_date', 'due_end_date');
        if ($dueRange !== null) {
            $tasksQuery->whereBetween('due_date', $dueRange);
        } elseif (request('due_date_range') === 'none') {
            $tasksQuery->whereNull('due_date');
        }

        $createdRange = $this->taskFilterDateRange('created_date_range', 'created_start_date', 'created_end_date');
        if ($createdRange !== null) {
            $tasksQuery->whereBetween('created_at', [
                $createdRange[0].' 00:00:00',
                $createdRange[1].' 23:59:59',
            ]);
        }

        if ($applyQuickFilter && \App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign')) {
            $this->applyTasksQuickFilter($tasksQuery, (string) request('quick_filter', 'all'));
        }

        return $tasksQuery;
    }

    private const MAX_BULK_MATCHING_IDS = 2000;

    /**
     * Resolves a bulk action's target ids — either the explicit `row_ids`
     * CSV the client already had selected, or (when `select_all_matching`
     * is set) every id matching the current filters, re-run server-side via
     * filteredTasksQuery() so the set matches what's on screen exactly.
     *
     * @throws \RuntimeException if a select_all_matching set is too large —
     *                           truncating silently would apply the action to fewer tasks than the
     *                           user was told were selected, which is worse than just refusing.
     */
    private function resolveBulkTaskIds(Request $request): array
    {
        if ($request->boolean('select_all_matching')) {
            $ids = $this->filteredTasksQuery()
                ->orderBy('id')
                ->limit(self::MAX_BULK_MATCHING_IDS + 1)
                ->pluck('id')
                ->all();

            if (count($ids) > self::MAX_BULK_MATCHING_IDS) {
                throw new \RuntimeException(sprintf(
                    'Bulk actions are limited to %s tasks at a time — narrow your filters and try again.',
                    number_format(self::MAX_BULK_MATCHING_IDS)
                ));
            }

            return $ids;
        }

        return array_values(array_filter(array_map('intval', explode(',', (string) $request->row_ids))));
    }

    public function index($openTaskId = null, string $openMode = 'detail', bool $openCreate = false)
    {
        $viewPermission = user()->permission('view_tasks');

        abort_403(! in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        // Quick filter applied separately below, after quickFilterCounts()
        // has had a chance to count each option against the un-narrowed set.
        $tasksQuery = $this->filteredTasksQuery(applyQuickFilter: false)
            ->with(TaskPresenter::RELATIONS)
            ->withCount(TaskPresenter::COUNTS);

        // Recompute the same parsed values filteredTasksQuery() used, only
        // to echo them back in the `filters` response prop below.
        $statuses = $this->taskFilterAsList(request('status'));
        $priorities = $this->taskFilterAsList(request('priority'));
        $categoryIds = $this->taskFilterAsList(request('category_id'));
        $assignedTo = $this->taskFilterAsList(request('assigned_to'));
        $assignedBy = $this->taskFilterAsList(request('assigned_by'));
        $labelIds = $this->taskFilterAsList(request('labels'));

        // Apply sorting
        $sortField = request('sort_by', 'created_at');
        $sortDirection = request('sort_direction', 'desc');

        // Map frontend field names to database field names
        $fieldMapping = [
            'heading' => 'heading',
            'priority' => 'priority',
            'due_date' => 'due_date',
            'created_at' => 'created_at',
            'board_column_id' => 'board_column_id',
        ];

        if (isset($fieldMapping[$sortField])) {
            $tasksQuery->orderBy($fieldMapping[$sortField], $sortDirection);
        } else {
            $tasksQuery->orderBy('created_at', 'desc');
        }

        $taskQuickCounts = null;
        if (\App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign')) {
            $taskQuickCounts = $this->taskFilterCounts->quickFilterCounts(
                clone $tasksQuery,
                user()->id,
            );
            $this->applyTasksQuickFilter($tasksQuery, (string) request('quick_filter', 'all'));
        }

        $kanbanQuery = clone $tasksQuery;

        $tableTasks = $tasksQuery->paginate(request('per_page', 15))->withQueryString();

        $stats = \App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign')
            ? $this->taskFilterCounts->workspaceStats(clone $kanbanQuery)
            : null;

        // The board is a second, unpaginated pass over the same task set, so it
        // repeats every eager load the table query just did. The redesigned
        // workspace takes its counts from workspaceStats and mounts on the table,
        // so the board list can arrive after first paint. The legacy index derives
        // its stats from this collection, so there it still has to be synchronous.
        $loadKanbanTasks = function () use ($kanbanQuery) {
            $tasks = (clone $kanbanQuery)->get();
            $tasks->loadCount(TaskPresenter::COUNTS);

            return $tasks;
        };

        $kanbanTasks = $stats === null ? $loadKanbanTasks() : null;

        // Calculate Stats (legacy table/kanban index — collection scan).
        if ($stats === null) {
            $stats = [
                'total' => $kanbanTasks->count(),
                'completed' => $kanbanTasks->filter(function ($task) {
                    return ($task->boardColumn->slug ?? '') === 'done';
                })->count(),
                'overdue' => $kanbanTasks->filter(function ($task) {
                    return $task->due_date
                        && $task->due_date->isPast()
                        && ($task->boardColumn->slug ?? '') !== 'done';
                })->count(),
                'dueToday' => $kanbanTasks->filter(function ($task) {
                    return $task->due_date
                        && $task->due_date->isToday();
                })->count(),
            ];
        }

        $transformCallback = fn ($task) => $this->presentTask($task);

        // Transform tasks for frontend
        $tableTasks->getCollection()->transform($transformCallback);
        $kanbanTasks = $kanbanTasks !== null
            ? $kanbanTasks->map($transformCallback)
            : Inertia::defer(fn () => $loadKanbanTasks()->map($transformCallback), 'kanban');

        // Get user permissions
        $permissions = [
            'add_tasks' => user()->permission('add_tasks'),
            'edit_tasks' => user()->permission('edit_tasks'),
            'delete_tasks' => user()->permission('delete_tasks'),
            'change_status' => user()->permission('change_status'),
            'add_task_comments' => user()->permission('add_task_comments'),
            'delete_task_comments' => user()->permission('delete_task_comments'),
            'view_tasks' => $viewPermission,
            'view_task_category' => user()->permission('view_task_category'),
        ];

        // Build filters from request
        $filters = [
            'status' => $statuses,
            'priority' => $priorities,
            'assigned_to' => $assignedTo,
            'assigned_by' => $assignedBy,
            'project_id' => request('project_id') ? (int) request('project_id') : null,
            'category_id' => $categoryIds,
            'labels' => $labelIds,
            'due_date_range' => request('due_date_range'),
            'due_start_date' => request('due_start_date'),
            'due_end_date' => request('due_end_date'),
            'created_date_range' => request('created_date_range'),
            'created_start_date' => request('created_start_date'),
            'created_end_date' => request('created_end_date'),
            'search' => request('search'),
            'quick_filter' => request('quick_filter', 'all'),
        ];

        $props = [
            'tableTasks' => $tableTasks,
            'kanbanTasks' => $kanbanTasks,
            'filters' => $filters,
            'permissions' => $permissions,
            'stats' => $stats,
            // Same wall-clock convention as due_date/start_date (Task::wallClockString)
            // — the "today/overdue/upcoming" grouping compares due dates against this,
            // and comparing a wall-clock due date against the browser's real tz-aware
            // `new Date()` put tasks in the wrong bucket for anyone whose browser
            // timezone doesn't match the one due dates are already expressed in.
            'now' => Task::wallClockString(now()),

            // Modal/filter lookup data can arrive after the task list shell.
            'categories' => Inertia::defer(fn () => $this->taskCategoriesForSelect(), 'taskMeta'),
            'labels' => Inertia::defer(fn () => $this->taskLabelsForSelect(), 'taskMeta'),
            'columns' => Inertia::defer(fn () => $this->taskColumnsForSelect(), 'taskMeta'),
            'users' => Inertia::defer(
                fn () => $this->taskUsersForSelect($viewPermission),
                'taskMeta'
            ),
            // Unrestricted by the viewer's own task-visibility scope — anyone
            // should be able to @mention anyone in task comments.
            'mentionablePeople' => Inertia::defer(
                fn () => $this->taskUsersForSelect('all'),
                'taskMeta'
            ),
            'projects' => Inertia::defer(fn () => $this->taskProjectsForSelect(), 'taskLinkMeta'),
            'deals' => Inertia::defer(fn () => Deal::select('id', 'name')->get(), 'taskLinkMeta'),
            'leads' => Inertia::defer(fn () => Lead::select('id', 'client_name', 'company_name')->get(), 'taskLinkMeta'),
            'properties' => Inertia::defer(fn () => Property::select('id', 'title as name')->get(), 'taskLinkMeta'),
            'developerProjects' => Inertia::defer(fn () => DeveloperProject::select('id', 'name')->orderBy('name')->get(), 'taskLinkMeta'),
        ];

        // Saved views only exist as part of the redesigned tasks workspace.
        if (\App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign')) {
            $props['savedViews'] = Inertia::defer(fn () => $this->savedTaskViewsForUser(), 'taskViews');
            $props['taskQuickCounts'] = $taskQuickCounts;
        }

        // /tasks/{id}, /tasks/{id}/edit and /tasks/create (show()/edit()/
        // create(), redesign flag on) all render this same page with one of
        // these set, instead of redirecting to a ?task= query param or a
        // standalone page — so the URL stays /tasks/{id}, /tasks/{id}/edit
        // or /tasks/create. The task may not match the default filters/sort,
        // so hand its data over directly rather than making the frontend
        // re-fetch it.
        if ($openCreate) {
            $props['openCreate'] = true;
        }

        if ($openTaskId) {
            $openTaskId = (int) $openTaskId;
            $props['openTaskId'] = $openTaskId;
            $props['openMode'] = $openMode;

            $alreadyLoaded = $kanbanTasks->contains('id', $openTaskId);
            if (! $alreadyLoaded) {
                $props['openTaskDeferred'] = true;
                $props['openTask'] = Inertia::defer(
                    fn () => $this->presentOpenTaskForIndex($openTaskId)
                );
            }
        }

        return Inertia::render('Tasks/Index', $props);
    }

    /**
     * Anchors a task's reminders to its due date and rebuilds the schedule.
     *
     * `reminders` (per-task custom offsets) is deliberately left alone — with
     * it null, ReminderCreator falls back to the company's configured default
     * cadence, so every task with a due date gets the default reminders. A
     * task with no due date has no anchor, which cancels any open reminders.
     */
    private function syncTaskReminders(Task $task): void
    {
        if ($task->remind_at != $task->due_date) {
            $task->remind_at = $task->due_date;
            $task->save();
        }

        app(TaskReminderSync::class)->syncFromTask(
            $task->fresh(['users', 'boardColumn', 'createBy', 'addedByUser'])
        );
    }

    /**
     * Syncs a task's linked records from a `links` payload of
     * `[{type, id}, …]`, as sent by the redesigned task modal.
     *
     * Deals, leads and properties are polymorphic (`taskable`) and each type
     * is synced to exactly the ids given; "project" maps to the task's own
     * `project_id`. Absent `links` leaves every existing link untouched, so
     * legacy callers that never send it can't wipe relations.
     */
    private function syncTaskLinks(Task $task, Request $request): void
    {
        if (! $request->has('links')) {
            return;
        }

        $links = $request->input('links');
        if (! is_array($links)) {
            return;
        }

        $byType = ['deal' => [], 'lead' => [], 'property' => [], 'project' => []];

        foreach ($links as $link) {
            if (! is_array($link)) {
                continue;
            }
            $type = strtolower((string) ($link['type'] ?? ''));
            $id = (int) ($link['id'] ?? 0);
            if ($id <= 0) {
                continue;
            }

            if (array_key_exists($type, $byType)) {
                $byType[$type][] = $id;
            }
        }

        $task->deals()->sync($this->authorizedDealLinkIds($byType['deal']));
        $task->leads()->sync($this->authorizedLeadLinkIds($byType['lead']));
        $task->properties()->sync($this->authorizedPropertyLinkIds($byType['property']));
        // "Project" means the developer project (the one holding units), not
        // the Worksuite delivery project on `tasks.project_id`.
        $task->developerProjects()->sync($this->authorizedDeveloperProjectLinkIds($byType['project']));
    }

    /** Deal ids from a links[] payload the current user may actually view. Drops unresolved/unauthorized ids. */
    private function authorizedDealLinkIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];

        return Deal::whereIn('id', $ids)->get()
            ->filter(fn (Deal $deal) => PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules)['canAccess'])
            ->pluck('id')
            ->all();
    }

    /** Lead ids from a links[] payload the current user may actually view. Drops unresolved/unauthorized ids. */
    private function authorizedLeadLinkIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        $leadRules = [
            'added' => 'added_by',
            'owned' => 'lead_owner',
        ];

        return Lead::whereIn('id', $ids)->get()
            ->filter(fn (Lead $lead) => PermissionService::checkAccess(user(), 'view_lead', $lead, $leadRules)['canAccess'])
            ->pluck('id')
            ->all();
    }

    /** Property ids from a links[] payload the current user may actually view (PropertyPolicy). Drops unresolved/unauthorized ids. */
    private function authorizedPropertyLinkIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return Property::whereIn('id', $ids)->get()
            ->filter(fn (Property $property) => user()->can('view', $property))
            ->pluck('id')
            ->all();
    }

    /**
     * Developer project ids from a links[] payload. No per-record authorization
     * policy exists yet for developer projects (see DeveloperProjectController's
     * constructor); DeveloperProject's own CompanyScope is the enforceable
     * boundary, so this just drops ids that don't resolve within the company.
     */
    private function authorizedDeveloperProjectLinkIds(array $ids): array
    {
        if (empty($ids)) {
            return [];
        }

        return DeveloperProject::whereIn('id', $ids)->pluck('id')->all();
    }

    /**
     * True for a legacy jQuery fragment fetch (Deals/Leads/Projects/the
     * dashboard all still call show()/create()/edit() this way for a Blade
     * partial) — false for a normal browser navigation *or* an Inertia
     * client visit. request()->ajax() alone can't tell these apart: Inertia's
     * client is built on axios, which sets the same X-Requested-With header
     * a legacy $.ajax() call does. X-Inertia is the one header only Inertia
     * itself sends, so its presence is what actually distinguishes them.
     */
    private function isLegacyAjaxFragmentRequest(): bool
    {
        return request()->ajax() && ! request()->header('X-Inertia');
    }

    /**
     * The one Task -> frontend array shape — moved to App\Support\TaskPresenter
     * so the classic Dashboard, and the Deal/Lead workspace task tabs, can
     * hand the same shape to the redesigned Tasks modals (behind the same
     * crm.tasks-workspace-redesign flag) without re-deriving it. Callers must
     * eager-load TaskPresenter::RELATIONS (+ withCount on TaskPresenter::COUNTS)
     * first — present() only reads what's already loaded.
     */
    private function presentTask(Task $task, bool $includeFiles = false): array
    {
        return TaskPresenter::present($task, $includeFiles);
    }

    /**
     * Deep-linked /tasks/{id} task payload — deferred so attachment metadata
     * does not block the Tasks/Index first paint.
     */
    private function presentOpenTaskForIndex(int $openTaskId): ?array
    {
        $userId = UserService::getUserId();
        $viewTaskFilePermission = user()->permission('view_task_files');

        $openTask = Task::with(TaskPresenter::RELATIONS)
            ->with(['files' => function ($q) use ($viewTaskFilePermission, $userId) {
                $this->scopeTaskFilesRelation($q, $viewTaskFilePermission, $userId);
            }])
            ->withCount(TaskPresenter::COUNTS)
            ->find($openTaskId);

        return $openTask ? $this->presentTask($openTask, true) : null;
    }

    /**
     * Restrict file eager-loading to permissions the current user actually has.
     */
    private function scopeTaskFilesRelation($query, string $viewTaskFilePermission, int $userId): void
    {
        if ($viewTaskFilePermission === 'all') {
            return;
        }

        if ($viewTaskFilePermission === 'added') {
            $query->where('added_by', $userId);

            return;
        }

        $query->whereRaw('0 = 1');
    }

    /**
     * Saved filter views the current user may open: their own plus team-shared.
     *
     * @return array<int, array<string, mixed>>
     */
    private function savedTaskViewsForUser(): array
    {
        $userId = (int) user()->id;

        return \App\Models\TaskSavedView::query()
            ->visibleTo($userId)
            ->with('owner:id,name')
            ->orderByDesc('updated_at')
            ->get()
            ->map(fn (\App\Models\TaskSavedView $view) => [
                'id' => $view->id,
                'name' => $view->name,
                'filters' => $view->filters,
                'visibility' => $view->visibility,
                'pinned' => $view->pinned,
                'is_owner' => (int) $view->user_id === $userId,
                'owner_name' => $view->owner?->name,
                'updated_at' => $view->updated_at?->toIso8601String(),
            ])
            ->all();
    }

    /**
     * JSON endpoint for a deal's tasks tab — fetched independently by the
     * frontend instead of riding the deal page's deferred-prop bundle. Logic
     * relocated verbatim from the former `tasks` deferred prop on
     * DealController::show().
     */
    public function dealTasks(Request $request, $dealId)
    {
        $deal = Deal::findOrFail($dealId);
        $dealRules = [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ];
        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, $dealRules);
        abort_403(! $access['canAccess']);

        // Behind crm.tasks-workspace-redesign, eager-load + serialize through
        // the same TaskPresenter the redesigned Tasks workspace uses, so this
        // tab's tasks can open in those modals — off, the narrower relation
        // set and raw toFrontendArray() serialization this tab always used.
        if (\App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign')) {
            $tasks = $deal->tasks()
                ->with(TaskPresenter::RELATIONS)
                ->withCount(TaskPresenter::COUNTS)
                ->orderBy('id', 'desc')
                ->get();

            return response()->json([
                'status' => 'success',
                'data' => $tasks->map(fn (Task $task) => TaskPresenter::present($task))->values(),
            ]);
        }

        $tasks = $deal->tasks()
            ->with(['users', 'category', 'boardColumn', 'labels', 'deals', 'leads', 'properties'])
            ->orderBy('id', 'desc')
            ->get();

        return response()->json([
            'status' => 'success',
            'data' => $tasks->map(fn (Task $task) => $task->toFrontendArray())->values(),
        ]);
    }

    /**
     * XXXXXXXXXXX
     *
     * @return array
     */
    public function applyQuickAction(Request $request)
    {
        // Suppress per-task notifications/emails during bulk operations
        app()->instance('suppress_bulk_notifications', true);

        try {
            try {
                $ids = $this->resolveBulkTaskIds($request);
            } catch (\RuntimeException $e) {
                return Reply::error($e->getMessage());
            }

            if ($ids === []) {
                return Reply::error('Select at least one task.');
            }

            // deleteRecords()/changeBulkStatus()/changeMilestones() each
            // re-read row_ids off the request directly instead of taking
            // $ids as a parameter — write the resolved set back so a
            // select_all_matching request reaches them the same way.
            $request->merge(['row_ids' => implode(',', $ids)]);
            $records = [];

            switch ($request->action_type) {
                case 'delete':
                    $tasks = Task::whereIn('id', $ids)->get(['id', 'heading']);
                    $records = $tasks->map(function (Task $task) {
                        return [
                            'label' => 'Deleted: '.($task->heading ?? ('#'.$task->id)),
                            'url' => '',
                        ];
                    })->values()->all();

                    $this->deleteRecords($request);

                    if (user() && ! empty($records)) {
                        user()->notify(new \App\Notifications\BulkActionCompleted('task', 'delete', count($records), $records));
                    }

                    return Reply::success(__('messages.deleteSuccess'));
                case 'change-status':
                    $this->authorizeBulkTaskStatusChange($ids);

                    $column = TaskboardColumn::find($request->status);
                    $columnLabel = $column?->column_name ?? ($column?->slug ?? ('ID '.$request->status));
                    $tasks = Task::whereIn('id', $ids)->get(['id', 'heading']);
                    $records = $tasks->map(function (Task $task) use ($columnLabel) {
                        return [
                            'label' => ($task->heading ?? ('#'.$task->id)).' ('.$columnLabel.')',
                            'url' => getDomainSpecificUrl(route('tasks.show', $task->id), company()),
                        ];
                    })->values()->all();

                    $this->changeBulkStatus($request);

                    if (user() && ! empty($records)) {
                        user()->notify(new \App\Notifications\BulkActionCompleted('task', 'change-status', count($records), $records));
                    }

                    return Reply::success(__('messages.updateSuccess'));
                case 'change-assignee':
                    $this->changeBulkAssignee($request, $ids);

                    return Reply::success(__('messages.updateSuccess'));
                case 'bulk_update':
                    $fields = $request->input('fields', []);
                    if (! is_array($fields) || $fields === []) {
                        return Reply::error(__('messages.updateFail') ?: 'Select at least one field to update.');
                    }

                    $error = $this->applyTaskBulkUpdateFields($request, $ids, $fields);
                    if ($error !== null) {
                        return Reply::error($error);
                    }

                    $tasks = Task::whereIn('id', $ids)->get(['id', 'heading']);
                    $records = $tasks->map(function (Task $task) {
                        return [
                            'label' => $task->heading ?? ('#'.$task->id),
                            'url' => getDomainSpecificUrl(route('tasks.show', $task->id), company()),
                        ];
                    })->values()->all();

                    if (user() && ! empty($records)) {
                        user()->notify(new \App\Notifications\BulkActionCompleted('task', 'bulk_update', count($records), $records));
                    }

                    return Reply::success(__('messages.updateSuccess'));
                case 'milestone':
                    $milestone = ProjectMilestone::find($request->milestone);
                    $milestoneLabel = $milestone?->milestone_title ?? ('ID '.$request->milestone);
                    $tasks = Task::whereIn('id', $ids)->get(['id', 'heading']);
                    $records = $tasks->map(function (Task $task) use ($milestoneLabel) {
                        return [
                            'label' => ($task->heading ?? ('#'.$task->id)).' ('.$milestoneLabel.')',
                            'url' => getDomainSpecificUrl(route('tasks.show', $task->id), company()),
                        ];
                    })->values()->all();

                    $this->changeMilestones($request);

                    if (user() && ! empty($records)) {
                        user()->notify(new \App\Notifications\BulkActionCompleted('task', 'milestone', count($records), $records));
                    }

                    return Reply::success(__('messages.updateSuccess'));
                default:
                    return Reply::error(__('messages.selectAction'));
            }
        } finally {
            app()->forgetInstance('suppress_bulk_notifications');
        }
    }

    protected function deleteRecords($request)
    {
        abort_403(user()->permission('delete_tasks') != 'all');

        $ids = explode(',', $request->row_ids);

        Task::whereIn('id', $ids)->delete();
    }

    protected function changeBulkStatus($request)
    {
        $taskIds = array_values(array_filter(array_map('intval', explode(',', $request->row_ids))));
        $this->authorizeBulkTaskStatusChange($taskIds);

        $taskBoardColumn = TaskboardColumn::findOrFail(request()->status);

        // Update tasks based on the requested status
        if ($taskBoardColumn && $taskBoardColumn->slug == 'done') {
            Task::whereIn('id', $taskIds)->update([
                'status' => 'done',
                'board_column_id' => $request->status,
                'completed_on' => now()->format('Y-m-d'),
            ]);
        } else {
            // Mirrors TaskService::changeStatus's completion bookkeeping —
            // without clearing completed_on here, a task bulk-moved out of
            // "done" kept its old completion date forever, so it stayed
            // struck-through/filed under "done" everywhere completed_on is
            // read as a completion flag.
            Task::whereIn('id', $taskIds)->update([
                'board_column_id' => $request->status,
                'completed_on' => null,
            ]);
        }

    }

    /**
     * Bulk-reassign the selected tasks to a new set of users. Mirrors the
     * single-task assignee sync ($task->users()->sync) used by update(),
     * applied atomically per task inside one request so the whole selection
     * lands together instead of racing N separate calls from the client.
     *
     * @param  array<int, int>  $taskIds
     */
    protected function changeBulkAssignee($request, array $taskIds): void
    {
        abort_403(user()->permission('edit_tasks') != 'all');

        if (empty($taskIds)) {
            abort_403(true);
        }

        $userIds = is_array($request->user_id)
            ? $request->user_id
            : array_filter(explode(',', (string) $request->user_id));
        $userIds = array_values(array_filter(array_map('intval', $userIds)));

        $tasks = Task::withTrashed()->whereIn('id', $taskIds)->get();

        foreach ($tasks as $task) {
            if ($task->trashed()) {
                continue;
            }
            $task->users()->sync($userIds);
        }
    }

    /**
     * Apply one or more bulk field updates to the selected tasks. Mirrors
     * LeadContactController::applyBulkUpdateFields — each field is gated by
     * its own permission check and reuses the existing single-field bulk
     * helpers (changeBulkStatus / changeBulkAssignee) so the Bulk update
     * modal can stack several field changes into one request.
     *
     * @param  list<string>  $fields
     * @param  array<int, int>  $taskIds
     */
    protected function applyTaskBulkUpdateFields(Request $request, array $taskIds, array $fields): ?string
    {
        if (empty($taskIds)) {
            return __('messages.selectAtleastOne') ?: 'Select at least one task.';
        }

        $fields = array_values(array_unique(array_map('strval', $fields)));

        foreach ($fields as $field) {
            switch ($field) {
                case 'status':
                    if (! $request->filled('status')) {
                        return __('messages.updateFail') ?: 'Select a status.';
                    }
                    $this->authorizeBulkTaskStatusChange($taskIds);
                    $this->changeBulkStatus($request);
                    break;

                case 'priority':
                    abort_403(user()->permission('edit_tasks') != 'all');
                    $priority = $request->input('priority');
                    if (! in_array($priority, ['urgent', 'highest', 'high', 'medium', 'low', 'lowest'], true)) {
                        return __('messages.updateFail') ?: 'Select a valid priority.';
                    }
                    Task::whereIn('id', $taskIds)->update(['priority' => $priority]);
                    break;

                case 'task_category_id':
                    abort_403(user()->permission('edit_tasks') != 'all');
                    Task::whereIn('id', $taskIds)->update([
                        'task_category_id' => $request->input('task_category_id') ?: null,
                    ]);
                    break;

                case 'assigned_to':
                    $this->changeBulkAssignee($request, $taskIds);
                    break;

                default:
                    return (__('messages.updateFail') ?: 'Unknown field.')." ({$field})";
            }
        }

        return null;
    }

    /**
     * @param  array<int, int>  $taskIds
     */
    protected function authorizeBulkTaskStatusChange(array $taskIds): void
    {
        if (empty($taskIds)) {
            abort_403(true);
        }

        $tasks = Task::withTrashed()
            ->with(['project:id,project_admin', 'users:id'])
            ->whereIn('id', $taskIds)
            ->get();

        if ($tasks->count() !== count($taskIds)) {
            abort_403(true);
        }

        $changeStatusPermission = user()->permission('change_status');
        $currentUserId = (int) user()->id;

        foreach ($tasks as $task) {
            $taskUsers = $task->users->pluck('id')->map(fn ($id) => (int) $id)->all();

            $isAllowed =
                $changeStatusPermission == 'all'
                || ($changeStatusPermission == 'added' && (int) $task->added_by === $currentUserId)
                || ($changeStatusPermission == 'owned' && in_array($currentUserId, $taskUsers, true))
                || ($changeStatusPermission == 'both' && (in_array($currentUserId, $taskUsers, true) || (int) $task->added_by === $currentUserId))
                || ($task->project && (int) $task->project->project_admin === $currentUserId);

            if (! $isAllowed) {
                abort_403(true);
            }
        }
    }

    public function changeMilestones($request)
    {
        abort_403(user()->permission('edit_tasks') != 'all');

        $taskIds = explode(',', $request->row_ids);

        Task::whereIn('id', $taskIds)->update([
            'milestone_id' => $request->milestone,
        ]);
    }

    public function changeStatus(Request $request)
    {
        $taskId = $request->taskId;
        $status = $request->status;
        $task = Task::withTrashed()->with('project', 'users')->findOrFail($taskId);

        $taskUsers = $task->users->pluck('id')->toArray();
        $changeStatusPermission = user()->permission('change_status');

        abort_403(
            ! (
                $changeStatusPermission == 'all'
                || ($changeStatusPermission == 'added' && $task->added_by == user()->id)
                || ($changeStatusPermission == 'owned' && in_array(user()->id, $taskUsers))
                || ($changeStatusPermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
                || ($task->project && $task->project->project_admin == user()->id)
            )
        );

        $taskBoardColumn = TaskboardColumn::where('slug', $status)->first();

        if ($taskBoardColumn) {
            $this->taskService->changeStatus($task, $taskBoardColumn->id);

            $this->selfActiveTimer = ProjectTimeLog::selfActiveTimer();
            // Data for view
            $this->data['selfActiveTimer'] = $this->selfActiveTimer; // ensure data is available
            $clockHtml = view('sections.timer_clock', $this->data)->render();

            return Reply::successWithData(__('messages.taskUpdated', ['status' => $taskBoardColumn->column_name]), ['clockHtml' => $clockHtml]);
        }

        return Reply::error('Column not found');
    }

    public function changeStatusDeprecated(Request $request)
    {
        $taskId = $request->taskId;
        $status = $request->status;

        $task = Task::withTrashed()->with('project', 'users')->findOrFail($taskId);

        $taskUsers = $task->users->pluck('id')->toArray();

        $this->editPermission = user()->permission('edit_tasks');
        $this->changeStatusPermission = user()->permission('change_status');
        abort_403(
            ! (
                $this->changeStatusPermission == 'all'
                || ($this->changeStatusPermission == 'added' && $task->added_by == user()->id)
                || ($this->changeStatusPermission == 'owned' && in_array(user()->id, $taskUsers))
                || ($this->changeStatusPermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
                || ($task->project && $task->project->project_admin == user()->id)
            )
        );

        $taskBoardColumn = TaskboardColumn::where('slug', $status)->first();
        $task->board_column_id = $taskBoardColumn->id;

        if ($task->status === 'done' && $status !== 'done') {
            $task->approval_send = 0; // Reset approval_send to 0
        }

        if ($taskBoardColumn->slug == 'done') {
            $task->status = 'done';
            $task->completed_on = now()->format('Y-m-d');
        } else {
            $task->completed_on = null;
        }

        if ($task->trashed()) {
            $task->saveQuietly();
        } else {
            $task->save();
        }

        if ($task->project_id != null) {

            if ($task->project->calculate_task_progress == 'true') {
                // Calculate project progress if enabled
                $this->calculateProjectProgress($task->project_id, 'true');
            }
        }

        $this->selfActiveTimer = ProjectTimeLog::selfActiveTimer();

        $clockHtml = view('sections.timer_clock', $this->data)->render();

        return Reply::successWithData(__('messages.updateSuccess'), ['clockHtml' => $clockHtml]);

    }

    public function milestoneChange(Request $request)
    {
        $editTaskPermission = user()->permission('edit_tasks');
        $editMilestonePermission = user()->permission('edit_project_milestones');

        $taskId = $request->taskId;
        $milestoneId = $request->milestone_id;

        $task = Task::withTrashed()->with('project', 'users')->findOrFail($taskId);
        $taskUsers = $task->users->pluck('id')->toArray();

        abort_403(
            ! (
                ($editTaskPermission == 'all'
                || ($editTaskPermission == 'owned' && in_array(user()->id, $taskUsers))
                || ($editTaskPermission == 'added' && $task->added_by == user()->id)
                || ($task->project && ($task->project->project_admin == user()->id))
                || ($editTaskPermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
                || ($editTaskPermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
                || ($editTaskPermission == 'both' && (in_array('client', user_roles()) && ($task->project && ($task->project->client_id == user()->id)) || $task->added_by == user()->id))
                ) && (
                    $editMilestonePermission == 'all'
                    || ($editMilestonePermission == 'added' && $task->added_by == user()->id)
                    || ($editMilestonePermission == 'owned' && in_array(user()->id, $taskUsers))
                    || ($editMilestonePermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
                )
            )
        );

        $task->milestone_id = $milestoneId;
        $task->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function storeDefaultTask(Request $request, $dealId)
    {
        $deal = Deal::findOrFail($dealId);
        $this->addPermission = user()->permission('add_tasks');
        abort_403(! in_array($this->addPermission, ['all', 'added']));

        $taskType = $request->task_type;

        $dealTaskService = new \App\Services\DealTaskService;
        $task = $dealTaskService->createTaskByType($deal, $taskType);

        if (! $task) {
            return Reply::error('Invalid task type');
        }

        return Reply::success(__('messages.taskCreatedSuccessfully'));
    }

    public function destroy(Request $request, $id)
    {
        $task = Task::with('subtasks', 'boardColumn')->findOrFail($id);
        $this->deletePermission = user()->permission('delete_tasks');

        $taskUsers = $task->users->pluck('id')->toArray();

        // Permission Check
        abort_403(! ($this->deletePermission == 'all'
            || ($this->deletePermission == 'owned' && in_array(user()->id, $taskUsers))
            || ($this->deletePermission == 'added' && $task->added_by == user()->id)
            || ($task->project && ($task->project->project_admin == user()->id))
            || ($this->deletePermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
            || ($this->deletePermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
            || ($this->deletePermission == 'both' && (in_array('client', user_roles()) && ($task->project && ($task->project->client_id == user()->id)) || $task->added_by == user()->id))
        ));

        abort_403($this->isWatcherOnlyOnTaskDeals($task));

        // Delegate to Service
        $this->taskService->deleteTask($task);

        return Reply::success(__('messages.taskDeleted'));
    }

    /**
     * True when the task is linked to at least one deal, the current user has no
     * real membership (creator/agent/participant) on any of them, and they're a
     * watcher on at least one — i.e. their only standing is "watcher", who should
     * stay read-only on other people's tasks. Watchers may still edit/delete tasks
     * they created. See Deal::hasTeamMemberAccess().
     */
    private function isWatcherOnlyOnTaskDeals(Task $task): bool
    {
        // Admins are never limited by deal-watcher standing.
        if (in_array('admin', user_roles())) {
            return false;
        }

        $userId = user()->id;

        // Creators keep write access to their own tasks even as deal watchers.
        if ((int) $task->added_by === (int) $userId) {
            return false;
        }

        $deals = $task->deals()->get();
        if ($deals->isEmpty()) {
            return false;
        }

        foreach ($deals as $deal) {
            if ($deal->added_by == $userId || $deal->hasTeamMemberAccess($userId)) {
                return false;
            }
        }

        return $deals->contains(
            fn ($deal) => $deal->dealWatchers()->where('user_id', $userId)->exists()
        );
    }

    public function destroyDeprecated(Request $request, $id)
    {
        $task = Task::with('project')->findOrFail($id);

        $this->deletePermission = user()->permission('delete_tasks');

        $taskUsers = $task->users->pluck('id')->toArray();

        abort_403(
            ! ($this->deletePermission == 'all'
                || ($this->deletePermission == 'owned' && in_array(user()->id, $taskUsers))
                || ($task->project && ($task->project->project_admin == user()->id))
                || ($this->deletePermission == 'added' && $task->added_by == user()->id)
                || ($this->deletePermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
                || ($this->deletePermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
                || ($this->deletePermission == 'both' && (in_array('client', user_roles()) && ($task->project && ($task->project->client_id == user()->id)) || $task->added_by == user()->id))
            )
        );

        $this->taskBoardStatus = TaskboardColumn::all();
        Task::where('recurring_task_id', $id)->delete();

        // Delete current task
        $task->delete();

        return Reply::successWithData(__('messages.deleteSuccess'), ['redirectUrl' => route('tasks.index')]);
    }

    /**
     * Get task details for the modal
     *
     * @param  int  $id
     * @return mixed
     */
    public function data($id)
    {
        $task = Task::with([
            'users',
            'label',
            'project',
            'category',
            'deals',
            'leads',
            'properties',
            'addedByUser:id,name,image',
            'boardColumn:id,column_name,slug,label_color',
        ])->find($id);

        if ($task) {
            $task->withCustomFields();
            // Frontend status UI is driven by board column slug, not the legacy status column.
            $task->setAttribute('status', $task->boardColumn?->slug ?? $task->status);
        }

        if (! $task) {
            return Reply::error('Task not found');
        }

        $editTaskPermission = user()->permission('edit_tasks');
        $taskUsers = $task->users->pluck('id')->toArray();

        abort_403(
            ! ($editTaskPermission == 'all'
                || ($editTaskPermission == 'owned' && in_array(user()->id, $taskUsers))
                || ($editTaskPermission == 'added' && $task->added_by == user()->id)
                || ($task->project && ($task->project->project_admin == user()->id))
                || ($editTaskPermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
                || ($editTaskPermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
                || ($editTaskPermission == 'both' && (in_array('client', user_roles()) && ($task->project && ($task->project->client_id == user()->id)) || $task->added_by == user()->id))
            )
        );

        return Reply::dataOnly(['task' => $task->toFrontendArray()]);
    }

    /**
     * XXXXXXXXXXX
     *
     * @return \Illuminate\Http\Response
     */
    public function create()
    {
        // The redesigned workspace has no standalone create page — /tasks/create
        // renders the list/board view with the Add Task popup pre-opened instead,
        // so the URL stays /tasks/create. Only for the plain "duplicate/from
        // project" case this route already supported; a fresh GET here is
        // never form-submitted directly, so a coarse add_tasks check is enough.
        if (\App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign') && ! $this->isLegacyAjaxFragmentRequest()) {
            $addPermission = user()->permission('add_tasks');
            abort_403(! in_array($addPermission, ['all', 'added']));

            return $this->index(openCreate: true);
        }

        $this->pageTitle = __('app.addTask');

        $this->addPermission = user()->permission('add_tasks');
        $this->projectShortCode = '';
        $this->project = request('task_project_id') ? Project::with('projectMembers')->findOrFail(request('task_project_id')) : null;

        if (is_null($this->project) || ($this->project->project_admin != user()->id)) {
            abort_403(! in_array($this->addPermission, ['all', 'added']));
        }

        $this->task = (request()['duplicate_task']) ? Task::with('users', 'label', 'project')->findOrFail(request()['duplicate_task'])->withCustomFields() : null;
        $this->selectedLabel = TaskLabel::where('task_id', request()['duplicate_task'])->get()->pluck('label_id')->toArray();
        $this->projectMember = TaskUser::where('task_id', request()['duplicate_task'])->get()->pluck('user_id')->toArray();

        $this->projects = Project::allProjects(true);

        $this->taskLabels = TaskLabelList::whereNull('project_id')->get();
        $this->projectID = request()->task_project_id;

        if (request('task_project_id')) {
            $project = Project::findOrFail(request('task_project_id'));
            $this->projectShortCode = $project->project_short_code;
            $this->taskLabels = TaskLabelList::where('project_id', request('task_project_id'))->orWhere('project_id', null)->get();
            $this->milestones = ProjectMilestone::where('project_id', request('task_project_id'))->whereNot('status', 'complete')->get();
        } else {
            if ($this->task && $this->task->project) {
                $this->milestones = $this->task->project->incompleteMilestones;
            } else {
                $this->milestones = collect([]);
            }
        }

        $this->columnId = request('column_id');
        $this->categories = TaskCategory::all();

        $this->taskboardColumns = TaskboardColumn::orderBy('priority', 'asc')->get();
        $completedTaskColumn = TaskboardColumn::where('slug', '=', 'done')->first();

        if (request()->has('default_assign') && request('default_assign') != '') {
            $this->defaultAssignee = request('default_assign');
        }

        $this->dependantTasks = $completedTaskColumn ? Task::where('board_column_id', '<>', $completedTaskColumn->id)
            ->where('project_id', $this->projectID)
            ->whereNotNull('due_date')->get() : [];

        $this->allTasks = $completedTaskColumn ? Task::where('board_column_id', '<>', $completedTaskColumn->id)->whereNotNull('due_date')->get() : [];

        $viewEmployeePermission = user()->permission('view_employees');

        if (! is_null($this->project)) {
            if ($this->project->public) {
                $this->employees = User::allEmployees(null, true, ($viewEmployeePermission == 'all' ? 'all' : null));

            } else {

                $this->employees = $this->project->projectMembers;
            }
        } elseif (! is_null($this->task) && ! is_null($this->task->project_id)) {
            if ($this->task->project->public) {
                $this->employees = User::allEmployees(null, true, ($viewEmployeePermission == 'all' ? 'all' : null));
            } else {

                $this->employees = $this->task->project->projectMembers;
            }
        } else {
            if (in_array('client', user_roles())) {
                $this->employees = collect([]); // Do not show all employees to client

            } else {
                $this->employees = User::allEmployees(null, true, ($viewEmployeePermission == 'all' ? 'all' : null));
            }

        }

        $task = new Task;

        $getCustomFieldGroupsWithFields = $task->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $userData = [];

        $usersData = $this->employees;

        foreach ($usersData as $user) {

            $url = route('employees.show', [$user->id]);

            $userData[] = ['id' => $user->id, 'value' => $user->name, 'image' => $user->image_url, 'link' => $url];

        }

        $this->userData = $userData;

        $this->view = 'tasks.ajax.create';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('tasks.create', $this->data);
    }

    public function store(StoreTask $request)
    {
        // Permission Check
        $project = request('project_id') ? Project::findOrFail(request('project_id')) : null;
        if (is_null($project) || ($project->project_admin != user()->id)) {
            $this->addPermission = user()->permission('add_tasks');
            abort_403(! in_array($this->addPermission, ['all', 'added']));
        }

        try {
            // Prepare Data
            $data = $request->all(); // Using all() to catch everything, validated() is strict

            // Delegate to Service
            $task = $this->taskService->createTask($data, user());

            // TaskService::createTask only handles the legacy single
            // taskable_type/taskable_id pair — the redesigned modal's
            // multi-link `links` payload is synced separately here.
            $this->syncTaskLinks($task, $request);

            // Handle Response Logic
            if (request()->add_more == 'true') {
                $html = $this->create();

                return Reply::successWithData(__('messages.taskSaved'), ['html' => $html, 'add_more' => true, 'taskID' => $task->id]);
            }

            if ($request->page_name && $request->page_name == 'ganttChart') {
                // For full Gantt support, we'd need to regenerate the gantt array here or in service.
                // For now returning success.
                return Reply::success(__('messages.taskSaved'));
            }

            $redirectUrl = urldecode($request->redirect_url);
            if ($redirectUrl == '') {
                $redirectUrl = route('tasks.index');
            }

            $task->load(TaskPresenter::RELATIONS)->loadCount(TaskPresenter::COUNTS);

            return Reply::successWithData(__('messages.taskSaved'), ['redirectUrl' => $redirectUrl, 'taskID' => $task->id, 'data' => $this->presentTask($task)]);

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    // The function is called for duplicate code also
    public function storeDeprecated(StoreTask $request)
    {
        $project = request('project_id') ? Project::findOrFail(request('project_id')) : null;

        if (is_null($project) || ($project->project_admin != user()->id)) {
            $this->addPermission = user()->permission('add_tasks');
            abort_403(! in_array($this->addPermission, ['all', 'added']));
        }

        DB::beginTransaction();
        $ganttTaskArray = [];
        $gantTaskLinkArray = [];

        $taskBoardColumn = TaskboardColumn::where('slug', 'to_do')->first();
        $task = new Task;
        $task->heading = $request->heading;
        $task->description = trim_editor($request->description);
        $dueDate = ($request->has('without_duedate')) ? null : Carbon::createFromFormat(company()->date_format.' '.company()->time_format, $request->due_date);
        $task->start_date = $request->start_date ? Carbon::createFromFormat(company()->date_format.' '.company()->time_format, $request->start_date) : null;
        $task->due_date = $dueDate;
        $task->project_id = $request->project_id;
        $task->task_category_id = $request->category_id;
        $task->priority = $request->priority;
        $task->board_column_id = $taskBoardColumn->id;

        if ($request->has('dependent') && $request->has('dependent_task_id') && $request->dependent_task_id != '') {
            $dependentTask = Task::findOrFail($request->dependent_task_id);

            if (! is_null($dependentTask->due_date) && ! is_null($dueDate) && $dependentTask->due_date->greaterThan($dueDate)) {
                /* @phpstan-ignore-line */
                return Reply::error(__('messages.taskDependentDate'));
            }

            $task->dependent_task_id = $request->dependent_task_id;
        }

        $task->is_private = $request->has('is_private') ? 1 : 0;
        $task->billable = $request->has('billable') && $request->billable ? 1 : 0;
        $task->estimate_hours = $request->estimate_hours;
        $task->estimate_minutes = $request->estimate_minutes;

        if ($request->board_column_id) {
            $task->board_column_id = $request->board_column_id;
        }

        $waitingApprovalTaskBoardColumn = TaskboardColumn::waitingForApprovalColumn();
        if ($request->board_column_id == $waitingApprovalTaskBoardColumn->id) {
            $task->approval_send = 1;
        } else {
            $task->approval_send = 0;
        }

        if ($request->milestone_id != '') {
            $task->milestone_id = $request->milestone_id;
        }

        // Add repeated task
        $task->repeat = $request->repeat ? 1 : 0;

        if ($project) {
            $projectLastTaskCount = Task::projectTaskCount($project->id);

            if (isset($project->project_short_code)) {
                $task->task_short_code = $project->project_short_code.'-'.$this->getTaskShortCode($project->project_short_code, $projectLastTaskCount);
            } else {
                $task->task_short_code = $projectLastTaskCount + 1;
            }
        }

        $task->save();

        // Save labels

        $task->labels()->sync($request->task_labels);

        // Attach polymorphic relation if provided
        if ($request->has('taskable_type') && $request->has('taskable_id')) {
            $type = $request->taskable_type;
            $id = $request->taskable_id;

            $modelClass = null;
            switch (strtolower($type)) {
                case 'deal': $modelClass = \App\Models\Deal::class;
                    break;
                case 'lead': $modelClass = \App\Models\Lead::class;
                    break;
                case 'property': $modelClass = \App\Models\Property::class;
                    break;
            }

            if ($modelClass) {
                $entity = $modelClass::find($id);
                if ($entity) {
                    $entity->tasks()->syncWithoutDetaching([$task->id]);

                    // Auto-assign deal agent if applicable
                    if (strtolower($type) === 'deal' && $entity->agent_id) {
                        $agentUserId = \App\Models\LeadAgent::find($entity->agent_id)?->user_id;
                        if ($agentUserId) {
                            $task->users()->syncWithoutDetaching([$agentUserId]);
                        }
                    }
                }
            }
        }

        // Multi-record linking from the redesigned task modal.
        $this->syncTaskLinks($task, $request);
        $this->syncTaskReminders($task);

        if (! is_null($request->taskId)) {

            $taskExists = TaskFile::where('task_id', $request->taskId)->get();

            if ($taskExists) {
                foreach ($taskExists as $taskExist) {
                    $file = new TaskFile;
                    $file->user_id = $taskExist->user_id;
                    $file->task_id = $task->id;

                    $fileName = Files::generateNewFileName($taskExist->filename);

                    Files::copy(TaskFile::FILE_PATH.'/'.$taskExist->task_id.'/'.$taskExist->hashname, TaskFile::FILE_PATH.'/'.$task->id.'/'.$fileName);

                    $file->filename = $taskExist->filename;
                    $file->hashname = $fileName;
                    $file->size = $taskExist->size;
                    $file->save();

                    $this->logTaskActivity($task->id, $this->user->id, 'fileActivity', $task->board_column_id);
                }
            }

            $subTask = SubTask::with(['files'])->where('task_id', $request->taskId)->get();

            if ($subTask) {
                foreach ($subTask as $subTasks) {
                    $subTaskData = new SubTask;
                    $subTaskData->title = $subTasks->title;
                    $subTaskData->task_id = $task->id;
                    $subTaskData->description = trim_editor($subTasks->description);

                    if ($subTasks->start_date != '' && $subTasks->due_date != '') {
                        $subTaskData->start_date = $subTasks->start_date;
                        $subTaskData->due_date = $subTasks->due_date;
                    }

                    $subTaskData->assigned_to = $subTasks->assigned_to;

                    $subTaskData->save();

                    if ($subTasks->files) {
                        foreach ($subTasks->files as $fileData) {
                            $file = new SubTaskFile;
                            $file->user_id = $fileData->user_id;
                            $file->sub_task_id = $subTaskData->id;

                            $fileName = Files::generateNewFileName($fileData->filename);

                            Files::copy(SubTaskFile::FILE_PATH.'/'.$fileData->sub_task_id.'/'.$fileData->hashname, SubTaskFile::FILE_PATH.'/'.$subTaskData->id.'/'.$fileName);

                            $file->filename = $fileData->filename;
                            $file->hashname = $fileName;
                            $file->size = $fileData->size;
                            $file->save();
                        }
                    }
                }
            }
        }

        // To add custom fields data
        if ($request->custom_fields_data) {
            $task->updateCustomFieldData($request->custom_fields_data);
        }

        // For gantt chart
        if ($request->page_name && ! is_null($task->due_date) && $request->page_name == 'ganttChart') {
            $task = Task::find($task->id);
            $parentGanttId = $request->parent_gantt_id;

            /* @phpstan-ignore-next-line */

            $taskDuration = $task->due_date->diffInDays($task->start_date);
            /* @phpstan-ignore-line */
            $taskDuration = $taskDuration + 1;

            $ganttTaskArray[] = [
                'id' => $task->id,
                'text' => $task->heading,
                'start_date' => $task->start_date->format('Y-m-d'), /* @phpstan-ignore-line */
                'duration' => $taskDuration,
                'parent' => $parentGanttId,
                'taskid' => $task->id,
            ];

            $gantTaskLinkArray[] = [
                'id' => 'link_'.$task->id,
                'source' => $task->dependent_task_id != '' ? $task->dependent_task_id : $parentGanttId,
                'target' => $task->id,
                'type' => $task->dependent_task_id != '' ? 0 : 1,
            ];
        }

        DB::commit();

        if (request()->add_more == 'true') {
            unset($request->project_id);
            $html = $this->create();

            return Reply::successWithData(__('messages.taskSaved'), ['html' => $html, 'add_more' => true, 'taskID' => $task->id]);
        }

        if ($request->page_name && $request->page_name == 'ganttChart') {

            return Reply::successWithData(
                'messages.taskSaved',
                [
                    'tasks' => $ganttTaskArray,
                    'links' => $gantTaskLinkArray,
                ]
            );
        }

        $redirectUrl = urldecode($request->redirect_url);

        if ($redirectUrl == '') {
            $redirectUrl = route('tasks.index');
        }

        return Reply::successWithData(__('messages.taskSaved'), ['redirectUrl' => $redirectUrl, 'taskID' => $task->id, 'data' => $task]);

    }

    /**
     * XXXXXXXXXXX
     *
     * @return \Illuminate\Contracts\Foundation\Application|\Illuminate\Contracts\View\Factory|\Illuminate\Contracts\View\View|\Illuminate\Http\Response
     */
    public function edit($id)
    {
        $editTaskPermission = user()->permission('edit_tasks');
        $this->task = Task::with('users', 'label', 'project')->findOrFail($id)->withCustomFields();
        $this->taskUsers = $taskUsers = $this->task->users->pluck('id')->toArray();
        $this->type = request()->type;
        abort_403(
            ! ($editTaskPermission == 'all'
                || ($editTaskPermission == 'owned' && in_array(user()->id, $taskUsers))
                || ($editTaskPermission == 'added' && $this->task->added_by == user()->id)
                || ($this->task->project && ($this->task->project->project_admin == user()->id))
                || ($editTaskPermission == 'both' && (in_array(user()->id, $taskUsers) || $this->task->added_by == user()->id))
                || ($editTaskPermission == 'owned' && (in_array('client', user_roles()) && $this->task->project && ($this->task->project->client_id == user()->id)))
                || ($editTaskPermission == 'both' && (in_array('client', user_roles()) && ($this->task->project && ($this->task->project->client_id == user()->id)) || $this->task->added_by == user()->id))
            )
        );

        // The redesigned workspace has no standalone edit page — /tasks/{id}/edit
        // renders the list/board view with the Edit Task popup pre-opened for
        // this task instead, so the URL stays /tasks/{id}/edit. The permission
        // check above already gates this; only the render target changes.
        if (\App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign') && ! $this->isLegacyAjaxFragmentRequest()) {
            return $this->index((int) $id, openMode: 'edit');
        }

        $getCustomFieldGroupsWithFields = $this->task->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $this->pageTitle = __('modules.tasks.updateTask');
        $this->labelIds = $this->task->label->pluck('label_id')->toArray();
        $this->projects = Project::allProjects(true);
        $this->categories = TaskCategory::all();
        $projectId = $this->task->project_id;

        if ($projectId) {
            $this->taskLabels = TaskLabelList::where('project_id', $projectId)->orWhereNull('project_id')->get();
        } else {
            $this->taskLabels = TaskLabelList::whereNull('project_id')->get();
        }

        $this->taskboardColumns = TaskboardColumn::orderBy('priority', 'asc')->get();
        $this->changeStatusPermission = user()->permission('change_status');
        $completedTaskColumn = TaskboardColumn::where('slug', '=', 'done')->first();
        $this->waitingApprovalTaskBoardColumn = TaskboardColumn::waitingForApprovalColumn();
        if ($completedTaskColumn) {
            $this->allTasks = Task::where('board_column_id', '<>', $completedTaskColumn->id)->whereNotNull('due_date')->where('id', '!=', $id)->where('project_id', $projectId)->get();
        } else {
            $this->allTasks = [];
        }

        if ($this->task->project_id) {
            if ($this->task->project->public) {
                $this->employees = User::allEmployees(null, false, ($editTaskPermission == 'all' ? 'all' : null));

            } else {
                $this->employees = $this->task->project->projectMembersWithoutScope;
            }
        } else {
            if ($editTaskPermission == 'added' || $editTaskPermission == 'owned') {
                $this->employees = ((count($this->task->users) > 0) ? $this->task->users : User::allEmployees(null, true, ($editTaskPermission == 'all' ? 'all' : null)));

            } else {
                $this->employees = User::allEmployees(null, false, ($editTaskPermission == 'all' ? 'all' : null));
            }
        }

        $uniqueId = $this->task->task_short_code;
        // check if unuqueId contains -
        if (strpos($uniqueId, '-') !== false) {
            $uniqueId = explode('-', $uniqueId, 2);
            $this->projectUniId = $uniqueId[0];
            $this->taskUniId = $uniqueId[1];
        } else {
            $this->projectUniId = ($this->task->project_id != null) ? $this->task->project->project_short_code : null;
            $this->taskUniId = $uniqueId;
        }

        $userId = $this->task->users->pluck('id')->toArray();
        $startDate = $this->task->start_date;
        $dueDate = $this->task->due_date;
        $leaves = $this->leaves($userId, $startDate, $dueDate);

        if (! is_null($leaves)) {
            $data = [];

            foreach ($leaves as $key => $value) {
                $values = implode(', ', $value);
                $data[] = $key.__('modules.tasks.leaveOn').' '.$values;
            }

            $this->leaveData = implode("\n", $data);
            /* @phpstan-ignore-line */

        }

        $userData = [];

        $usersData = $this->employees;

        foreach ($usersData as $user) {

            $url = route('employees.show', [$user->id]);

            $userData[] = ['id' => $user->id, 'value' => $user->name, 'image' => $user->image_url, 'link' => $url];

        }

        $this->userData = $userData;

        $this->view = 'tasks.ajax.edit';

        if (request()->ajax()) {
            return $this->returnAjax($this->view);
        }

        return view('tasks.create', $this->data);

    }

    /**
     * Whether the current user may edit this task.
     *
     * Extracted so update() and reschedule() cannot drift apart — a narrower
     * endpoint with a laxer check is worse than no narrow endpoint.
     */
    private function canEditTask(Task $task): bool
    {
        $taskUsers = $task->users->pluck('id')->toArray();
        $editTaskPermission = user()->permission('edit_tasks');

        return $editTaskPermission == 'all'
            || ($editTaskPermission == 'owned' && in_array(user()->id, $taskUsers))
            || ($editTaskPermission == 'added' && $task->added_by == user()->id)
            || ($task->project && ($task->project->project_admin == user()->id))
            || ($editTaskPermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
            || ($editTaskPermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
            || ($editTaskPermission == 'both' && (in_array('client', user_roles()) && ($task->project && ($task->project->client_id == user()->id)) || $task->added_by == user()->id));
    }

    /**
     * Move a task's due date and nothing else.
     *
     * The dashboard queue reschedules from a row, not a form. Routing that
     * through update() would resend heading, description, priority and the
     * assignee list from a snapshot that may be minutes stale, so rescheduling
     * could silently revert a concurrent edit made on the task page. This
     * touches one column.
     */
    public function reschedule(Request $request, $id)
    {
        $request->validate([
            'due_date' => 'required|date_format:Y-m-d',
            'due_time' => 'nullable|date_format:H:i',
        ]);

        $task = Task::with('users', 'project')->findOrFail($id);

        if (! $this->canEditTask($task) || $this->isWatcherOnlyOnTaskDeals($task)) {
            return Reply::error(__('messages.permissionDenied'));
        }

        $task->due_date = Carbon::parse($request->due_date.' '.($request->due_time ?: '17:00'));
        $task->save();

        // A moved due date with unmoved reminders fires at the old time.
        app(TaskReminderSync::class)->syncFromTask(
            $task->fresh(['users', 'boardColumn', 'createBy', 'addedByUser'])
        );

        return Reply::successWithData(__('messages.taskUpdateSuccess'), [
            'data' => $task->load(['users', 'boardColumn'])->toFrontendArray(),
        ]);
    }

    public function update(UpdateTask $request, $id)
    {
        $task = Task::with('users', 'label', 'project')->findOrFail($id);

        if (! $this->canEditTask($task)) {
            return Reply::error(__('messages.permissionDenied'));
        }

        if ($this->isWatcherOnlyOnTaskDeals($task)) {
            return Reply::error(__('messages.permissionDenied'));
        }

        try {
            $data = $request->all();
            $task = $this->taskService->updateTask($task, $data, user());

            // TaskService::updateTask only handles the legacy single
            // taskable_type/taskable_id pair — the redesigned modal's
            // multi-link `links` payload is synced separately here.
            $this->syncTaskLinks($task, $request);

            $task->load(TaskPresenter::RELATIONS)->loadCount(TaskPresenter::COUNTS);

            return Reply::successWithData(__('messages.taskUpdateSuccess'), [
                'project' => $task->project,
                'data' => $this->presentTask($task),
                'redirectUrl' => route('tasks.show', $task->id),
            ]);

        } catch (\Exception $e) {
            return Reply::error($e->getMessage());
        }
    }

    public function updateDeprecated(UpdateTask $request, $id)
    {
        $task = Task::with('users', 'label', 'project')->findOrFail($id);
        $editTaskPermission = user()->permission('edit_tasks');
        $taskUsers = $task->users->pluck('id')->toArray();

        if (! ($editTaskPermission == 'all'
            || ($editTaskPermission == 'owned' && in_array(user()->id, $taskUsers))
            || ($editTaskPermission == 'added' && $task->added_by == user()->id)
            || ($task->project && ($task->project->project_admin == user()->id))
            || ($editTaskPermission == 'both' && (in_array(user()->id, $taskUsers) || $task->added_by == user()->id))
            || ($editTaskPermission == 'owned' && (in_array('client', user_roles()) && $task->project && ($task->project->client_id == user()->id)))
            || ($editTaskPermission == 'both' && (in_array('client', user_roles()) && ($task->project && ($task->project->client_id == user()->id)) || $task->added_by == user()->id))
        )) {
            return Reply::error(__('messages.permissionDenied'));
        }

        $dueDate = ($request->has('without_duedate')) ? null : Carbon::createFromFormat(company()->date_format.' '.company()->time_format, $request->due_date);
        $task->heading = $request->heading;
        $task->description = trim_editor($request->description);
        $task->start_date = $request->start_date ? Carbon::createFromFormat(company()->date_format.' '.company()->time_format, $request->start_date) : null;
        $task->due_date = $dueDate;
        $task->task_category_id = $request->category_id;
        $task->priority = $request->priority;

        if ($request->has('board_column_id')) {

            $task->board_column_id = $request->board_column_id;
            $task->approval_send = 0;
            $taskBoardColumn = TaskboardColumn::findOrFail($request->board_column_id);

            if ($taskBoardColumn->slug == 'done') {
                $task->completed_on = now()->format('Y-m-d');
            } else {
                $task->completed_on = null;
            }
        }

        if ($request->select_value == 'Waiting Approval') {

            $taskBoardColumn = TaskboardColumn::where('column_name', $request->select_value)->where('company_id', company()->id)->first();
            $task->board_column_id = $taskBoardColumn->id;
            $task->approval_send = 1;
        }

        $task->dependent_task_id = $request->has('dependent') && $request->has('dependent_task_id') && $request->dependent_task_id != '' ? $request->dependent_task_id : null;
        $task->is_private = $request->has('is_private') ? 1 : 0;
        $task->billable = $request->has('billable') && $request->billable ? 1 : 0;
        $task->estimate_hours = $request->estimate_hours;
        $task->estimate_minutes = $request->estimate_minutes;

        if ($request->project_id != '') {
            $task->project_id = $request->project_id;
            ProjectTimeLog::where('task_id', $id)->update(['project_id' => $request->project_id]);
        } else {
            $task->project_id = null;
        }

        if ($request->has('milestone_id')) {
            $task->milestone_id = $request->milestone_id;
        }

        if ($request->has('dependent') && $request->has('dependent_task_id') && $request->dependent_task_id != '') {
            $dependentTask = Task::findOrFail($request->dependent_task_id);

            if (! is_null($dependentTask->due_date) && ! is_null($dueDate) && $dependentTask->due_date->greaterThan($dueDate)) {
                return Reply::error(__('messages.taskDependentDate'));
            }

            $task->dependent_task_id = $request->dependent_task_id;
        }

        // Add repeated task
        $task->repeat = $request->repeat ? 1 : 0;

        if ($request->has('repeat')) {
            $task->repeat_count = $request->repeat_count;
            $task->repeat_type = $request->repeat_type;
            $task->repeat_cycles = $request->repeat_cycles;
        }

        $task->load('project');

        $project = $task->project;

        if ($project && $task->isDirty('project_id')) {
            $projectLastTaskCount = Task::projectTaskCount($project->id);
            $task->task_short_code = $project->project_short_code.'-'.$this->getTaskShortCode($project->project_short_code, $projectLastTaskCount);
        }
        $task->save();

        // save labels
        $task->labels()->sync($request->task_labels);

        // Multi-record linking from the redesigned task modal.
        $this->syncTaskLinks($task, $request);
        $this->syncTaskReminders($task);

        // To add custom fields data
        if ($request->custom_fields_data) {
            $task->updateCustomFieldData($request->custom_fields_data);
        }

        // Sync task users
        if ($request->has('user_id')) {
            $task->users()->sync($request->user_id);
        }

        if (! empty($request->user_id)) {
            $newlyAssignedUserIds = array_diff($request->user_id, $taskUsers);
            if (! empty($newlyAssignedUserIds)) {
                $newUsers = User::whereIn('id', $newlyAssignedUserIds)->get();
                event(new TaskEvent($task, $newUsers, 'NewTask'));
            }
        }

        return Reply::successWithData(__('messages.taskUpdateSuccess'), ['redirectUrl' => route('tasks.show', $id)]);
    }

    /**
     * @return mixed
     */
    public function getTaskShortCode($projectShortCode, $lastProjectCount)
    {
        $task = Task::where('task_short_code', $projectShortCode.'-'.$lastProjectCount)->exists();

        if ($task) {
            return $this->getTaskShortCode($projectShortCode, $lastProjectCount + 1);
        }

        return $lastProjectCount;

    }

    public function showDeprecated($id)
    {

        $viewTaskFilePermission = user()->permission('view_task_files');
        $viewSubTaskPermission = user()->permission('view_sub_tasks');
        $this->viewTaskCommentPermission = user()->permission('view_task_comments');
        $this->viewTaskNotePermission = user()->permission('view_task_notes');
        $this->viewUnassignedTasksPermission = user()->permission('view_unassigned_tasks');
        $this->userId = UserService::getUserId();
        $this->clientIds = ClientContact::where('user_id', $this->userId)->pluck('client_id')->toArray();

        $this->task = Task::with(
            ['boardColumn', 'project', 'users', 'label', 'approvedTimeLogs', 'mentionTask',
                'approvedTimeLogs.user', 'approvedTimeLogs.activeBreak', 'comments', 'activeUsers',
                'comments.commentEmoji', 'comments.like', 'comments.dislike', 'comments.likeUsers',
                'comments.dislikeUsers', 'comments.user', 'subtasks.files', 'userActiveTimer', 'dependentTask',
                'files' => function ($q) use ($viewTaskFilePermission) {
                    if ($viewTaskFilePermission == 'added') {
                        $q->where('added_by', $this->userId);
                    }
                },
                'subtasks' => function ($q) use ($viewSubTaskPermission) {
                    if ($viewSubTaskPermission == 'added') {
                        $q->where('added_by', $this->userId);
                    }
                }]
        )
            ->withCount('subtasks', 'files', 'comments', 'activeTimerAll')
            ->findOrFail($id)->withCustomFields();

        $this->taskUsers = $taskUsers = $this->task->users->pluck('id')->toArray();

        $taskuserData = [];

        $usersData = $this->task->users;

        if ($this->task->createBy && ! in_array($this->task->createBy->id, $taskUsers)) {
            $url = route('employees.show', [$this->task->createBy->user_id ?? $this->task->createBy->id]);
            $taskuserData[] = ['id' => $this->task->createBy->user_id ?? $this->task->createBy->id, 'value' => $this->task->createBy->user->name ?? $this->task->createBy->name, 'image' => $this->task->createBy->user->image_url ?? $this->task->createBy->image_url, 'link' => $url];
        }

        foreach ($usersData as $user) {

            $url = route('employees.show', [$user->user_id ?? $user->id]);
            $taskuserData[] = ['id' => $user->user_id ?? $user->id, 'value' => $user->user->name ?? $user->name, 'image' => $user->user->image_url ?? $user->image_url, 'link' => $url];

        }

        $this->taskuserData = $taskuserData;

        $this->taskSettings = TaskSetting::first();
        $viewTaskPermission = user()->permission('view_tasks');
        $mentionUser = $this->task->mentionTask->pluck('user_id')->toArray();

        $overrideViewPermission = false;

        if (request()->has('tab') && request('tab') === 'project') {
            $overrideViewPermission = true;
        }

        abort_403(
            ! (
                $overrideViewPermission == true
                || TaskVisibilityService::userCanViewTask($this->task, user(), $viewTaskPermission, $taskUsers)
                || ($viewTaskPermission == 'owned' && in_array('client', user_roles()) && $this->task->project_id && $this->task->project->client_id == $this->userId)
                || ($viewTaskPermission == 'both' && in_array('client', user_roles()) && $this->task->project_id && $this->task->project->client_id == $this->userId)
                || ($this->viewUnassignedTasksPermission == 'all' && in_array('employee', user_roles()))
                || ($this->task->project_id && $this->task->project->project_admin == $this->userId)
                || ((! is_null($this->task->mentionTask)) && in_array($this->userId, $mentionUser))
            )

        );

        if (! $this->task->project_id || ($this->task->project_id && $this->task->project->project_admin != $this->userId)) {

            abort_403($this->viewUnassignedTasksPermission == 'none' && count($taskUsers) == 0 && ((is_null($this->task->mentionTask)) && in_array($userId, $mentionUser)));

        }

        if ($this->task->task_short_code) {
            $this->pageTitle = __('app.task').' # '.$this->task->task_short_code;
        } else {
            $this->pageTitle = __('app.task');
        }
        $this->status = TaskboardColumn::where('id', $this->task->board_column_id)->first();
        $getCustomFieldGroupsWithFields = $this->task->getCustomFieldGroupsWithFields();

        if ($getCustomFieldGroupsWithFields) {
            $this->fields = $getCustomFieldGroupsWithFields->fields;
        }

        $this->employees = User::join('employee_details', 'users.id', '=', 'employee_details.user_id')
            ->leftJoin('project_time_logs', 'project_time_logs.user_id', '=', 'users.id')
            ->leftJoin('designations', 'employee_details.designation_id', '=', 'designations.id');

        $this->employees = $this->employees->select(
            'users.name',
            'users.image',
            'users.id',
            'designations.name as designation_name'
        );

        $this->employees = $this->employees->where('project_time_logs.task_id', '=', $id);

        $this->employees = $this->employees->groupBy('project_time_logs.user_id')
            ->orderBy('users.name')
            ->get();

        $this->breakMinutes = ProjectTimeLogBreak::taskBreakMinutes($this->task->id);

        // Add Gitlab task details if available
        if (module_enabled('Gitlab')) {
            if (in_array('gitlab', user_modules()) && ! is_null($this->task->project_id)) {

                /** @phpstan-ignore-next-line */
                $this->gitlabSettings = \Modules\Gitlab\Entities\GitlabSetting::where('user_id', $this->userId)->first();

                if (! $this->gitlabSettings) {
                    /** @phpstan-ignore-next-line */
                    $this->gitlabSettings = \Modules\Gitlab\Entities\GitlabSetting::whereNull('user_id')->first();
                }

                if ($this->gitlabSettings) {
                    /** @phpstan-ignore-next-line */
                    Config::set('gitlab.connections.main.token', $this->gitlabSettings->personal_access_token);
                    /** @phpstan-ignore-next-line */
                    Config::set('gitlab.connections.main.url', $this->gitlabSettings->gitlab_url);

                    /** @phpstan-ignore-next-line */
                    $gitlabProject = \Modules\Gitlab\Entities\GitlabProject::where('project_id', $this->task->project_id)->first();
                    /** @phpstan-ignore-next-line */
                    $gitlabTask = \Modules\Gitlab\Entities\GitlabTask::where('task_id', $id)->first();

                    if ($gitlabTask) {
                        /** @phpstan-ignore-next-line */
                        $gitlabIssue = \GrahamCampbell\GitLab\Facades\GitLab::issues()->all(intval($gitlabProject->gitlab_project_id), ['iids' => [intval($gitlabTask->gitlab_task_iid)]]);

                        if ($gitlabIssue) {
                            $this->gitlabIssue = $gitlabIssue[0];
                        }
                    }
                }
            }
        }

        $tab = request('view');

        switch ($tab) {
            case 'sub_task':
                $this->tab = 'tasks.ajax.sub_tasks';
                break;
            case 'comments':
                abort_403($this->viewTaskCommentPermission == 'none');

                $this->tab = 'tasks.ajax.comments';
                break;
            case 'notes':
                abort_403($this->viewTaskNotePermission == 'none');
                $this->tab = 'tasks.ajax.notes';
                break;
            case 'history':
                $this->tab = 'tasks.ajax.history';
                break;
            case 'time_logs':
                abort_403(! in_array('timelogs', user_modules()));
                $this->tab = 'tasks.ajax.timelogs';
                break;
            default:
                if ($this->taskSettings->files == 'yes' && in_array('client', user_roles())) {
                    $this->tab = 'tasks.ajax.files';
                } elseif ($this->taskSettings->sub_task == 'yes' && in_array('client', user_roles())) {
                    $this->tab = 'tasks.ajax.sub_tasks';
                } elseif ($this->taskSettings->comments == 'yes' && in_array('client', user_roles())) {
                    abort_403($this->viewTaskCommentPermission == 'none');
                    $this->tab = 'tasks.ajax.comments';
                } elseif ($this->taskSettings->time_logs == 'yes' && in_array('client', user_roles())) {
                    abort_403($this->viewTaskNotePermission == 'none');
                    $this->tab = 'tasks.ajax.timelogs';
                } elseif ($this->taskSettings->notes == 'yes' && in_array('client', user_roles())) {
                    abort_403($this->viewTaskNotePermission == 'none');
                    $this->tab = 'tasks.ajax.notes';
                } elseif ($this->taskSettings->history == 'yes' && in_array('client', user_roles())) {
                    abort_403($this->viewTaskNotePermission == 'none');
                    $this->tab = 'tasks.ajax.history';
                } elseif (! in_array('client', user_roles())) {
                    $this->tab = 'tasks.ajax.files';
                }
                break;
        }

        if (request()->ajax()) {
            $view = request('json') ? $this->tab : 'tasks.ajax.show';

            return $this->returnAjax($view);
        }

        $this->view = 'tasks.ajax.show';

        return view('tasks.create', $this->data);

    }

    public function show($id)
    {
        $viewTaskFilePermission = user()->permission('view_task_files');
        $viewSubTaskPermission = user()->permission('view_sub_tasks');
        $viewTaskCommentPermission = user()->permission('view_task_comments');
        $viewTaskNotePermission = user()->permission('view_task_notes');
        $viewUnassignedTasksPermission = user()->permission('view_unassigned_tasks');
        $userId = UserService::getUserId();

        // Load task with all necessary relationships
        $task = Task::with([
            'boardColumn',
            'project',
            'users',
            'labels',
            'category',
            'approvedTimeLogs',
            'mentionTask',
            'createBy',
            'addedByUser',
            'deals',
            'leads',
            'properties',
            'files' => function ($q) use ($viewTaskFilePermission, $userId) {
                if ($viewTaskFilePermission == 'added') {
                    $q->where('added_by', $userId);
                }
            },
            'subtasks' => function ($q) use ($viewSubTaskPermission, $userId) {
                if ($viewSubTaskPermission == 'added') {
                    $q->where('added_by', $userId);
                }
            },
            'comments' => function ($q) {
                $q->with('user')->orderByDesc('id')->limit(10);
            },
        ])
            ->withCount(['subtasks', 'files', 'comments', 'completedSubtasks', 'notes'])
            ->findOrFail($id);

        $taskUsers = $task->users->pluck('id')->toArray();
        $viewTaskPermission = user()->permission('view_tasks');
        $mentionUser = $task->mentionTask->pluck('user_id')->toArray();

        $overrideViewPermission = request()->has('tab') && request('tab') === 'project';

        // Permission check
        abort_403(
            ! (
                $overrideViewPermission == true
                || TaskVisibilityService::userCanViewTask($task, user(), $viewTaskPermission, $taskUsers)
                || ($viewTaskPermission == 'owned' && in_array('client', user_roles()) && $task->project_id && $task->project->client_id == $userId)
                || ($viewTaskPermission == 'both' && in_array('client', user_roles()) && $task->project_id && $task->project->client_id == $userId)
                || ($viewUnassignedTasksPermission == 'all' && in_array('employee', user_roles()))
                || ($task->project_id && $task->project->project_admin == $userId)
                || ((! is_null($task->mentionTask)) && in_array($userId, $mentionUser))
            )
        );

        if (! $task->project_id || ($task->project_id && $task->project->project_admin != $userId)) {
            abort_403($viewUnassignedTasksPermission == 'none' && count($taskUsers) == 0 && ((is_null($task->mentionTask)) && in_array($userId, $mentionUser)));
        }

        // The redesigned workspace has no standalone task page — /tasks/{id}
        // renders the exact same list/board view index() does, plus that
        // task's detail popup pre-opened, so the URL stays /tasks/{id}
        // rather than redirecting to a ?task= query param. The permission
        // checks above already gate this specific task; index($openTaskId)
        // trusts that and only additionally resolves+authorizes its own
        // default-filtered listing as normal.
        if (\App\Support\FeatureFlags::enabled('crm.tasks-workspace-redesign') && ! $this->isLegacyAjaxFragmentRequest()) {
            return $this->index((int) $task->id);
        }

        // Build page title
        $pageTitle = $task->task_short_code
            ? __('app.task').' #'.$task->task_short_code
            : __('app.task');

        // Legacy openRightModal / jQuery AJAX only — not Inertia visits (they also send X-Requested-With).
        if (request()->ajax() && ! request()->header('X-Inertia')) {
            $this->task = $task->loadMissing([
                'approvedTimeLogs',
                'approvedTimeLogs.user',
                'approvedTimeLogs.activeBreak',
                'activeTimerAll',
                'activeTimerAll.activeBreak',
                'activeTimerAll.breaks',
                'userActiveTimer',
                'userActiveTimer.activeBreak',
                'timeLogged',
                'dependentTask',
            ]);
            $this->viewTaskCommentPermission = $viewTaskCommentPermission;
            $this->viewTaskNotePermission = $viewTaskNotePermission;
            $this->viewUnassignedTasksPermission = $viewUnassignedTasksPermission;
            $this->taskSettings = TaskSetting::first();
            $this->status = TaskboardColumn::where('id', $task->board_column_id)->first();
            $this->taskUsers = $taskUsers;
            $this->userId = $userId;
            $this->clientIds = ClientContact::where('user_id', $userId)->pluck('client_id')->toArray();
            $this->breakMinutes = ProjectTimeLogBreak::taskBreakMinutes($this->task->id);
            $this->task->withCustomFields();
            $getCustomFieldGroupsWithFields = $this->task->getCustomFieldGroupsWithFields();

            if ($getCustomFieldGroupsWithFields) {
                $this->fields = $getCustomFieldGroupsWithFields->fields;
            }

            $tab = request('view');
            switch ($tab) {
                case 'sub_task':
                    $this->tab = 'tasks.ajax.sub_tasks';
                    break;
                case 'comments':
                    abort_403($viewTaskCommentPermission == 'none');
                    $this->tab = 'tasks.ajax.comments';
                    break;
                case 'notes':
                    abort_403($viewTaskNotePermission == 'none');
                    $this->tab = 'tasks.ajax.notes';
                    break;
                case 'history':
                    $this->tab = 'tasks.ajax.history';
                    break;
                case 'time_logs':
                    abort_403(! in_array('timelogs', user_modules()));
                    $this->tab = 'tasks.ajax.timelogs';
                    break;
                default:
                    $this->tab = 'tasks.ajax.files';
                    break;
            }

            $view = request('json') ? $this->tab : 'tasks.ajax.show';

            return $this->returnAjax($view);
        }

        // Calculate time spent from time logs
        $timeSpentMinutes = $task->approvedTimeLogs->sum('total_minutes');

        // Transform task for frontend
        $transformedTask = [
            'id' => $task->id,
            'heading' => $task->heading,
            'description' => $task->description,
            'due_date' => Task::wallClockString($task->due_date),
            'start_date' => Task::wallClockString($task->start_date),
            'priority' => $task->priority,
            'status' => $task->boardColumn?->slug ?? 'to_do',
            'board_column_id' => $task->board_column_id,
            'completed_on' => Task::wallClockString($task->completed_on),
            'task_short_code' => $task->task_short_code,
            'is_private' => (bool) $task->is_private,
            'billable' => (bool) $task->billable,
            'estimate_hours' => $task->estimate_hours,
            'estimate_minutes' => $task->estimate_minutes,
            'created_at' => $task->created_at?->toISOString(),
            'updated_at' => $task->updated_at?->toISOString(),
            'files_count' => $task->files_count,
            'comments_count' => $task->comments_count,
            'notes_count' => $task->notes_count,
            'subtasks_count' => $task->subtasks_count,
            'completed_subtasks_count' => $task->completed_subtasks_count,
            'board_column' => $task->boardColumn ? [
                'id' => $task->boardColumn->id,
                'column_name' => $task->boardColumn->column_name,
                'slug' => $task->boardColumn->slug,
                'label_color' => $task->boardColumn->label_color,
            ] : null,
            'project' => $task->project ? [
                'id' => $task->project->id,
                'project_name' => $task->project->project_name,
                'project_short_code' => $task->project->project_short_code,
            ] : null,
            'category' => $task->category ? [
                'id' => $task->category->id,
                'category_name' => $task->category->category_name,
            ] : null,
            'users' => $task->users->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'image' => $user->image_url,
                'designation_name' => $user->employeeDetail?->designation?->name,
            ])->toArray(),
            'labels' => $task->labels->map(fn ($label) => [
                'id' => $label->id,
                'label_name' => $label->label_name,
                'label_color' => $label->label_color,
            ])->toArray(),
            'deals' => $task->deals->map(fn ($deal) => [
                'id' => $deal->id,
                'name' => $deal->name,
            ])->toArray(),
            'leads' => $task->leads->map(fn ($lead) => [
                'id' => $lead->id,
                'client_name' => $lead->client_name,
                'company_name' => $lead->company_name,
            ])->toArray(),
            'properties' => $task->properties->map(fn ($property) => [
                'id' => $property->id,
                'name' => $property->title,
            ])->toArray(),
            'subtasks' => $task->subtasks->map(fn ($subtask) => [
                'id' => $subtask->id,
                'title' => $subtask->title,
                'status' => $subtask->status,
                'due_date' => Task::wallClockString($subtask->due_date),
            ])->toArray(),
            'time_logs' => [
                ['total_minutes' => $timeSpentMinutes],
            ],
            'created_by' => TaskVisibilityService::formatAssigner($task),
            'assigner' => TaskVisibilityService::formatAssigner($task),
        ];

        // Get user permissions
        $permissions = [
            'add_tasks' => user()->permission('add_tasks'),
            'edit_tasks' => user()->permission('edit_tasks'),
            'delete_tasks' => user()->permission('delete_tasks'),
            'view_tasks' => $viewTaskPermission,
        ];

        return Inertia::render('Tasks/Show', [
            'task' => $transformedTask,
            'permissions' => $permissions,
            'pageTitle' => $pageTitle,

            // Edit/duplicate modal lookup data is nonessential for first paint.
            'categories' => Inertia::defer(fn () => $this->taskCategoriesForSelect(), 'taskMeta'),
            'labels' => Inertia::defer(fn () => $this->taskLabelsForSelect(), 'taskMeta'),
            'columns' => Inertia::defer(fn () => $this->taskColumnsForSelect(), 'taskMeta'),
            'users' => Inertia::defer(
                fn () => $this->taskUsersForSelect($viewTaskPermission, true),
                'taskMeta'
            ),
            'projects' => Inertia::defer(fn () => $this->taskProjectsForSelect(), 'taskLinkMeta'),
            'deals' => Inertia::defer(fn () => Deal::select('id', 'name')->get(), 'taskLinkMeta'),
            'leads' => Inertia::defer(fn () => Lead::select('id', 'client_name', 'company_name')->get(), 'taskLinkMeta'),
            'properties' => Inertia::defer(fn () => Property::select('id', 'title as name')->get(), 'taskLinkMeta'),
            'developerProjects' => Inertia::defer(fn () => DeveloperProject::select('id', 'name')->orderBy('name')->get(), 'taskLinkMeta'),
        ]);
    }

    private function taskProjectsForSelect()
    {
        return Project::allProjects()->map(fn ($project) => [
            'id' => $project->id,
            'project_name' => $project->project_name,
            'project_short_code' => $project->project_short_code,
        ]);
    }

    private function taskUsersForSelect(string $viewPermission, bool $useImageUrl = false)
    {
        return User::allEmployees(null, true, ($viewPermission == 'all' ? 'all' : null))->map(fn ($user) => [
            'id' => $user->id,
            'name' => $user->name,
            'image' => $useImageUrl ? $user->image_url : $user->image,
            'designation_name' => $useImageUrl
                ? $user->employeeDetail?->designation?->name
                : ($user->designation_name ?? null),
        ]);
    }

    private function taskColumnsForSelect()
    {
        return TaskboardColumn::orderBy('priority', 'asc')->get()->map(fn ($column) => [
            'id' => $column->id,
            'column_name' => $column->column_name,
            'slug' => $column->slug,
            'label_color' => $column->label_color,
            'priority' => $column->priority,
        ]);
    }

    private function taskCategoriesForSelect()
    {
        return TaskCategory::all()->map(fn ($category) => [
            'id' => $category->id,
            'category_name' => $category->category_name,
        ]);
    }

    private function taskLabelsForSelect()
    {
        return TaskLabelList::all()->map(fn ($label) => [
            'id' => $label->id,
            'label_name' => $label->label_name,
            'label_color' => $label->label_color,
        ]);
    }

    /**
     * Redesigned tasks workspace quick pills (mine / open / overdue …).
     * Applied after the main filter set, before pagination.
     */
    private function applyTasksQuickFilter($query, string $quickFilter): void
    {
        if ($quickFilter === '' || $quickFilter === 'all') {
            return;
        }

        $userId = user()->id;

        switch ($quickFilter) {
            case 'mine':
                $query->whereHas('users', fn ($q) => $q->where('users.id', $userId));
                break;
            case 'byme':
                $query->where('tasks.added_by', $userId);
                break;
            case 'open':
                $query->whereHas('boardColumn', fn ($q) => $q->where('slug', '!=', 'done'));
                break;
            case 'today':
                $query->whereDate('due_date', now()->toDateString());
                break;
            case 'overdue':
                $query->whereNotNull('due_date')
                    ->where('due_date', '<', now())
                    ->whereHas('boardColumn', fn ($q) => $q->where('slug', '!=', 'done'));
                break;
            case 'mentioned':
                if (\Illuminate\Support\Facades\Schema::hasTable('task_participants')) {
                    $query->whereHas('participants', fn ($q) => $q->where('users.id', $userId));
                } else {
                    $query->whereRaw('0 = 1');
                }
                break;
        }
    }

    public function storePin(Request $request)
    {
        $userId = UserService::getUserId();
        $pinned = new Pinned;
        $pinned->task_id = $request->task_id;
        $pinned->project_id = $request->project_id;
        $pinned->user_id = $userId;
        $pinned->save();

        return Reply::success(__('messages.pinnedSuccess'));
    }

    public function destroyPin(Request $request, $id)
    {
        $userId = UserService::getUserId();
        $type = ($request->type == 'task') ? 'task_id' : 'project_id';

        Pinned::where($type, $id)->where('user_id', $userId)->delete();

        return Reply::success(__('messages.deleteSuccess'));
    }

    public function checkTask($taskID)
    {
        $task = Task::withTrashed()->findOrFail($taskID);
        $subTask = SubTask::where(['task_id' => $taskID, 'status' => 'incomplete'])->count();

        return Reply::dataOnly(['taskCount' => $subTask, 'lastStatus' => $task->boardColumn->slug]);
    }

    public function sendApproval(Request $request)
    {

        $task = Task::findOrFail($request->taskId);
        $taskBoardColumn = TaskboardColumn::where('slug', 'in_review')->first();

        $task->approval_send = $request->isApproval ?? 0;
        $task->board_column_id = $taskBoardColumn->id;
        $task->save();

        return Reply::success(__('messages.updateSuccess'));
    }

    public function waitingApproval(WaitingForApprovalDataTable $dataTable)
    {
        $viewPermission = user()->permission('view_tasks');

        abort_403(! in_array($viewPermission, ['all', 'added', 'owned', 'both']));

        if (! request()->ajax()) {
            $this->assignedTo = request()->assignedTo;

            if (request()->has('assignee') && request()->assignee == 'me') {
                $this->assignedTo = user()->id;
            }

            $this->projects = Project::allProjects();

            if (in_array('client', user_roles())) {
                $this->clients = User::client();
            } else {
                $this->clients = User::allClients();
            }

            $this->employees = User::allEmployees(null, true, ($viewPermission == 'all' ? 'all' : null));
            $this->taskBoardStatus = TaskboardColumn::all();
            $this->taskCategories = TaskCategory::all();
            $this->taskLabels = TaskLabelList::all();
            $this->milestones = ProjectMilestone::all();

            $taskBoardColumn = TaskboardColumn::waitingForApprovalColumn();

            $projectIds = Project::where('project_admin', user()->id)->pluck('id');

            if (! in_array('admin', user_roles()) && (in_array('employee', user_roles()) && $projectIds->isEmpty())) {
                $user = User::findOrFail(user()->id);
                $this->waitingApprovalCount = $user->tasks()->where('board_column_id', $taskBoardColumn->id)->count();
            } elseif (! in_array('admin', user_roles()) && (in_array('employee', user_roles()) && ! $projectIds->isEmpty())) {
                $this->waitingApprovalCount = Task::whereIn('project_id', $projectIds)->where('board_column_id', $taskBoardColumn->id)->count();
            } else {
                $this->waitingApprovalCount = Task::where('board_column_id', $taskBoardColumn->id)->count();
            }
        }

        return $dataTable->render('tasks.waiting-approval', $this->data);
    }

    public function statusReason(Request $request)
    {

        $this->taskStatus = $request->taskStatus;
        $this->taskId = $request->taskId;
        $this->userId = $request->userId;

        return view('tasks.status_reason_modal', $this->data);
    }

    public function storeStatusReason(ActionTask $request)
    {

        $task = Task::findOrFail($request->taskId);
        $taskBoardColumn = TaskboardColumn::where('slug', $request->taskStatus)->first();
        $task->board_column_id = $taskBoardColumn->id;
        $task->approval_send = 0;
        $task->save();

        $comment = new TaskComment;
        $comment->comment = $request->reason;
        $comment->task_id = $request->taskId;
        $comment->user_id = user()->id;
        $comment->save();

        return Reply::dataOnly(['status' => 'success']);
    }

    public function clientDetail(Request $request)
    {
        $project = Project::with('client')->findOrFail($request->id);

        if (! is_null($project->client)) {
            $data = '<h5 class= "mb-2 f-13"> '.__('modules.projects.projectClient').'</h5>';
            $data .= view('components.client', ['user' => $project->client]);
            /* @phpstan-ignore-line */
        } else {
            $data = '<p> '.__('modules.projects.projectDoNotHaveClient').'</p>';
        }

        return Reply::dataOnly(['data' => $data]);
    }

    public function updateTaskDuration(Request $request, $id)
    {
        $task = Task::findOrFail($id);
        $task->start_date = Carbon::createFromFormat('d/m/Y', $request->start_date)->format('Y-m-d');
        $task->due_date = (! is_null($task->due_date)) ? Carbon::createFromFormat('d/m/Y', $request->end_date)->addDay()->format('Y-m-d') : null;
        $task->save();

        return Reply::success('messages.updateSuccess');
    }

    public function projectTasks($id)
    {
        if (request()->has('for_timelogs')) {
            $tasks = Task::projectLogTimeTasks($id);
            $options = BaseModel::options($tasks, null, 'heading');

            return Reply::dataOnly(['status' => 'success', 'data' => $options]);
        }

        $options = '<option value="">--</option>';

        $completedTaskColumn = TaskboardColumn::where('slug', '=', 'done')->first();

        $tasks = Task::where('board_column_id', '<>', $completedTaskColumn->id)->whereNotNull('due_date');

        if ($id != 0 && $id != '') {
            $tasks = $tasks->where('project_id', $id);
        }

        $tasks = $completedTaskColumn ? $tasks->get() : [];

        foreach ($tasks as $item) {

            $options .= '<option  data-content="<div class=\'d-inline-block mr-1\'></div>  '.$item->heading.' ( Due date: '.$item->due_date->format(company()->date_format).' ) " value="'.$item->id.'"> '.$item->heading.'  '.$item->due_date.' </option>';
        }

        return Reply::dataOnly(['status' => 'success', 'data' => $options]);
    }

    public function members($id)
    {
        $options = '<option value="">--</option>';

        if ($id != 0) {
            $members = Task::with('users')->findOrFail($id);

            foreach ($members->users as $item) {
                $self_select = (user() && user()->id == $item->id) ? '<span class=\'ml-2 badge badge-secondary\'>'.__('app.itsYou').'</span>' : '';
                if ($item->status == 'active') {
                    $content = ($item->status == 'deactive') ? "<span class='badge badge-pill badge-danger border align-center ml-2 px-2'>Inactive</span>" : '';
                    $options .= '<option  data-content="<div class=\'d-inline-block mr-1\'><img class=\'taskEmployeeImg rounded-circle\' src='.$item->image_url.' ></div>  '.$item->name.''.$self_select.''.$content.'" value="'.$item->id.'"> '.$item->name.' </option>';
                }
            }

            $startDateMin = $members->start_date ? $members->start_date->format('Y-m-d') : null;
            $startDate = $members->start_date && $members->start_date->lt(now()) ? now()->format('Y-m-d') : ($members->start_date ? $members->start_date->format('Y-m-d') : null);
            info($startDate);
        }

        return Reply::dataOnly(['status' => 'success', 'data' => $options, 'startDate' => $startDate, 'startDateMin' => $startDateMin]);
    }

    public function reminder()
    {
        $taskID = request()->id;
        $task = Task::with('users')->findOrFail($taskID);

        // Send  reminder notification to user
        event(new TaskReminderEvent($task));

        return Reply::success('messages.reminderMailSuccess');
    }

    public function checkLeaves()
    {
        $startDate = request()->start_date ? companyToYmd(request()->start_date) : null;
        $dueDate = request()->due_date ? companyToYmd(request()->due_date) : null;

        if (request()->start_date && request()->due_date && request()->user_id) {
            $data = $this->leaves(request()->user_id, $startDate, $dueDate);

            return reply::dataOnly(['data' => $data]);
        }
    }

    public function leaves($userIds, $startDate, $dueDate)
    {
        $leaveDates = [];

        foreach ($userIds as $userId) {
            $leaves = Leave::with('user')
                ->where('user_id', $userId)
                ->whereBetween('leave_date', [$startDate, $dueDate])
                ->get();

            foreach ($leaves as $leave) {
                $userName[] = $leave->user->name;
                $leaveDates[] = $leave->leave_date->format('d,M Y');
            }
        }

        if (isset($userName)) {
            $uniqueUser = array_unique($userName);
            $data = [];

            foreach ($uniqueUser as $name) {
                $data[$name] = [];

                foreach ($userName as $key => $value) {
                    if ($value == $name) {
                        $data[$name][] = $leaveDates[$key];
                        /** @phpstan-ignore-line */
                    }
                }
            }

            return $data;
        }
    }
}
