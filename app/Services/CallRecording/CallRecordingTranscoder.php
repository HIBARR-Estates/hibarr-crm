<?php

namespace App\Services\CallRecording;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/**
 * Converts browser-recorded audio (WebM/Opus, Ogg, M4A) into MP3.
 *
 * MediaRecorder cannot emit MP3 — every browser supports only Opus/WebM (or
 * MP4/AAC on Safari) — so the conversion happens here on upload.
 *
 * Requires ffmpeg on the host. When it is unavailable the caller falls back to
 * storing the original audio untouched rather than losing the recording.
 */
class CallRecordingTranscoder
{
    public function __construct(
        private readonly ?string $ffmpegBinary = null,
        private readonly int $timeoutSeconds = 120,
    ) {
    }

    public function isAvailable(): bool
    {
        return $this->binary() !== null;
    }

    /**
     * Transcode $sourcePath to MP3 at $destinationPath.
     *
     * @return bool True when $destinationPath holds an MP3; false when the
     *              caller should keep the original file.
     */
    public function toMp3(string $sourcePath, string $destinationPath): bool
    {
        $binary = $this->binary();
        if ($binary === null || ! is_file($sourcePath)) {
            return false;
        }

        try {
            $process = new Process([
                $binary,
                '-hide_banner',
                '-loglevel', 'error',
                '-nostdin',
                '-y',
                // Only local files may be read — a crafted upload could
                // otherwise pull in a network resource or a local file.
                '-protocol_whitelist', 'file',
                '-i', $sourcePath,
                '-vn',                 // never carry a video stream through
                '-ac', '1',            // mono — call audio is single channel
                '-ar', '44100',
                '-b:a', '64k',
                '-codec:a', 'libmp3lame',
                $destinationPath,
            ]);
            $process->setTimeout($this->timeoutSeconds);
            $process->run();

            if (! $process->isSuccessful() || ! is_file($destinationPath)) {
                Log::warning('CallRecordingTranscoder: ffmpeg failed', [
                    'exit_code' => $process->getExitCode(),
                    'error' => trim($process->getErrorOutput()),
                ]);

                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::warning('CallRecordingTranscoder: transcode threw', [
                'message' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /** Extension the transcoded file should be stored under. */
    public function extension(): string
    {
        return 'mp3';
    }

    public function mimeType(): string
    {
        return 'audio/mpeg';
    }

    private function binary(): ?string
    {
        if ($this->ffmpegBinary !== null) {
            return is_executable($this->ffmpegBinary) ? $this->ffmpegBinary : null;
        }

        $configured = config('services.call_recording.ffmpeg_path') ?: 'ffmpeg';

        $process = new Process(['which', $configured]);
        $process->setTimeout(5);
        $process->run();

        if ($process->isSuccessful()) {
            $path = trim($process->getOutput());
            if ($path !== '' && is_executable($path)) {
                return $path;
            }
        }

        // Fall back to well-known locations when `which` is unavailable.
        foreach (['/usr/local/bin/ffmpeg', '/opt/homebrew/bin/ffmpeg', '/usr/bin/ffmpeg'] as $candidate) {
            if (is_executable($candidate)) {
                return $candidate;
            }
        }

        return null;
    }
}
