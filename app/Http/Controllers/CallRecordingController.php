<?php

namespace App\Http\Controllers;

use App\Helper\Files;
use App\Helper\Reply;
use App\Models\CallRecording;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\SoftphoneDevice;
use App\Models\StorageSetting;
use App\Services\CallRecording\CallRecordingTranscoder;
use App\Services\FileStorageService;
use App\Services\PermissionService;
use App\Support\CallAccess;
use App\Services\CallRecording\CallRecordingLinker;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class CallRecordingController extends AccountBaseController
{
    public function __construct(
        protected FileStorageService $fileStorageService,
        protected CallRecordingTranscoder $transcoder,
    ) {
        parent::__construct();
    }

    /**
     * List call recordings for the current user or company call managers.
     */
    public function index(Request $request)
    {
        abort_403(! CallAccess::canMakeCalls(user()) && ! CallAccess::canManageCalls(user()));

        $scope = $request->input('scope', 'mine');
        $companyId = (int) company()->id;
        $limit = (int) $request->input('limit', 50);
        $limit = max(1, min(200, $limit));

        // Exact match only. The previous `orWhereNull('company_id')` also
        // surfaced unowned rows to every company, and the recording filename is
        // tenant-visible metadata.
        $query = CallRecording::query()->where('company_id', $companyId);

        // `scope=company` is the "all recordings" view: admins and call
        // managers (manage_calls); everyone else only ever sees their own.
        if ($scope === 'company') {
            abort_403(! CallAccess::canManageCalls(user()));
        } else {
            $query->where('user_id', user()->id);
        }

        $rows = $query->with(['user:id,name', 'device:id,label'])->orderByDesc('id')->limit($limit)->get();
        $forwardedByCallRef = $this->resolveForwardedByCallRef($rows, $companyId);
        $recordings = $rows->map(function (CallRecording $recording) use ($forwardedByCallRef) {
                $forwarded = ($recording->call_ref && isset($forwardedByCallRef[$recording->call_ref]))
                    ? $forwardedByCallRef[$recording->call_ref]
                    : null;
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
                    'is_forwarded' => (bool) ($forwarded['is_forwarded'] ?? false),
                    'forwarded_from_user_id' => $forwarded['forwarded_from_user_id'] ?? null,
                    'forwarded_from_user_name' => $forwarded['forwarded_from_user_name'] ?? null,
                    'duration_seconds' => $recording->duration_seconds,
                    'expires_at' => $recording->expires_at?->toIso8601String(),
                    'is_expired' => $recording->expires_at?->isPast() ?? false,
                    'play_url' => route('call-recordings.play', $recording->id, false),
                    // An authorised app endpoint — never the raw object-storage
                    // link. The storage URL is a durable bearer credential:
                    // handing it to the browser would let anyone who copies it
                    // fetch the audio without a session, without the ownership
                    // check and without the expiry.
                    'download_url' => route('call-recordings.download', $recording->id, false),
                ];
            });

        return Reply::successWithData('Recordings', ['data' => $recordings]);
    }

    /**
     * Upload and store a call recording from the browser softphone.
     */
    public function store(Request $request)
    {
        $permission = user()->permission('make_softphone_calls');
        abort_403(! user()->hasRole('admin') && ! in_array($permission, ['all', 'added']));

        // Recordings are tenant data and every read path filters on company_id,
        // so an unowned row would be invisible rather than harmless. Resolve the
        // company up front instead of persisting a NULL one.
        $companyId = company()->id;
        abort_403($companyId === null);

        try {
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
                'is_forwarded' => 'nullable|boolean',
                'forwarded_from_user_id' => 'nullable|integer|min:1',
                'forwarded_from_user_name' => 'nullable|string|max:180',
                // Matches the crm_events.metadata.call_ref column width — this value
                // is what links the recording back to the call's timeline rows.
                'call_ref' => 'nullable|string|max:64',
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            Log::warning('CallRecordingController: upload validation rejected', [
                'call_ref' => $request->input('call_ref'),
                'user_id' => user()?->id,
                'errors' => $e->errors(),
            ]);
            throw $e;
        }

        $entityType = $request->input('entity_type');
        $entityId = $request->input('entity_id');
        $leadName = $request->input('lead_name');
        $direction = $request->input('direction');
        $isInbound = in_array($direction, ['inbound', 'incoming'], true);

        if ($entityType !== null && $entityId !== null) {
            if ($isInbound) {
                // Inbound calls reach whichever agent answers the line or rotation pool,
                // who might not hold permission to view that specific lead.
                // Detach the entity pointer so the recording is saved safely under the company
                // and linked via call_ref without failing the upload with HTTP 403.
                if (! $this->canAccessEntity((string) $entityType, (int) $entityId)) {
                    $entityType = null;
                    $entityId = null;
                    $leadName = null;
                }
            } else {
                $this->assertEntityIsAccessible((string) $entityType, (int) $entityId);
            }
        }

        $deviceId = $request->input('device_id');
        if ($deviceId !== null) {
            $deviceId = $this->assertDeviceBelongsToCompany((int) $deviceId);
        }

        $file = $request->file('recording');
        $rawDuration = $request->input('duration');
        $suppliedDuration = ($rawDuration !== null && is_numeric($rawDuration)) ? (int) $rawDuration : null;
        $duration = ($suppliedDuration !== null && $suppliedDuration > 1) ? $suppliedDuration : 180;

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
            if ($transcoded && is_file($mp3Path)) {
                $probed = $this->transcoder->getDurationSeconds($mp3Path);
                if ($probed !== null && $probed > 0) {
                    $duration = $probed;
                }
            } elseif (($suppliedDuration === null || $suppliedDuration <= 1) && $file->getRealPath() && is_file($file->getRealPath())) {
                $probed = $this->transcoder->getDurationSeconds($file->getRealPath());
                if ($probed !== null && $probed > 0) {
                    $duration = $probed;
                }
            }
        } catch (\Throwable $e) {
            $transcoded = false;
            Log::warning('CallRecordingController: transcoding threw', [
                'call_ref' => $request->input('call_ref'),
                'user_id' => user()?->id,
                'error' => $e->getMessage(),
            ]);
            // Clean up any partial output file from a failed transcode
            if (isset($finalPath) && is_file($finalPath)) {
                @unlink($finalPath);
            }
        }

        $sourcePath = ($transcoded && is_file($mp3Path)) ? $mp3Path : $file->getRealPath();

        // Ensure the file is ALWAYS named and typed strictly as an AUDIO file.
        // Bunny's gateway routes .webm and video/* to Bunny Video Stream, which generates
        // video embed iframes instead of playable audio files. We strictly enforce
        // audio/mpeg, audio/mp4, or audio/ogg.
        if ($transcoded) {
            $storedName = $this->replaceExtension($file->getClientOriginalName(), 'mp3');
            $mimeType = $this->transcoder->mimeType(); // audio/mpeg
        } else {
            $origExt = strtolower((string) $file->getClientOriginalExtension());
            if ($origExt === 'webm' || str_starts_with((string) $file->getMimeType(), 'video/')) {
                // If transcoding failed or was skipped on a webm container, rename to an audio container
                // so Bunny never classifies it as video
                $storedName = $this->replaceExtension($file->getClientOriginalName(), 'm4a');
                $mimeType = 'audio/mp4';
            } elseif ($origExt === 'ogg') {
                $storedName = $file->getClientOriginalName();
                $mimeType = 'audio/ogg';
            } else {
                $storedName = $this->replaceExtension($file->getClientOriginalName(), 'm4a');
                $mimeType = 'audio/mp4';
            }
        }

        $size = ($sourcePath && is_file($sourcePath)) ? (int) @filesize($sourcePath) : $file->getSize();

        try {
            // Upload to Bunny storage gateway explicitly declaring it as an audio file
            $uploaded = $this->fileStorageService->uploadFromPath($sourcePath, $storedName, $folder, $mimeType);
            $objectPath = $uploaded['objectPath'] ?? null;
            $externalUrl = $uploaded['downloadUrl'] ?? null;

            // If the storage gateway ever returned a Bunny Stream embed iframe URL,
            // resolve the direct media CDN link from its meta tags.
            if (is_string($externalUrl) && str_contains($externalUrl, 'iframe.mediadelivery.net/embed/')) {
                try {
                    $embedRes = Http::timeout(5)->get($externalUrl);
                    if ($embedRes->successful() && preg_match('/<meta[^>]+property=["\']og:video:url["\'][^>]+content=["\']([^"\']+)["\']/i', $embedRes->body(), $m)) {
                        $externalUrl = $m[1];
                    }
                } catch (\Throwable) {
                    // Retain original URL if resolving fails
                }
            }
        } catch (\Throwable $e) {
            Log::warning('CallRecordingController: Bunny storage upload failed, falling back to local disk', [
                'call_ref' => $request->input('call_ref'),
                'user_id' => user()?->id,
                'error' => $e->getMessage(),
            ]);

            // Keep recording available even when the external Bunny gateway is unreachable.
            // Fall back to Laravel's local disk.
            $fallbackExt = pathinfo($storedName, PATHINFO_EXTENSION) ?: ($transcoded ? 'mp3' : 'm4a');
            $objectPath = $folder . '/' . uniqid('call-', true) . '.' . $fallbackExt;
            $stream = fopen($sourcePath, 'rb');
            if ($stream !== false) {
                try {
                    Storage::disk('local')->put($objectPath, $stream, ['visibility' => 'public']);
                } finally {
                    fclose($stream);
                }
            }
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
            'lead_name' => $leadName,
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

        Log::info('CallRecordingController: recording created', [
            'recording_id' => $recording->id,
            'call_ref' => $callRef,
            'user_id' => $recording->user_id,
            'duration_seconds' => $recording->duration_seconds,
            'filename' => $storedName,
            'size' => $size,
            'transcoded' => $transcoded,
            'has_external_url' => ! empty($externalUrl),
        ]);

        // The timeline row for this call may already exist (the dock logs
        // call_ended on hang-up, while the upload finishes afterwards). Stamp
        // the recording id onto those events so the timeline can say audio was
        // captured.
        if ($callRef) {
            app(CallRecordingLinker::class)->attach(
                (string) $callRef,
                (int) $recording->id,
                $recording->company_id !== null ? (int) $recording->company_id : null,
                (int) user()->id,
            );
        }

        return Reply::successWithData('Recording uploaded', [
            'data' => [
                'id' => $recording->id,
                'play_url' => route('call-recordings.play', $recording->id, false),
                'expires_at' => $recording->expires_at?->toIso8601String(),
                'duration_seconds' => $recording->duration_seconds,
            ],
        ]);
    }

    /**
     * Resolve forwarded metadata for recordings from linked call timeline events.
     *
     * @param  \Illuminate\Support\Collection<int, CallRecording>  $rows
     * @return array<string, array{is_forwarded: bool, forwarded_from_user_id: int|null, forwarded_from_user_name: string|null}>
     */
    private function resolveForwardedByCallRef($rows, int $companyId): array
    {
        if (! CallAccess::canManageCalls(user())) {
            return [];
        }

        $callRefs = $rows
            ->pluck('call_ref')
            ->filter(fn ($ref) => is_string($ref) && $ref !== '')
            ->unique()
            ->values()
            ->all();

        if ($callRefs === []) {
            return [];
        }

        $out = [];
        try {
            \App\Models\CrmEvent::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereIn('metadata->call_ref', $callRefs)
                ->get(['metadata'])
                ->each(function ($event) use (&$out): void {
                    $meta = is_array($event->metadata) ? $event->metadata : [];
                    $ref = $meta['call_ref'] ?? null;
                    if (is_string($ref) && $ref !== '' && ! empty($meta['is_forwarded'])) {
                        $out[$ref] = [
                            'is_forwarded' => true,
                            'forwarded_from_user_id' => isset($meta['forwarded_from_user_id'])
                                ? (int) $meta['forwarded_from_user_id']
                                : null,
                            'forwarded_from_user_name' => $meta['forwarded_from_user_name'] ?? null,
                        ];
                    }
                });
        } catch (\Throwable) {
            // Metadata lookup is best-effort.
        }

        return $out;
    }

    /**
     * Check whether the user can view an entity within their company.
     */
    private function canAccessEntity(string $entityType, int $entityId): bool
    {
        if ($entityType === 'lead') {
            $lead = Lead::find($entityId);
            if (! $lead || (int) $lead->company_id !== (int) company()->id) {
                return false;
            }

            $access = PermissionService::checkAccess(user(), 'view_lead', $lead, [
                'added' => 'added_by',
                'owned' => 'lead_owner',
            ]);

            return (bool) ($access['canAccess'] ?? false);
        }

        $deal = Deal::find($entityId);
        if (! $deal || (int) $deal->company_id !== (int) company()->id) {
            return false;
        }

        $access = PermissionService::checkAccess(user(), 'view_deals', $deal, [
            'added' => 'added_by',
            'owned' => fn ($user, $deal) => $deal->isVisibleToUser($user->id),
        ]);

        return (bool) ($access['canAccess'] ?? false);
    }

    /**
     * Resolve the entity a recording is attached to and assert access.
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
    private function streamRemoteInline(CallRecording $recording, string $disposition = 'inline', ?string $overrideUrl = null)
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

            $targetUrl = $overrideUrl ?: $recording->external_url;
            if (empty($targetUrl)) {
                abort(404);
            }

            // If the storage service returned a Bunny Stream iframe embed URL
            // (https://iframe.mediadelivery.net/embed/...), resolve the direct media CDN
            // URL from its meta tags so the response streams actual audio rather than an HTML webpage.
            if (is_string($targetUrl) && str_contains($targetUrl, 'iframe.mediadelivery.net/embed/')) {
                try {
                    $embedRes = Http::timeout(5)->get($targetUrl);
                    if ($embedRes->successful()) {
                        $html = $embedRes->body();
                        if (preg_match('/<meta[^>]+property=["\']og:video:url["\'][^>]+content=["\']([^"\']+)["\']/i', $html, $m)) {
                            $targetUrl = $m[1];
                        } elseif (preg_match('/<meta[^>]+content=["\']([^"\']+\.(?:mp4|webm))["\'][^>]+property=["\']og:video:url["\']/i', $html, $m)) {
                            $targetUrl = $m[1];
                        }
                    }
                } catch (\Throwable $e) {
                    Log::warning('CallRecordingController: resolving embed media url failed', ['error' => $e->getMessage()]);
                }
            }

            $upstream = $pending->get($targetUrl);

            if (! $upstream->successful()) {
                Log::warning('CallRecordingController: upstream fetch failed', [
                    'recording_id' => $recording->id,
                    'status' => $upstream->status(),
                ]);
                abort(502, 'Recording is temporarily unavailable.');
            }

            // If the upstream responded with an HTML page (e.g. embed player or error page),
            // never pass HTML to the browser as audio — that corrupts the recording.
            $upstreamType = strtolower($upstream->header('Content-Type') ?? '');
            if (str_contains($upstreamType, 'text/html')) {
                Log::warning('CallRecordingController: upstream returned HTML instead of audio bytes', [
                    'recording_id' => $recording->id,
                    'url' => $targetUrl,
                ]);
                abort(502, 'Recording stream is invalid.');
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
     * The recording is tenant data: the caller must own the recording (with
     * the softphone permission) or manage calls, must be in the recording's
     * own company, and the recording must not have expired.
     */
    private function authorizeRecordingAccess(CallRecording $recording): void
    {
        // The agent who made the recording (with call permission), or a call
        // manager (admin / manage_calls). The owner id can come back from the
        // model as a string, so it is normalised; a null owner never matches.
        $ownerId = $recording->user_id === null ? null : (int) $recording->user_id;

        abort_unless(CallAccess::canPlayRecording(user(), $ownerId), 403);

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

    /**
     * Resolve the filesystem path for an object stored locally.
     */
    private function resolveLocalPath(string $objectPath): ?string
    {
        $disk = Storage::disk('local');
        if ($disk->exists($objectPath)) {
            $path = $disk->path($objectPath);
            if (is_file($path)) {
                return $path;
            }
        }

        $fallback = storage_path('app/' . ltrim($objectPath, '/'));
        if (is_file($fallback)) {
            return $fallback;
        }

        $publicUploads = public_path(Files::UPLOAD_FOLDER . '/' . ltrim($objectPath, '/'));
        if (is_file($publicUploads)) {
            return $publicUploads;
        }

        return null;
    }

    /**
     * Stream a local file with HTTP Range support for seeking in <audio>.
     *
     * Uses fopen/fread directly instead of Symfony's BinaryFileResponse /
     * response()->file(), which calls is_readable() and fails on Windows
     * under certain ACL configurations.
     */
    private function streamLocalFile(string $path, CallRecording $callRecording, string $disposition = 'inline')
    {
        $size = (int) @filesize($path);
        $storedType = $callRecording->mime_type ?: 'audio/mpeg';
        $contentType = str_starts_with($storedType, 'audio/') ? $storedType : 'audio/mpeg';

        $headers = [
            'Content-Type' => $contentType,
            'Content-Disposition' => $disposition . '; filename="' . addslashes($callRecording->filename) . '"',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=0, no-store',
        ];

        $range = request()->header('Range');
        $start = 0;
        $end = $size > 0 ? $size - 1 : 0;
        $status = 200;

        if ($range && preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
            $start = (int) $matches[1];
            if (! empty($matches[2])) {
                $end = min((int) $matches[2], $size - 1);
            }
            if ($start <= $end && $start < $size) {
                $status = 206;
                $length = $end - $start + 1;
                $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
                $headers['Content-Length'] = (string) $length;
            } else {
                return response('', 416, ['Content-Range' => "bytes */{$size}"]);
            }
        } else {
            $headers['Content-Length'] = (string) $size;
        }

        return response()->stream(function () use ($path, $start, $end): void {
            $handle = fopen($path, 'rb');
            if ($handle === false) {
                return;
            }
            try {
                if ($start > 0) {
                    fseek($handle, $start);
                }
                $remaining = $end - $start + 1;
                $chunkSize = 64 * 1024;
                while ($remaining > 0 && ! feof($handle)) {
                    $readLength = min($remaining, $chunkSize);
                    $buffer = fread($handle, $readLength);
                    if ($buffer === false || $buffer === '') {
                        break;
                    }
                    echo $buffer;
                    flush();
                    $remaining -= strlen($buffer);
                }
            } finally {
                fclose($handle);
            }
        }, $status, $headers);
    }

    /**
     * Resolve the filesystem disk for recording storage.
     * Prioritizes S3 (or S3-compatible cloud storage) when configured.
     */
    private function resolveStorageDisk(): string
    {
        $customDisk = config('filesystems.call_recordings_disk') ?: (function_exists('env') ? env('CALL_RECORDINGS_DISK') : null);
        if (! empty($customDisk) && config("filesystems.disks.{$customDisk}")) {
            return (string) $customDisk;
        }

        // 1. If default filesystem is S3-compatible and configured
        $default = (string) config('filesystems.default');
        if ($this->isS3DiskConfigured($default)) {
            return $default;
        }

        // 2. If 's3' disk has credentials/bucket configured
        if ($this->isS3DiskConfigured('s3')) {
            return 's3';
        }

        // 3. If 'aws_s3' disk has credentials/bucket configured
        if ($this->isS3DiskConfigured('aws_s3')) {
            return 'aws_s3';
        }

        // 4. Check cloud disk
        $cloud = (string) config('filesystems.cloud');
        if ($this->isS3DiskConfigured($cloud)) {
            return $cloud;
        }

        // 5. Check any other S3-compatible storage from StorageSetting
        foreach (StorageSetting::S3_COMPATIBLE_STORAGE as $candidate) {
            if ($this->isS3DiskConfigured($candidate)) {
                return $candidate;
            }
        }

        return 'local';
    }

    /**
     * Check whether a disk name corresponds to an S3-compatible driver with configured bucket.
     */
    private function isS3DiskConfigured(string $disk): bool
    {
        if (empty($disk) || $disk === 'local' || $disk === 'public' || $disk === 'storage') {
            return false;
        }

        $bucket = config("filesystems.disks.{$disk}.bucket");
        $key = config("filesystems.disks.{$disk}.key");

        return ! empty($bucket) && ! empty($key);
    }

    /**
     * Stream a file directly from a Laravel Storage disk with HTTP Range support.
     */
    private function streamDiskFile(string $diskName, CallRecording $callRecording, string $disposition = 'inline')
    {
        $disk = Storage::disk($diskName);
        if (! $disk->exists($callRecording->object_path)) {
            abort(404);
        }

        $size = (int) $disk->size($callRecording->object_path);
        $storedType = $callRecording->mime_type ?: 'audio/mpeg';
        $contentType = str_starts_with($storedType, 'audio/') ? $storedType : 'audio/mpeg';

        $headers = [
            'Content-Type' => $contentType,
            'Content-Disposition' => $disposition . '; filename="' . addslashes($callRecording->filename) . '"',
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'private, max-age=0, no-store',
        ];

        $range = request()->header('Range');
        $start = 0;
        $end = $size > 0 ? $size - 1 : 0;
        $status = 200;

        if ($range && preg_match('/bytes=(\d+)-(\d*)/', $range, $matches)) {
            $start = (int) $matches[1];
            if (! empty($matches[2])) {
                $end = min((int) $matches[2], $size - 1);
            }
            if ($start <= $end && $start < $size) {
                $status = 206;
                $length = $end - $start + 1;
                $headers['Content-Range'] = "bytes {$start}-{$end}/{$size}";
                $headers['Content-Length'] = (string) $length;
            } else {
                return response('', 416, ['Content-Range' => "bytes */{$size}"]);
            }
        } else {
            $headers['Content-Length'] = (string) $size;
        }

        return response()->stream(function () use ($disk, $callRecording, $start, $end): void {
            $stream = $disk->readStream($callRecording->object_path);
            if ($stream === null || $stream === false) {
                return;
            }
            try {
                if ($start > 0) {
                    if (stream_get_meta_data($stream)['seekable'] ?? false) {
                        fseek($stream, $start);
                    } else {
                        $toDiscard = $start;
                        while ($toDiscard > 0 && ! feof($stream)) {
                            $chunk = fread($stream, min($toDiscard, 64 * 1024));
                            if ($chunk === false || $chunk === '') {
                                break;
                            }
                            $toDiscard -= strlen($chunk);
                        }
                    }
                }
                $remaining = $end - $start + 1;
                $chunkSize = 64 * 1024;
                while ($remaining > 0 && ! feof($stream)) {
                    $readLength = min($remaining, $chunkSize);
                    $buffer = fread($stream, $readLength);
                    if ($buffer === false || $buffer === '') {
                        break;
                    }
                    echo $buffer;
                    flush();
                    $remaining -= strlen($buffer);
                }
            } finally {
                if (is_resource($stream)) {
                    fclose($stream);
                }
            }
        }, $status, $headers);
    }

    /**
     * Unified streaming handler for call recordings (Bunny CDN, local or S3).
     */
    private function streamRecording(CallRecording $callRecording, string $disposition = 'inline')
    {
        // 1. If external_url is present (Bunny CDN or remote storage), stream inline with Range support
        if (! empty($callRecording->external_url)) {
            return $this->streamRemoteInline($callRecording, $disposition);
        }

        // 2. Try local disk if the file exists on the local filesystem
        if (! empty($callRecording->object_path)) {
            $localPath = $this->resolveLocalPath($callRecording->object_path);
            if ($localPath !== null) {
                return $this->streamLocalFile($localPath, $callRecording, $disposition);
            }
        }

        // 3. Try S3 storage if object_path is present and S3 disk is configured
        if (! empty($callRecording->object_path)) {
            $s3Disk = $this->resolveStorageDisk();
            if ($s3Disk !== 'local') {
                try {
                    $temporaryUrl = Storage::disk($s3Disk)->temporaryUrl($callRecording->object_path, now()->addMinutes(30));
                    return $this->streamRemoteInline($callRecording, $disposition, $temporaryUrl);
                } catch (\Throwable $e) {
                    Log::info('CallRecordingController: temporaryUrl failed, trying disk stream', [
                        'recording_id' => $callRecording->id,
                        'disk' => $s3Disk,
                        'error' => $e->getMessage(),
                    ]);
                    try {
                        return $this->streamDiskFile($s3Disk, $callRecording, $disposition);
                    } catch (\Throwable $e2) {
                        Log::warning('CallRecordingController: S3 disk stream failed', [
                            'recording_id' => $callRecording->id,
                            'disk' => $s3Disk,
                            'error' => $e2->getMessage(),
                        ]);
                    }
                }
            }
        }

        abort(404, 'Recording file not found.');
    }

    /**
     * Stream a recording for inline playback in the browser.
     */
    public function play(CallRecording $callRecording)
    {
        $this->authorizeRecordingAccess($callRecording);

        return $this->streamRecording($callRecording, 'inline');
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

        return $this->streamRecording($callRecording, $disposition);
    }
}
