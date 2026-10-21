<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Models\CallRecording;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\SoftphoneDevice;
use App\Services\CallRecording\CallRecordingTranscoder;
use App\Services\FileStorageService;
use App\Services\PermissionService;
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
                    // An authorised app endpoint — never the raw object-storage
                    // link. The storage URL is a durable bearer credential:
                    // handing it to the browser would let anyone who copies it
                    // fetch the audio without a session, without the ownership
                    // check and without the expiry.
                    'download_url' => route('call-recordings.download', $recording->id),
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
        $companyId = company()->id;
        abort_403($companyId === null);

        $request->validate([
            'recording' => 'required|file|max:51200',
            'duration' => 'nullable|integer|min:0',
            // The entity reference and the line are pointers into this tenant.
            // Both halves of the entity reference must be present, and both are
            // resolved against the caller's own company before they are stored,
            // so a recording can never be labelled with a record (or a line)
            // from another company.
            'entity_type' => 'nullable|string|in:lead,deal|required_with:entity_id',
            'entity_id' => 'nullable|integer|min:1|required_with:entity_type',
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

        $entityType = $request->input('entity_type');
        $entityId = $request->input('entity_id');

        if ($entityType !== null && $entityId !== null) {
            $this->assertEntityIsAccessible((string) $entityType, (int) $entityId);
        }

        $deviceId = $request->input('device_id');
        if ($deviceId !== null) {
            $deviceId = $this->assertDeviceBelongsToCompany((int) $deviceId);
        }

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
            // tempnam() creates the file; we need to delete the placeholder before
            // transcoding and construct the final path manually to preserve
            // the directory (replaceExtension would strip it).
            $mp3Path = tempnam(sys_get_temp_dir(), 'call-');
            if ($mp3Path === false) {
                throw new \RuntimeException('Unable to allocate a temp file.');
            }
            $finalPath = $mp3Path . '.' . $this->transcoder->extension();
            @unlink($mp3Path);
            // Assign $finalPath before transcoding so existing cleanup removes
            // partial files when toMp3() fails (returns false or throws).
            $mp3Path = $finalPath;
            $transcoded = $this->transcoder->toMp3($file->getRealPath(), $finalPath);
        } catch (\Throwable $e) {
            $transcoded = false;
            // Clean up any partial output file from a failed transcode
            if (isset($finalPath) && is_file($finalPath)) {
                @unlink($finalPath);
            }
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
            'company_id' => $companyId,
            'user_id' => user()->id,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'device_id' => $deviceId,
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
                (int) user()->id,
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
     * Resolve the entity a recording is attached to.
     *
     * The id arrives from the browser, so it must be checked against the
     * caller's own tenant and their record-level access — otherwise a
     * recording could be labelled with (and link to) a lead or deal the
     * uploader is not allowed to see.
     */
    private function assertEntityIsAccessible(string $entityType, int $entityId): void
    {
        if ($entityType === 'lead') {
            $lead = Lead::findOrFail($entityId);
            abort_if((int) $lead->company_id !== (int) company()->id, 404);
            $access = PermissionService::checkAccess(user(), 'view_lead', $lead, [
                'added' => 'added_by',
                'owned' => 'lead_owner',
            ]);
            abort_unless($access['canAccess'], 403);

            return;
        }

        $deal = Deal::findOrFail($entityId);
        abort_if((int) $deal->company_id !== (int) company()->id, 404);
        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ]);
        abort_unless($access['canAccess'], 403);
    }

    /**
     * Resolve the line a recording was made on.
     *
     * The device id arrives from the browser and is stored on the recording,
     * so it must belong to the caller's own company.
     */
    private function assertDeviceBelongsToCompany(int $deviceId): int
    {
        $device = SoftphoneDevice::find($deviceId);
        abort_if($device === null, 404);
        abort_if((int) $device->company_id !== (int) company()->id, 404);

        return (int) $device->id;
    }

    /**
     * Stamp `recording_id` into the metadata of every CRM event belonging to
     * this call, so the timeline row for the call shows that audio exists.
     *
     * The company id comes from the recording rather than the session, so this
     * does not depend on an authenticated company being resolvable.
     *
     * `call_ref` is a client-supplied string, so it must not be usable to
     * annotate another agent's call rows: only the uploader's own events (and
     * system rows that carry no user at all) are eligible.
     */
    private function attachRecordingToCallEvents(
        string $callRef,
        int $recordingId,
        ?int $companyId,
        ?int $ownerUserId = null,
    ): void {
        if ($companyId === null || $companyId <= 0) {
            return;
        }

        try {
            $events = \App\Models\CrmEvent::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereHas('eventType', fn ($q) => $q->whereIn('slug', ['call_started', 'call_ended']))
                ->where('metadata->call_ref', $callRef)
                ->where(function ($q) use ($ownerUserId) {
                    $q->whereNull('user_id');

                    if ($ownerUserId !== null) {
                        $q->orWhere('user_id', $ownerUserId);
                    }
                })
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
     *
     * @param  string  $disposition  `inline` to play in the browser, `attachment`
     *                              to force a "save as" download.
     */
    private function streamRemoteInline(CallRecording $recording, string $disposition = 'inline')
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
                'Content-Disposition' => $disposition.'; filename="'.addslashes($recording->filename).'"',
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

    /**
     * Authorise access to a recording.
     *
     * The recording is tenant data: the caller needs the softphone
     * permission, must own the recording (or be an admin), must be in the
     * recording's own company, and the recording must not have expired.
     */
    private function authorizeRecordingAccess(CallRecording $recording): void
    {
        $permission = user()->permission('make_softphone_calls');
        abort_403(! in_array($permission, ['all']));

        if (user()->id !== $recording->user_id && ! user()->hasRole('admin')) {
            abort(403);
        }

        // Exact match, and a missing company_id on either side is a mismatch.
        // `isset()` previously let NULL recordings through the check entirely.
        if ($recording->company_id === null
            || user()->company_id === null
            || (int) $recording->company_id !== (int) user()->company_id) {
            abort(403);
        }

        if ($recording->expires_at && $recording->expires_at->isPast()) {
            abort(410);
        }
    }

    public function play(CallRecording $callRecording)
    {
        $this->authorizeRecordingAccess($callRecording);

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

    /**
     * Download a recording through the app.
     *
     * The raw object-storage URL is deliberately never handed to the browser:
     * it is a durable bearer credential that would let anyone who copies it
     * fetch the audio without a session, without the ownership check and
     * without the expiry. The bytes are streamed through the app instead,
     * under exactly the same authorisation as play().
     *
     * `?download=1` forces a "save as" download; the default streams inline so
     * the link can also be opened in a new tab.
     */
    public function download(CallRecording $callRecording)
    {
        $this->authorizeRecordingAccess($callRecording);

        $disposition = request()->boolean('download') ? 'attachment' : 'inline';

        if (! empty($callRecording->external_url)) {
            return $this->streamRemoteInline($callRecording, $disposition);
        }

        if (! empty($callRecording->object_path)) {
            $path = storage_path('app/' . ltrim($callRecording->object_path, '/'));
            if (is_file($path)) {
                return response()->file($path, [
                    'Content-Type' => $callRecording->mime_type ?: 'audio/mpeg',
                    'Content-Disposition' => $disposition.'; filename="'.addslashes($callRecording->filename).'"',
                    'Accept-Ranges' => 'bytes',
                    'Cache-Control' => 'private, max-age=0, no-store',
                ]);
            }
        }

        abort(404);
    }
}
