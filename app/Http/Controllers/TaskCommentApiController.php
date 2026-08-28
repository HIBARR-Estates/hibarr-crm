<?php

namespace App\Http\Controllers;

use App\Events\TaskCommentMentionEvent;
use App\Helper\UserService;
use App\Models\MentionUser;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\TaskParticipant;
use App\Models\User;
use App\Services\TaskCommentPermissionService;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;

/**
 * JSON comment endpoints for the redesigned task detail modal.
 *
 * TaskCommentController already handles comments, but it renders Blade
 * partials back to the legacy jQuery screens. This controller speaks JSON and
 * additionally records @mentions — which the Blade flow never did, leaving
 * TaskCommentMentionEvent dispatched from nowhere.
 */
class TaskCommentApiController extends AccountBaseController
{
    public function __construct(private TaskCommentPermissionService $commentPermissions)
    {
        parent::__construct();

        $this->middleware(function ($request, $next) {
            if (! in_array('tasks', $this->user->modules)) {
                abort(403);
            }

            if (! FeatureFlags::enabled('crm.tasks-workspace-redesign')) {
                abort(403);
            }

            return $next($request);
        });
    }

    /**
     * Returns the most recent page of comments (or, with `before_id`, the
     * page immediately older than that comment) — oldest-first within the
     * page, matching display order. `has_more` tells the frontend whether an
     * older page still exists to fetch.
     */
    public function index(Request $request, int $taskId): JsonResponse
    {
        $task = Task::findOrFail($taskId);
        $this->authorizeView($task);

        $perPage = max(1, min(100, (int) $request->integer('per_page', 30)));
        $beforeId = $request->integer('before_id');

        $query = TaskComment::with('user:id,name,image')
            ->where('task_id', $task->id)
            ->orderByDesc('id');

        if ($beforeId) {
            $query->where('id', '<', $beforeId);
        }

        $page = $query->limit($perPage + 1)->get();
        $hasMore = $page->count() > $perPage;
        $comments = $page->take($perPage)
            ->reverse()
            ->values()
            ->map(fn (TaskComment $comment) => $this->present($comment))
            ->all();

        return response()->json([
            'status' => 'success',
            'data' => [
                'comments' => $comments,
                'has_more' => $hasMore,
                // Only needed to seed the header count on the first page —
                // the frontend keeps it in sync itself after that.
                'total' => $beforeId ? null : TaskComment::where('task_id', $task->id)->count(),
            ],
        ]);
    }

    /**
     * Activity log entries (status changes, assignee changes, checklist
     * add/toggle, file uploads, ...) for the detail modal's comments panel,
     * interleaved there with real comments by timestamp. `type` is the
     * `TaskHistory.details` value (e.g. "statusActivity") — kept as an
     * English source key so the frontend composes + td()-translates the
     * sentence, same as everywhere else in this redesign, instead of
     * needing a new server lang key per locale for every activity type.
     * Capped at 200 — far more than a task's history realistically needs,
     * and comments still paginate separately from this.
     */
    public function activity(int $taskId): JsonResponse
    {
        $task = Task::findOrFail($taskId);
        $this->authorizeView($task);

        $entries = \App\Models\TaskHistory::with([
            'user:id,name,image',
            'boardColumn:id,column_name,slug,label_color',
            'subTask:id,title',
        ])
            ->where('task_id', $task->id)
            ->orderByDesc('id')
            ->limit(200)
            ->get()
            ->reverse()
            ->values()
            ->map(fn (\App\Models\TaskHistory $entry) => [
                'id' => $entry->id,
                'type' => $entry->details,
                'created_at' => $entry->created_at?->toIso8601String(),
                'created_at_human' => $entry->created_at?->diffForHumans(),
                'user' => $entry->user ? [
                    'id' => $entry->user->id,
                    'name' => $entry->user->name,
                    'image' => $entry->user->image,
                ] : null,
                'board_column' => $entry->boardColumn ? [
                    'column_name' => $entry->boardColumn->column_name,
                    'label_color' => $entry->boardColumn->label_color,
                ] : null,
                'sub_task' => $entry->subTask ? [
                    'title' => $entry->subTask->title,
                ] : null,
            ])
            ->all();

        return response()->json([
            'status' => 'success',
            'data' => ['activity' => $entries],
        ]);
    }

    public function store(Request $request, int $taskId): JsonResponse
    {
        $task = Task::with('users')->findOrFail($taskId);
        $this->authorizeComment($task);

        $data = $request->validate([
            'comment' => ['required', 'string'],
            'mention_user_ids' => ['sometimes', 'array'],
            'mention_user_ids.*' => ['integer'],
        ]);

        $comment = new TaskComment;
        $comment->comment = $data['comment'];
        $comment->task_id = $task->id;
        $comment->user_id = UserService::getUserId();
        $comment->save();

        $this->syncMentions($task, $comment, $data['mention_user_ids'] ?? []);

        return response()->json([
            'status' => 'success',
            'data' => ['comment' => $this->present($comment->fresh('user'))],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $comment = TaskComment::findOrFail($id);

        if (! $this->commentPermissions->canDeleteComment(user(), $comment)) {
            abort_403(true);
        }

        MentionUser::where('task_comment_id', $comment->id)->delete();
        $comment->delete();

        return response()->json(['status' => 'success']);
    }

    /**
     * Records who was mentioned and fires the notification chain, so each
     * mentioned user gets an in-app (database) notification.
     *
     * @param  array<int, int>  $userIds
     */
    private function syncMentions(Task $task, TaskComment $comment, array $userIds): void
    {
        $currentUserId = (int) UserService::getUserId();

        // Never notify the author of their own mention.
        $mentioned = User::whereIn('id', array_unique($userIds))
            ->where('id', '!=', $currentUserId)
            ->pluck('id')
            ->all();

        if ($mentioned === []) {
            return;
        }

        foreach ($mentioned as $userId) {
            MentionUser::create([
                'user_id' => $userId,
                'task_id' => $task->id,
                'task_comment_id' => $comment->id,
            ]);

            if (Schema::hasTable('task_participants')) {
                TaskParticipant::firstOrCreate([
                    'task_id' => $task->id,
                    'user_id' => $userId,
                ]);
            }
        }

        event(new TaskCommentMentionEvent($task, $comment, $mentioned));
    }

    private function authorizeView(Task $task): void
    {
        if (! $task->canViewTicket()) {
            abort(403);
        }
    }

    private function authorizeComment(Task $task): void
    {
        abort_403(! $this->commentPermissions->canAddComment(user(), $task));
    }

    /**
     * @return array<string, mixed>
     */
    private function present(TaskComment $comment): array
    {
        return [
            'id' => $comment->id,
            'comment' => $comment->comment,
            'created_at' => $comment->created_at?->toIso8601String(),
            'created_at_human' => $comment->created_at?->diffForHumans(),
            'is_mine' => (int) $comment->user_id === (int) UserService::getUserId(),
            'user' => $comment->user ? [
                'id' => $comment->user->id,
                'name' => $comment->user->name,
                'image' => $comment->user->image,
            ] : null,
        ];
    }
}
