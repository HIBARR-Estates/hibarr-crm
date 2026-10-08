<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Observability\EmailLog;
use App\Email\Reads\ReadState;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * The signed-in user's own read state. Nothing here changes what a colleague
 * sees, and nothing is sent to the mail provider.
 */
class ReadController
{
    public function __construct(
        private readonly EmailAccess $access,
        private readonly ReadState $reads,
    ) {}

    public function count(Request $request): JsonResponse
    {
        return response()->json(['unread' => $this->reads->unreadCount($request->user())]);
    }

    /** The user opened this exact message. */
    public function store(Request $request, string $message): JsonResponse
    {
        $found = $this->access->findMessage($message);

        // Missing and not-readable look the same: a message id says nothing to someone without access.
        if ($found === null || ! $this->access->canViewMessage($request->user(), $found)) {
            if ($found !== null) {
                EmailLog::permissionDenied('message.read', [
                    'user_id' => $request->user()?->id,
                    'company_id' => $request->user()?->company_id,
                    'message_id' => $found->uuid,
                ]);
            }
            abort(404);
        }

        $this->reads->markRead($request->user(), $found);

        return response()->json([
            'message' => ['id' => $found->uuid, 'unread' => false],
            'unread' => $this->reads->unreadCount($request->user()),
        ]);
    }
}
