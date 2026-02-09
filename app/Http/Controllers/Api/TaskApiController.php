<?php

namespace App\Http\Controllers\Api;

use App\Helper\Reply;
use App\Http\Controllers\Controller;
use App\Models\Task;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Log;

class TaskApiController extends Controller
{
    /**
     * Get tasks due today grouped by assigned user, paginated by user.
     * Each item in data is { user: { id, name, email } | null, tasks: [...] }.
     * page/per_page control how many users (groups) are returned per page, not tasks.
     * Requires X-COMPANY-ID header.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function tasksForToday(Request $request)
    {
        try {
            $companyId = $request->header('X-COMPANY-ID');

            if (!$companyId) {
                return response()->json(Reply::error(__('messages.missingCompanyId')), 400);
            }

            $companyId = (int) $companyId;

            $body = $this->getRequestBody($request);
            $page = max(1, (int) ($request->query('page') ?? $body['page'] ?? 1));
            $perPage = min(
                max(1, (int) ($request->query('per_page') ?? $body['per_page'] ?? config('api.defaultLimit', 20))),
                config('api.maxLimit', 1000)
            );

            $today = now()->toDateString();

            $tasks = Task::where('tasks.company_id', $companyId)
                ->whereNotNull('tasks.due_date')
                ->whereDate('tasks.due_date', $today)
                ->with([
                    'project:id,project_name,project_short_code',
                    'users:id,name,email',
                ])
                ->orderBy('tasks.due_date')
                ->orderBy('tasks.id')
                ->get();

            $taskPayload = function (Task $task): array {
                return [
                    'id' => $task->id,
                    'heading' => $task->heading,
                    'description' => $task->description,
                    'due_date' => $task->due_date?->toISOString(),
                    'start_date' => $task->start_date?->toISOString(),
                    'status' => $task->status,
                    'priority' => $task->priority,
                    'task_short_code' => $task->task_short_code,
                    'project_id' => $task->project_id,
                    'project' => $task->project ? [
                        'id' => $task->project->id,
                        'project_name' => $task->project->project_name,
                        'project_short_code' => $task->project->project_short_code,
                    ] : null,
                ];
            };

            // Group tasks by assigned user (each task appears under every user it's assigned to)
            $byUser = [];
            foreach ($tasks as $task) {
                $payload = $taskPayload($task);
                if ($task->users->isEmpty()) {
                    $key = '__unassigned';
                    if (!isset($byUser[$key])) {
                        $byUser[$key] = ['user' => null, 'tasks' => []];
                    }
                    $byUser[$key]['tasks'][] = $payload;
                } else {
                    foreach ($task->users as $user) {
                        $key = (string) $user->id;
                        if (!isset($byUser[$key])) {
                            $byUser[$key] = [
                                'user' => [
                                    'id' => $user->id,
                                    'name' => $user->name,
                                    'email' => $user->email,
                                ],
                                'tasks' => [],
                            ];
                        }
                        $byUser[$key]['tasks'][] = $payload;
                    }
                }
            }

            // Unassigned first (if any), then users by id
            $allGroups = collect($byUser)->sortBy(function ($group, $key) {
                return $key === '__unassigned' ? -1 : (int) $key;
            })->values();

            $totalUsers = $allGroups->count();
            $paginatedGroups = $allGroups->slice(($page - 1) * $perPage, $perPage)->values()->all();

            $paginator = new LengthAwarePaginator(
                $paginatedGroups,
                $totalUsers,
                $perPage,
                $page,
                ['path' => $request->url(), 'query' => $request->query()]
            );

            $response = [
                'status' => 'success',
                'data' => $paginator->items(),
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'next_page_url' => $paginator->nextPageUrl(),
                'prev_page_url' => $paginator->previousPageUrl(),
            ];

            return response()->json($response, 200);

        } catch (\Illuminate\Http\Exceptions\HttpResponseException $e) {
            return $e->getResponse();
        } catch (\Exception $e) {
            $referenceId = uniqid('TASK-', true);

            Log::error('Error fetching tasks for today via API', [
                'reference_id' => $referenceId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'company_id' => $request->header('X-COMPANY-ID'),
            ]);

            return response()->json([
                'status' => 'fail',
                'message' => 'Failed to fetch tasks for today. Please contact support with reference ID: ' . $referenceId,
                'reference_id' => $referenceId,
            ], 500);
        }
    }

    /**
     * Request body as array (query or JSON body for page/per_page).
     *
     * @param Request $request
     * @return array<string, mixed>
     */
    private function getRequestBody(Request $request): array
    {
        if ($request->isMethod('POST') || $request->isMethod('PUT') || $request->isMethod('PATCH')) {
            return $request->all();
        }
        $content = $request->getContent();
        if ($content === '' || $content === false) {
            return [];
        }
        $decoded = json_decode($content, true);

        return is_array($decoded) ? $decoded : [];
    }
}
