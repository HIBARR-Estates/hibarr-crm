<?php

namespace App\Email\Http\Controllers;

use App\Email\Authorization\EmailAccess;
use App\Email\Files\EmailFiles;
use App\Email\Files\FileRefused;
use App\Email\Observability\EmailLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Email attachments: upload one to send, download one you may read. Bytes
 * always pass through here — the storage location never reaches a browser,
 * so there is no link that works without this check.
 */
class FileController
{
    public function __construct(
        private readonly EmailAccess $access,
        private readonly EmailFiles $files,
    ) {}

    public function store(Request $request): JsonResponse
    {
        $input = $request->validate([
            'connection_id' => ['required', 'uuid'],
            'file' => ['required', 'file'],
        ]);

        $connection = $this->access->ownConnection($request->user(), $input['connection_id']);

        abort_if($connection === null, 404);

        try {
            $file = $this->files->upload($request->user(), $connection, $request->file('file'));
        } catch (FileRefused $refused) {
            return response()->json(['message' => $refused->reason], 422);
        }

        return response()->json(['file' => $this->files->summary($file)], 201);
    }

    public function download(Request $request, string $file): Response
    {
        $found = $this->access->findFile($file);

        abort_if($found === null, 404);

        if (! $this->access->canViewFile($request->user(), $found)) {
            EmailLog::permissionDenied('file.download', [
                'user_id' => $request->user()?->id,
                'company_id' => $request->user()?->company_id,
                'file_id' => $found->uuid,
            ]);
            abort(403);
        }

        $bytes = $this->files->bytes($found);

        // Readable by this user, but not fit to hand out: unscanned, infected, or never stored.
        if ($bytes === null) {
            return response()->json([
                'message' => 'file_unavailable',
                'scan_status' => $found->scan_status->value,
            ], 409);
        }

        // Always a download, never rendered in the page: the content is whatever a stranger sent.
        return response($bytes, 200, [
            'Content-Type' => 'application/octet-stream',
            'Content-Length' => (string) strlen($bytes),
            'Content-Disposition' => 'attachment; filename="'.addcslashes($found->filename, '"\\').'"',
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
    }
}
