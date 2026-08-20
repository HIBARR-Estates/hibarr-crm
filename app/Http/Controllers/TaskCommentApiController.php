<?php

namespace App\Http\Controllers;

use App\Events\TaskCommentMentionEvent;
use App\Helper\UserService;
use App\Models\MentionUser;
use App\Models\Task;
use App\Models\TaskComment;
use App\Models\User;
use App\Support\FeatureFlags;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

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
    public function __construct()
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

    public function index(int $taskId): JsonResponse
    {
        $task = Task::findOrFail($taskId);
        $this->authorizeView($task);

        $comments = TaskComment::with('user:id,name,image')
            ->where('task_id', $task->id)
            ->orderBy('id')
            ->get()
            ->map(fn (TaskComment $comment) => $this->present($comment))
            ->all();

        return response()->json([
            'status' => 'success',
            'data' => ['comments' => $comments],
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

        // Author, or anyone with blanket edit rights over tasks.
        $isAuthor = (int) $comment->user_id === (int) UserService::getUserId()
            || (int) $comment->user_id === (int) user()->id;

        if (! $isAuthor && user()->permission('edit_tasks') !== 'all') {
            abort(403);
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
        $permission = user()->permission('add_task_comments');
        $taskUsers = $task->users->pluck('id')->toArray();
        $userId = UserService::getUserId();
        $isOwner = $task->added_by == user()->id || $task->added_by == $userId;

        $allowed = $permission === 'all'
            || ($permission === 'owned' && in_array(user()->id, $taskUsers))
            || ($permission === 'added' && ($isOwner || in_array(user()->id, $taskUsers)))
            || ($permission === 'both' && ($isOwner || in_array(user()->id, $taskUsers)));

        abort_403(! $allowed);
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
