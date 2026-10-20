<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CallRecording;
use App\Services\CallRecording\CallRecordingTranscoder;
use App\Services\FileStorageService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CallRecordingController extends AccountBaseController
{
    protected FileStorageService $fileStorageService;

    public function __construct(
        FileStorageService $fileStorageService,
        protected CallRecordingTranscoder $transcoder,
    ) {
        parent::__construct();
        $this->fileStorageService = $fileStorageService;
    }

    public function index(Request $request)
    {
        $permission = user()->permission('make_softphone_calls');
        abort_403(! in_array($permission, ['all']));

        $scope = $request->input('scope', 'mine');
        $companyId = (int) company()->id;
        $limit = (int) $request->input('limit', 50);
        $limit = max(1, min(200, $limit));

        // Exact match only. The previous `orWhereNull('company_id')` also
        // surfaced unowned rows to every company, and the recording filename is
        // tenant-visible metadata.
        $query = CallRecording::query()->where('company_id', $companyId);

        // `scope=company` is the Call Bridge "all recordings" view and is
        // admin-only; everyone else only ever sees their own.
        if ($scope === 'company') {
            abort_403(! user()->hasRole('admin'));
        } else {
            $query->where('user_id', user()->id);
        }

        $recordings = $query
            ->with(['user:id,name', 'device:id,label'])
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(function (CallRecording $recording) {
                return [
                    'id' => $recording->id,
                    'filename' => $recording->filename,
                    'user_id' => $recording->user_id,
                    'user_name' => $recording->user?->name,
                    'device_id' => $recording->device_id,
                    'device_label' => $recording->device?->label,
                    'entity_type' => $recording->entity_type,
                    'entity_id' => $recording->entity_id,
                    'lead_name' => $recording->lead_name,
                    'phone_number' => $recording->phone_number,
                    'direction' => $recording->direction,
                    'routing_reason' => $recording->routing_reason,
                    'duration_seconds' => $recording->duration_seconds,
                    'expires_at' => $recording->expires_at?->toIso8601String(),
                    'is_expired' => $recording->expires_at?->isPast() ?? false,
                    'play_url' => route('call-recordings.play', $recording->id),
                    // Raw object-storage link, for anyone who wants the file itself.
                    'download_url' => $recording->external_url,
                ];
            });

        return Reply::successWithData('Recordings', ['data' => $recordings]);
    }

    public function store(Request $request)
    {
        $permission = user()->permission('make_softphone_calls');
        abort_403(! in_array($permission, ['all']));

        // Recordings are tenant data and every read path filters on company_id,
        // so an unowned row would be invisible rather than harmless. Resolve the
        // company up front instead of persisting a NULL one.
        if (company()->id === null) {
            abort_403();
        }

        $request->validate([
            'recording' => 'required|file|max:51200',
            'duration' => 'nullable|integer|min:0',
            'entity_type' => 'nullable|string|max:50',
            'entity_id' => 'nullable|integer',
            'device_id' => 'nullable|integer|min:1',
            // Why this call reached this agent — matched/unmatched, owner vs pool.
            'lead_name' => 'nullable|string|max:180',
            'phone_number' => 'nullable|string|max:50',
            'direction' => 'nullable|string|in:inbound,outbound',
            'routing_reason' => 'nullable|string|max:40',
            // Matches the crm_events.metadata.call_ref column width — this value
            // is what links the recording back to the call's timeline rows.
            'call_ref' => 'nullable|string|max:64',
        ]);

        $file = $request->file('recording');
        $duration = (int) $request->input('duration', 180);
        if ($duration < 1) {
            $duration = 180;
        }

        $folder = 'call-recordings/' . user()->id;

        // Browsers can only record Opus/WebM (or MP4/AAC on Safari) — MP3 is
        // produced here. If ffmpeg is unavailable we keep the original audio
        // rather than dropping the recording.
        $mp3Path = null;
        $transcoded = false;
        try {
            // tempnam() creates the file; appending the extension made a second
            // path and orphaned the first one on every upload.
            $mp3Path = tempnam(sys_get_temp_dir(), 'call-');
            if ($mp3Path === false) {
                throw new \RuntimeException('Unable to allocate a temp file.');
            }
            $mp3Path = $this->replaceExtension($mp3Path, $this->transcoder->extension());
            $transcoded = $this->transcoder->toMp3($file->getRealPath(), $mp3Path);
        } catch (\Throwable $e) {
            $transcoded = false;
        }

        $storedName = $transcoded
            ? $this->replaceExtension($file->getClientOriginalName(), 'mp3')
            : $file->getClientOriginalName();
        $mimeType = $transcoded ? $this->transcoder->mimeType() : $file->getMimeType();
        $size = $transcoded ? (int) @filesize($mp3Path) : $file->getSize();

        try {
            $uploaded = $transcoded
                ? $this->fileStorageService->uploadFromPath($mp3Path, $storedName, $folder)
                : $this->fileStorageService->upload($file, $folder);
            $objectPath = $uploaded['objectPath'] ?? null;
            $externalUrl = $uploaded['downloadUrl'] ?? null;
        } catch (\Throwable $e) {
            // Keep recording available even when the external storage gateway
            // is not configured. Fallback to Laravel's local disk, which mirrors
            // lead files' safe offline behaviour.
            $objectPath = $folder.'/'.uniqid('call-', true).'.'.($transcoded ? 'mp3' : 'webm');
            Storage::disk('local')->put(
                $objectPath,
                fopen($transcoded ? $mp3Path : $file->getRealPath(), 'r')
            );
            $externalUrl = null;
        }

        if ($mp3Path !== null && is_file($mp3Path)) {
            @unlink($mp3Path);
        }

        $callRef = $request->input('call_ref');

        $recording = CallRecording::create([
            'company_id' => user()->company_id ?? null,
            'user_id' => user()->id,
            'entity_type' => $request->input('entity_type'),
            'entity_id' => $request->input('entity_id'),
            'device_id' => $request->input('device_id'),
            'lead_name' => $request->input('lead_name'),
            'phone_number' => $request->input('phone_number'),
            'direction' => $request->input('direction'),
            'routing_reason' => $request->input('routing_reason'),
            'call_ref' => $callRef,
            'filename' => $storedName,
            'mime_type' => $mimeType,
            'size' => $size,
            'duration_seconds' => $duration,
            'object_path' => $objectPath,
            'external_url' => $externalUrl,
            'expires_at' => now()->addDays(30),
        ]);

        // The timeline row for this call may already exist (the dock logs
        // call_ended on hang-up, while the upload finishes afterwards). Stamp
        // the recording id onto those events so the timeline can say audio was
        // captured.
        if ($callRef) {
            $this->attachRecordingToCallEvents(
                (string) $callRef,
                (int) $recording->id,
                $recording->company_id !== null ? (int) $recording->company_id : null,
            );
        }

        return Reply::successWithData('Recording uploaded', [
            'data' => [
                'id' => $recording->id,
                'play_url' => route('call-recordings.play', $recording->id),
                'expires_at' => $recording->expires_at?->toIso8601String(),
                'duration_seconds' => $recording->duration_seconds,
            ],
        ]);
    }

    /**
     * Stamp `recording_id` into the metadata of every CRM event belonging to
     * this call, so the timeline row for the call shows that audio exists.
     *
     * The company id comes from the recording rather than the session, so this
     * does not depend on an authenticated company being resolvable.
     */
    private function attachRecordingToCallEvents(
        string $callRef,
        int $recordingId,
        ?int $companyId,
    ): void {
        if ($companyId === null || $companyId <= 0) {
            return;
        }

        try {
            $events = \App\Models\CrmEvent::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereHas('eventType', fn ($q) => $q->whereIn('slug', ['call_started', 'call_ended']))
                ->where('metadata->call_ref', $callRef)
                ->get();

            foreach ($events as $event) {
                $metadata = is_array($event->metadata) ? $event->metadata : [];
                if (isset($metadata['recording_id'])) {
                    continue;
                }
                $metadata['recording_id'] = $recordingId;
                $metadata['has_recording'] = true;
                $event->forceFill(['metadata' => $metadata])->save();
            }
        } catch (\Throwable $e) {
            // Never fail the upload because the timeline could not be annotated.
            Log::warning('CallRecordingController: could not annotate call events', [
                'call_ref' => $callRef,
                'recording_id' => $recordingId,
                'message' => $e->getMessage(),
            ]);
        }
    }

    /** Swap a filename's extension, keeping its base name readable. */
    private function replaceExtension(string $filename, string $extension): string
    {
        $base = pathinfo($filename, PATHINFO_FILENAME);

        return ($base !== '' ? $base : 'call').'.'.$extension;
    }

    /**
     * Streams an object-storage recording through the app so it plays inline in
     * the browser instead of triggering a download.
     *
     * The upstream Range header is forwarded and its 206/Content-Range echoed
     * back, which is what lets the <audio> element seek.
     */
    private function streamRemoteInline(CallRecording $recording)
    {
        $range = request()->header('Range');

        try {
            $pending = Http::withOptions([
                'stream' => true,
                // Object storage download endpoints can redirect to a CDN.
                'allow_redirects' => true,
            ]);

            if ($range) {
                $pending = $pending->withHeaders(['Range' => $range]);
            }

            $upstream = $pending->get($recording->external_url);

            if (! $upstream->successful()) {
                Log::warning('CallRecordingController: upstream fetch failed', [
                    'recording_id' => $recording->id,
                    'status' => $upstream->status(),
                ]);
                abort(502, 'Recording is temporarily unavailable.');
            }

            // Object storage serves these as `binary/octet-stream`, which makes
            // the browser refuse to treat the response as playable audio. We
            // know the real type (we transcoded it on upload), so never trust
            // the upstream Content-Type here.
            $storedType = $recording->mime_type ?: 'audio/mpeg';
            $contentType = str_starts_with($storedType, 'audio/') ? $storedType : 'audio/mpeg';

            $headers = [
                'Content-Type' => $contentType,
                'Content-Disposition' => 'inline; filename="'.addslashes($recording->filename).'"',
                'Accept-Ranges' => 'bytes',
                'Cache-Control' => 'private, max-age=0, no-store',
            ];

            // Echo upstream range headers so <audio> seeking works. Only set
            // them when actually present — emitting empty values confuses
            // HTTP/2 clients.
            if ($length = $upstream->header('Content-Length')) {
                $headers['Content-Length'] = $length;
            }
            if ($contentRange = $upstream->header('Content-Range')) {
                $headers['Content-Range'] = $contentRange;
            }

            return response()->stream(function () use ($upstream): void {
                $body = $upstream->toPsrResponse()->getBody();
                // A streamed body is not seekable — rewinding it throws
                // "Cannot rewind a non-seekable stream", which surfaced as a
                // 500 on every recording.
                if ($body->isSeekable()) {
                    $body->rewind();
                }
                while (! $body->eof()) {
                    echo $body->read(1024 * 64);
                    flush();
                }
            }, $upstream->status(), $headers);
        } catch (\Throwable $e) {
            Log::warning('CallRecordingController: streaming failed', [
                'recording_id' => $recording->id,
                'message' => $e->getMessage(),
            ]);
            abort(502, 'Recording is temporarily unavailable.');
        }
    }

    public function play(CallRecording $callRecording)
    {
        $permission = user()->permission('make_softphone_calls');
        abort_403(! in_array($permission, ['all']));

        if (user()->id !== $callRecording->user_id && ! user()->hasRole('admin')) {
            abort(403);
        }

        // Exact match, and a missing company_id on either side is a mismatch.
        // `isset()` previously let NULL recordings through the check entirely.
        if ($callRecording->company_id === null
            || user()->company_id === null
            || (int) $callRecording->company_id !== (int) user()->company_id) {
            abort(403);
        }

        if ($callRecording->expires_at && $callRecording->expires_at->isPast()) {
            abort(410);
        }

        // Recordings live in object storage behind a *download* URL. Redirecting
        // there makes the browser download the file instead of playing it, so
        // the bytes are streamed through the app as an inline response with
        // Range support (needed for <audio> seeking).
        if (! empty($callRecording->external_url)) {
            return $this->streamRemoteInline($callRecording);
        }

        if (! empty($callRecording->object_path)) {
            $path = storage_path('app/' . ltrim($callRecording->object_path, '/'));
            if (is_file($path)) {
                return response()->file($path, [
                    'Content-Type' => $callRecording->mime_type ?: 'audio/mpeg',
                    'Content-Disposition' => 'inline; filename="'.addslashes($callRecording->filename).'"',
                    'Accept-Ranges' => 'bytes',
                    'Cache-Control' => 'private, max-age=0, no-store',
                ]);
            }
        }

        abort(404);
    }
}
