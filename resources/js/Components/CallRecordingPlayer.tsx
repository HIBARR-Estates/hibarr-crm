import React, { useCallback, useRef, useState } from "react";
import { App } from "antd";
import {
    CaretRightFilled,
    DownloadOutlined,
    ExportOutlined,
    LoadingOutlined,
    PauseOutlined,
} from "@ant-design/icons";
import "./CallRecordingPlayer.css";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface RecordingPlayerProps {
    /** API endpoint that streams the recording inline with the right MIME type. */
    playUrl: string;
    /**
     * API endpoint that serves the recording for download. It is an authorised
     * app route, never the raw object-storage link — the storage URL is a
     * durable bearer credential and is not handed to the browser.
     */
    downloadUrl?: string | null;
    /** Duration in seconds, used as the scrubber's fallback length. */
    durationSeconds?: number | null;
    filename?: string;
    expired?: boolean;
    /**
     * App endpoint that opens the recording in its own tab. For a WebM
     * recording it leads to Bunny's player, the only place those play.
     */
    openUrl?: string | null;
    /**
     * The recording cannot play in the page (WebM): show a link to `openUrl`
     * instead of the player.
     */
    opensInNewTab?: boolean;
}

/**
 * Plays a call recording in the page.
 *
 * The underlying object storage serves uploads as `binary/octet-stream`, which
 * browsers will not decode, and its links are download URLs. So playback goes
 * through `playUrl`, which streams the bytes back with `Content-Type: audio/mpeg`
 * and Range support (so seeking works). `downloadUrl` is only offered as an
 * explicit "save the file" action.
 *
 * Styled by CallBridgeSettings.css (`.cb-player`, `.cb-play`, `.cb-bar`), which
 * only applies inside the Call Bridge settings page.
 */
export default function RecordingPlayer({
    playUrl,
    downloadUrl,
    durationSeconds,
    filename,
    expired = false,
    openUrl = null,
    opensInNewTab = false,
}: RecordingPlayerProps) {
    const { td } = useTd();
    const { message } = App.useApp();
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const seekRef = useRef<HTMLDivElement | null>(null);
    const draggingRef = useRef(false);
    /** A seek requested before metadata loaded — replayed on `loadedmetadata`. */
    const pendingSeekRef = useRef<number | null>(null);
    const [playing, setPlaying] = useState(false);
    const [loading, setLoading] = useState(false);
    const [failed, setFailed] = useState(false);
    const [progress, setProgress] = useState(0);
    const [total, setTotal] = useState<number | null>(durationSeconds ?? null);
    // Set while dragging or keyboard-seeking so `onTimeUpdate` doesn't yank the
    // thumb back to the browser's position mid-gesture.
    const [scrubbing, setScrubbing] = useState(false);

    const toggle = useCallback(() => {
        const audio = audioRef.current;
        if (!audio) return;

        if (audio.paused) {
            setLoading(true);
            // Autoplay policies require a user gesture; this click is one.
            void audio.play().catch((err: unknown) => {
                setLoading(false);
                // Interrupting playback (a second play(), a pause, or seeking)
                // rejects with AbortError. That is not a failure to report.
                if (err instanceof DOMException && err.name === "AbortError") {
                    return;
                }
                setFailed(true);
                void message.error(td("The recording could not be played.", { source: "en" }));
            });
        } else {
            audio.pause();
        }
    }, [message]);

    /** Move the playhead, tolerating a not-yet-loaded stream. */
    const seekTo = useCallback((seconds: number) => {
        const audio = audioRef.current;
        if (!audio) return;
        const max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : total;
        const clamped = Math.max(0, max ? Math.min(seconds, max) : seconds);
        setProgress(clamped);
        // Assigning currentTime before any metadata throws; hold the target and
        // replay it as soon as the stream reports its duration.
        if (audio.readyState > 0) {
            try {
                audio.currentTime = clamped;
                pendingSeekRef.current = null;
            } catch {
                pendingSeekRef.current = clamped;
            }
        } else {
            pendingSeekRef.current = clamped;
        }
    }, [total]);

    const seekFromClientX = useCallback(
        (clientX: number) => {
            const bar = seekRef.current;
            if (!bar) return;
            const rect = bar.getBoundingClientRect();
            if (rect.width === 0) return;
            const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
            seekTo(ratio * (total ?? 0));
        },
        [seekTo, total],
    );

    const handleSeekKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (!total || total <= 0) return;
        const current = progress;
        let next: number | null = null;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") next = current + 5;
        else if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = current - 5;
        else if (e.key === "PageUp") next = current + 15;
        else if (e.key === "PageDown") next = current - 15;
        else if (e.key === "Home") next = 0;
        else if (e.key === "End") next = total;
        if (next === null) return;
        e.preventDefault();
        seekTo(next);
    };

    if (expired) {
        return <span className="cb-time">{td("Expired — no longer available", { source: "en" })}</span>;
    }

    if (opensInNewTab && openUrl) {
        return (
            <div className="cb-player-wrapper">
                <div className="cb-player">
                    <a
                        href={openUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cb-open"
                        title={td("Plays in Bunny's player in a new tab", { source: "en" })}
                        aria-label={`Open ${filename ?? "recording"} in a new tab`}
                    >
                        <ExportOutlined aria-hidden="true" />
                        <span>{td("Open recording", { source: "en" })}</span>
                    </a>
                    {total ? <span className="cb-time cb-num cb-time--end">{formatTime(total)}</span> : null}
                </div>
            </div>
        );
    }

    // Where a failed recording is offered: its own tab (Bunny's player for
    // WebM), else the app download.
    const fallbackUrl = openUrl ?? downloadUrl;

    const percent = total && total > 0 ? Math.min(100, (progress / total) * 100) : 0;

    return (
        <div className="cb-player-wrapper">
            <div className="cb-player">
            <audio
                ref={audioRef}
                src={playUrl}
                preload="metadata"
                onPlaying={() => {
                    setPlaying(true);
                    setLoading(false);
                    setFailed(false);
                }}
                onPause={() => setPlaying(false)}
                onWaiting={() => setLoading(true)}
                onCanPlay={() => setLoading(false)}
                onTimeUpdate={(e) => {
                    const el = e.currentTarget;
                    if (!scrubbing) {
                        setProgress(el.currentTime);
                    }
                    if (Number.isFinite(el.duration)) {
                        setTotal(el.duration);
                    }
                }}
                onLoadedMetadata={(e) => {
                    const el = e.currentTarget;
                    if (Number.isFinite(el.duration)) {
                        setTotal(el.duration);
                    }
                    if (pendingSeekRef.current !== null) {
                        try {
                            el.currentTime = pendingSeekRef.current;
                            pendingSeekRef.current = null;
                        } catch {
                            /* stream not seekable yet */
                        }
                    }
                }}
                onEnded={() => setPlaying(false)}
                onError={() => {
                    setFailed(true);
                    setPlaying(false);
                    setLoading(false);
                }}
                className="hidden"
            />

            <button
                type="button"
                className="cb-play"
                disabled={failed}
                aria-label={playing ? "Pause recording" : "Play recording"}
                onClick={toggle}
            >
                {loading ? (
                    <LoadingOutlined aria-hidden="true" />
                ) : playing ? (
                    <PauseOutlined aria-hidden="true" />
                ) : (
                    <CaretRightFilled aria-hidden="true" />
                )}
            </button>

            <div
                ref={seekRef}
                className="cb-seek"
                role="slider"
                tabIndex={failed ? -1 : 0}
                aria-label={`Seek in ${filename ?? "recording"}`}
                aria-valuemin={0}
                aria-valuemax={Math.max(0, Math.round(total ?? 0))}
                aria-valuenow={Math.round(progress)}
                aria-valuetext={`${formatTime(progress)} of ${formatTime(total)}`}
                aria-disabled={failed}
                style={{ "--p": `${percent}%` } as React.CSSProperties}
                onPointerDown={(e) => {
                    if (failed) return;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    draggingRef.current = true;
                    setScrubbing(true);
                    seekFromClientX(e.clientX);
                }}
                onPointerMove={(e) => {
                    if (draggingRef.current) {
                        seekFromClientX(e.clientX);
                    }
                }}
                onPointerUp={(e) => {
                    if (!draggingRef.current) return;
                    draggingRef.current = false;
                    setScrubbing(false);
                    e.currentTarget.releasePointerCapture(e.pointerId);
                    seekFromClientX(e.clientX);
                }}
                onPointerCancel={() => {
                    draggingRef.current = false;
                    setScrubbing(false);
                }}
                onKeyDown={handleSeekKeyDown}
            >
                <span className="cb-bar">
                    <span className="cb-bar__fill" />
                </span>
            </div>

            <span className="cb-time cb-num">
                {formatTime(progress)} / {formatTime(total)}
            </span>

            {downloadUrl && (
                <a
                    href={downloadUrl}
                    download={filename}
                    aria-label={`Download ${filename ?? "recording"}`}
                    title={td("Download", { source: "en" })}
                    className="cb-icon-btn cb-icon-btn--plain"
                >
                    <DownloadOutlined aria-hidden="true" />
                </a>
            )}

            </div>

            {failed && (
                <div className="cb-fail" role="alert">
                    <span>{td("Playback failed.", { source: "en" })}</span>
                    {fallbackUrl && (
                        <a href={fallbackUrl} target="_blank" rel="noopener noreferrer">
                            {td("Open in a new tab", { source: "en" })}
                        </a>
                    )}
                </div>
            )}
        </div>
    );
}

function formatTime(seconds: number | null | undefined): string {
    if (seconds == null || !Number.isFinite(seconds) || seconds < 0) {
        return "0:00";
    }
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${mins}:${String(secs).padStart(2, "0")}`;
}