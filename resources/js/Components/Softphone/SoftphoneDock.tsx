import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ExternalLink, Phone, PhoneOff, X } from "lucide-react";
import useSoftphone from "@/Hooks/useSoftphone";
import useCallSounds from "@/Hooks/useCallSounds";
import axios from "axios";
import { Link, usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import "./SoftphoneDock.css";
import type {
    SoftphoneCallFailure,
    SoftphoneCallStage,
    SoftphoneRegistrationState,
} from "@/Types/api/softphone";

/** How often to re-check the caller's number for a lead while ringing. */
const LEAD_MATCH_POLL_MS = 8000;

/**
 * How long a failed-call notice stays on screen when the agent ignores it.
 * Long enough to read and react, short enough that it never becomes clutter.
 */
const FAILURE_NOTICE_MS = 30_000;

type MatchedLead = {
    id: number;
    name: string;
    url: string;
};

type CallRouting = {
    matched: boolean;
    lead_id: number | null;
    owner_id: number | null;
    name: string | null;
    url: string | null;
    route: "owner" | "pool" | "all" | null;
    can_ring: boolean;
    pool_user_ids: number[];
    fallback_seconds: number;
    current_user_id: number | null;
};

type CallRecordingItem = {
    id: number;
    filename: string;
    play_url: string;
    is_expired: boolean;
};

const STATUS_DOT: Record<SoftphoneRegistrationState, string> = {
    idle: "bg-slate-300",
    registering: "bg-amber-400 animate-pulse",
    registered: "bg-emerald-500",
    unregistered: "bg-amber-400",
    failed: "bg-red-500",
};

/** What the dock says for each stage of the call lifecycle. */
const STAGE_LABEL: Record<SoftphoneCallStage, string> = {
    calling: "Calling…",
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected: "Connected",
    ended: "Call ended",
};

function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Ticks once a second once the call is up; null before that. */
function useElapsed(connectedAt: number | null): string | null {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (connectedAt === null) {
            return;
        }
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [connectedAt]);

    return useMemo(() => {
        if (connectedAt === null) {
            return null;
        }
        return formatDuration(now - connectedAt);
    }, [connectedAt, now]);
}

/** Up to two initials for the avatar bubble. */
function initialsOf(name: string | null | undefined, fallback: string): string {
    return (
        (name ?? fallback ?? "")
            .split(/\s+/)
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase() || "·"
    );
}

/**
 * Who the dock is talking to. When the number resolved to a lead, the name is
 * an Inertia link: clicking it swaps the page in place (the persistent
 * DashboardLayout keeps this dock — and the call — mounted), so the agent can
 * read the lead mid-call without dropping the SIP session. `href` is left
 * untouched for ctrl/cmd-click, which opens a new tab and does end the call
 * on this page, so the tooltip says so.
 */
function CallIdentity({
    name,
    peer,
    leadUrl,
    children,
}: {
    name: string;
    peer: string;
    leadUrl?: string | null;
    children?: React.ReactNode;
}) {
    return (
        <>
            <div className="sp__avatar" aria-hidden="true">
                {initialsOf(name, peer)}
            </div>
            <h2 className="sp__name">
                {leadUrl ? (
                    <Link
                        href={leadUrl}
                        className="sp__name-link"
                        title="Open this lead — the call keeps running"
                    >
                        {name}
                        <ExternalLink className="sp__name-open" aria-hidden="true" />
                    </Link>
                ) : (
                    name
                )}
            </h2>
            <p className="sp__number">{peer}</p>
            {children}
        </>
    );
}

/** The call lifecycle state ("Calling…", "Connecting…", "Connected"). */
function CallStateBadge({ stage }: { stage: SoftphoneCallStage }) {
    return (
        <p className="sp__state" data-stage={stage} role="status" aria-live="polite">
            {STAGE_LABEL[stage]}
        </p>
    );
}

/**
 * Why a call never connected. Stays on screen until the agent closes it (or
 * FAILURE_NOTICE_MS passes) — a failed call used to make the dock vanish with
 * no explanation at all, which read as the app crashing.
 */
function CallFailedNotice({
    failure,
    onRetry,
    onClose,
}: {
    failure: SoftphoneCallFailure;
    onRetry: () => void;
    onClose: () => void;
}) {
    return (
        <section className="sp sp--failed" role="alertdialog" aria-label="Call failed">
            <header className="sp__head">
                <span className="sp__dot sp__dot--failed" />
                Softphone
            </header>
            <div className="sp__body">
                <div className="sp__avatar sp__avatar--failed" aria-hidden="true">
                    <PhoneOff size={30} strokeWidth={1.7} />
                </div>
                <h2 className="sp__name">Call failed</h2>
                {/* Who it was about, not just the digits — otherwise a failed
                    call is just "a number" with no owner. */}
                <p className="sp__number">
                    {failure.direction === "outbound" ? "To" : "From"}{" "}
                    {failure.context?.leadName || failure.peer}
                </p>
                {failure.context?.leadName && (
                    <p className="sp__number sp__number--peer">{failure.peer}</p>
                )}
                <p className="sp__reason">{failure.reason}</p>

                <div className="sp__actions">
                    <button type="button" className="act" onClick={onRetry}>
                        <span className="act__btn">
                            <Phone size={24} strokeWidth={2} />
                        </span>
                        Try again
                    </button>
                    <button type="button" className="act" onClick={onClose}>
                        <span className="act__btn">
                            <X size={24} strokeWidth={2} />
                        </span>
                        Close
                    </button>
                </div>
            </div>
        </section>
    );
}

/**
 * Call-control widget for the in-browser softphone (sipgate Neo via SIP.js).
 * No dialer — calls are originated by click-to-call elsewhere; this surface
 * auto-opens while a call is ringing/active and shows answer/decline or
 * mute/hold/hangup. Audio is browser ↔ sipgate; the CRM timeline is driven
 * by the OL call-bridge poll and is unaffected here.
 */
export default function SoftphoneDock() {
    const { props } = usePage();
    const canRecord = props.auth?.permissions?.make_softphone_calls === "all";
    const {
        isEnabled,
        state,
        devices,
        activeDeviceId,
        setActiveDevice,
        attachRemoteAudio,
        answer,
        reject,
        hangup,
        setMuted,
        setHold,
        isActiveTab,
        clearCallFailure,
    } = useSoftphone();

    const [pinnedOpen, setPinnedOpen] = useState(false);
const [position, setPosition] = useState(() => {
    try {
        const raw = window.localStorage.getItem("softphone.dock.position");
        if (raw) {
            const v = JSON.parse(raw) as { right: number; bottom: number };
            if (v && Number.isFinite(v.right) && Number.isFinite(v.bottom)) {
                return v;
            }
        }
    } catch {
        // ignore
    }
    return { right: 20, bottom: 20 };
});
const dragRef = useRef<{ x: number; y: number; position: { right: number; bottom: number } } | null>(null);
    const activeCall = state.call;
    const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
    // Stable ref callback: an inline arrow would be re-run on every render,
    // detaching/reattaching the audio element (and resetting playback).
    const remoteAudioCallback = useCallback(
        (node: HTMLAudioElement | null) => {
            remoteAudioRef.current = node;
            attachRemoteAudio(node);
        },
        [attachRemoteAudio],
    );
    const recordChunksRef = useRef<Blob[]>([]);
    const recordContextRef = useRef<AudioContext | null>(null);
    const recordStreamRef = useRef<MediaStream | null>(null);
    const recordStartedAtRef = useRef<number | null>(null);
    const recordRecorderRef = useRef<MediaRecorder | null>(null);
    const [recordingUploading, setRecordingUploading] = useState(false);
    const [lastRecordingUrl, setLastRecordingUrl] = useState<string | null>(null);
    const [recordings, setRecordings] = useState<CallRecordingItem[]>([]);
    const [matchedLead, setMatchedLead] = useState<MatchedLead | null>(null);
    const [inboundRoute, setInboundRoute] = useState<CallRouting | null>(null);
    const [routingMode, setRoutingMode] = useState<"owner" | "pool" | "all">("all");
    const [unmatchedPromptPhone, setUnmatchedPromptPhone] = useState<string | null>(null);
    const [lastInboundPhone, setLastInboundPhone] = useState<string | null>(null);
    const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Guards against double-logging when Answer is clicked in the dock while the
    // island alert for the same call is also on screen.
    const inboundLoggedRef = useRef<string | null>(null);

    const elapsed = useElapsed(
        activeCall?.connectedAt ?? activeCall?.answeredAt ?? null,
    );

    /** The lead this call is about: the caller's entry point knew one (outbound),
     * or it was matched from the caller's number (inbound). */
    const callLead = useMemo<MatchedLead | null>(() => {
        const context = activeCall?.context;
        if (context?.leadId) {
            return {
                id: context.leadId,
                name: context.leadName ?? "",
                url: route("lead-contact.show", context.leadId),
            };
        }
        return matchedLead;
    }, [activeCall?.context, matchedLead]);

    /**
    /**
     * Stable reference for the current call. Shared by the hang-up timeline
     * event and the recording upload so the two can be linked afterwards.
     */
    const callRefRef = useRef<string | null>(null);
    const callRef = useMemo(() => {
        if (activeCall === null) {
            callRefRef.current = null;
            return null;
        }
        if (callRefRef.current === null) {
            callRefRef.current =
                typeof crypto !== "undefined" && "randomUUID" in crypto
                    ? crypto.randomUUID()
                    : `call-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        }
        return callRefRef.current;
    }, [activeCall?.id]);

    /**
     * Why this call reached this agent. Shown in the ringing popup and stored
     * on the recording so the audio can be traced back to its cause.
     */
    const callRoutingReason = useMemo(() => {
        if (activeCall?.direction !== "inbound") {
            return "outbound";
        }
        if (!inboundRoute?.matched) {
            return "unmatched";
        }
        if (routingMode === "owner") {
            return "lead_owner";
        }
        return "pool_fallback";
    }, [activeCall?.direction, inboundRoute?.matched, routingMode]);

useEffect(() => {
    try {
        window.localStorage.setItem(
            "softphone.dock.position",
            JSON.stringify(position),
        );
    } catch {
        // ignore storage errors
    }
}, [position]);

const handleDragStart = (e: React.PointerEvent) => {
    dragRef.current = {
        x: e.clientX,
        y: e.clientY,
        position: { ...position },
    };
    const onMove = (ev: PointerEvent) => {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.x;
        const dy = ev.clientY - dragRef.current.y;
        setPosition({
            right: Math.max(0, dragRef.current.position.right - dx),
            bottom: Math.max(0, dragRef.current.position.bottom - dy),
        });
    };
    const onUp = () => {
        dragRef.current = null;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    e.preventDefault();
};

const [connectionQuality, setConnectionQuality] = useState<"good" | "unstable" | "poor">("good");
useEffect(() => {
    if (!activeCall || activeCall.phase !== "active") {
        setConnectionQuality("good");
        return;
    }
    let cancelled = false;
    const id = window.setInterval(async () => {
        try {
            const report = await softphone.getStats();
            if (cancelled || !report) return;
            let lost = 0;
            let received = 0;
            let jitter = 0;
            let found = false;
            report.forEach((r: Record<string, unknown>) => {
                if (r.type === "inbound-rtp" && r.kind === "audio") {
                    lost += Number(r.packetsLost || 0);
                    received += Number(r.packetsReceived || 0);
                    if (typeof r.jitter === "number") jitter = Number(r.jitter);
                    found = true;
                }
            });
            if (!found || cancelled) return;
            const lossRate = lost / Math.max(1, lost + received);
            if (lossRate > 0.1 || jitter > 0.08) setConnectionQuality("poor");
            else if (lossRate > 0.02 || jitter > 0.03) setConnectionQuality("unstable");
            else setConnectionQuality("good");
        } catch {
            // quality is cosmetic only
        }
    }, 4000);
    return () => {
        cancelled = true;
        window.clearInterval(id);
    };
}, [activeCall?.id, activeCall?.phase]);

    // Ring/state sounds come from real MP3s in public/audio/softphone rather
    // than a synthesised oscillator tone.
    const {
        playIncoming,
        startRinging,
        stopRinging,
        playEnded,
        stopAll,
        unlock,
    } = useCallSounds();

    // Allow playback once the user has interacted with the page (autoplay policy).
    useEffect(() => {
        const opts = { once: true, passive: true } as const;
        window.addEventListener("pointerdown", unlock, opts);
        window.addEventListener("keydown", unlock, opts);
        return () => {
            window.removeEventListener("pointerdown", unlock);
            window.removeEventListener("keydown", unlock);
        };
    }, [unlock]);

    // Drive the sounds from the call state.
    useEffect(() => {
        const phase = activeCall?.phase;

        if (phase === "inbound") {
            playIncoming();
            startRinging();
            return;
        }

        if (phase === "outbound") {
            startRinging();
            return;
        }

        // No live call — silence everything.
        stopRinging();

        return () => stopRinging();
    }, [activeCall?.id, activeCall?.phase, playIncoming, startRinging, stopRinging]);

    // One-shot "call finished" cue when a live call drops.
    const wasInCallRef = useRef(false);
    useEffect(() => {
        const inCall = activeCall !== null && activeCall.phase !== "inbound";
        const ringing = activeCall?.phase === "inbound";

        if (ringing) {
            wasInCallRef.current = true;
            return;
        }

        if (inCall) {
            wasInCallRef.current = true;
            stopRinging();
            return;
        }

        if (wasInCallRef.current) {
            wasInCallRef.current = false;
            stopAll();
            playEnded();
        }
    }, [activeCall, stopRinging, stopAll, playEnded]);

    // Lead matching, inbound only. An outbound call carries whatever lead its
    // entry point already had (a task's quick-action, a phone next to a lead) —
    // we never go looking one up, because the dialer only knows a number.
    // Inbound still matches: the caller is unknown, and the match can land late
    // (the call bridge resolves on its own schedule), so keep checking while
    // the call rings.
    const matchedLeadRef = useRef<MatchedLead | null>(null);
    useEffect(() => {
        matchedLeadRef.current = matchedLead;
    }, [matchedLead]);

    useEffect(() => {
        const call = activeCall;
        if (call === null) {
            matchedLeadRef.current = null;
            setMatchedLead(null);
            setInboundRoute(null);
            setRoutingMode("all");
            return;
        }

        const phone = call.peer;
        if (!phone || call.direction !== "inbound") {
            return;
        }
        setLastInboundPhone(phone);

        let cancelled = false;
        const lookup = async () => {
            try {
                const response = await axios.get(route("telephony.softphone.lead-match"), {
                    params: { phone, device_id: activeDeviceId },
                });
                if (cancelled) return;
                const data = response.data?.data as CallRouting | null;
                if (call.direction === "inbound") {
                    // Routing only applies to inbound calls.
                    setInboundRoute(data);
                    setRoutingMode(data?.route === "owner" ? "owner" : "all");
                }
                const lead =
                    data?.matched && data.lead_id
                        ? {
                              id: data.lead_id,
                              name: data.name ?? "Lead",
                              url: data.url ?? "",
                          }
                        : null;
                matchedLeadRef.current = lead;
                setMatchedLead(lead);
                if (lead) {
                    // Tell the client who this call is about: it copies this
                    // onto the call (and onto a failure notice if the call dies).
                    softphone.setCallContext({ leadId: lead.id, leadName: lead.name });
                }
            } catch {
                if (!cancelled && call.direction === "inbound") {
                    setInboundRoute(null);
                    setMatchedLead(null);
                    setRoutingMode("all");
                }
            }
        };

        void lookup();
        const poll = window.setInterval(() => {
            if (!matchedLeadRef.current) {
                void lookup();
            }
        }, LEAD_MATCH_POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(poll);
        };
        // Keyed on the call id only: the phase changes as the call progresses,
        // and re-running then would wipe a match we already have.
    }, [activeCall?.id, activeDeviceId]);

    useEffect(() => {
        if (!activeCall || activeCall.phase !== "inbound" || !inboundRoute) return;
        // Owner ring first only; non-owners and non-eligible poll agents stay
        // locally hidden instead of terminating the underlying SIP invitation.
        if (routingMode === "owner" && Number(inboundRoute.owner_id ?? -1) !== Number(props.auth?.user?.id ?? -1)) {
            // hidden locally; keep the SIP session so routingMode can fall back
        }
        if (routingMode === "all" || routingMode === "pool") {
            if (!inboundRoute.can_ring) {
                // Non-eligible sessions stay silent and do not present the call.
            }
        }

        if (routingMode === "owner" && (fallbackRef.current == null)) {
            fallbackRef.current = setTimeout(() => {
                setRoutingMode("pool");
            }, Math.max(1, inboundRoute.fallback_seconds) * 1000);
        }

        return () => {
            if (fallbackRef.current) {
                clearTimeout(fallbackRef.current);
                fallbackRef.current = null;
            }
        };
    }, [activeCall?.id, activeCall?.phase, inboundRoute, routingMode, props.auth?.user?.id]);

    /**
     * Single place inbound calls are written to the timeline. Shared by the
     * dock Answer button and the notification island Answer action, and keyed on
     * the call id so one answered call can only ever log once.
     */
    const logInboundCallStarted = useCallback(
        async (callId: string, peer: string | null) => {
            if (!inboundRoute?.matched || !inboundRoute.lead_id) {
                return;
            }
            if (inboundLoggedRef.current === callId) {
                return;
            }
            inboundLoggedRef.current = callId;
            await axios
                .post(route("telephony.softphone.events.store"), {
                    phone: peer,
                    entity_type: "lead",
                    entity_id: inboundRoute.lead_id,
                    event: "call.started",
                    direction: "inbound",
                })
                .catch(() => {
                    // Timeline logging is best-effort only.
                    inboundLoggedRef.current = null;
                });
        },
        [inboundRoute],
    );

    // Incoming calls are surfaced in the softphone dock only. The dock
    // auto-opens while a call is ringing or live and owns Answer/Decline/Hang up.

    useEffect(() => {
        if (activeCall === null && inboundRoute && !inboundRoute.matched) {
            setUnmatchedPromptPhone(lastInboundPhone ?? null);
        }
    }, [activeCall, inboundRoute]);

    const hasActiveCall = activeCall !== null;

    useEffect(() => {
        void loadRecordings();
    }, [canRecord]);
    const loadRecordings = async () => {
        if (!canRecord) return;
        try {
            const response = await axios.get(route("call-recordings.index"));
            setRecordings(response.data?.data ?? []);
        } catch {
            // ignore — list is optional
        }
    };

    useEffect(() => {
        if (!hasActiveCall || !canRecord || activeCall?.phase !== "active") return;

        const started = async () => {
            if (recordRecorderRef.current) return;
            const audioEl = remoteAudioRef.current;
            const remoteStream = audioEl?.srcObject instanceof MediaStream
                ? audioEl.srcObject
                : null;
            let micStream: MediaStream | null = null;
            try {
                micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch {
                // Keep remote-side recording when mic access is unavailable.
            }

            const ctx = new AudioContext();
            const destination = ctx.createMediaStreamDestination();
            if (remoteStream) {
                ctx.createMediaStreamSource(remoteStream).connect(destination);
            }
            if (micStream) {
                ctx.createMediaStreamSource(micStream).connect(destination);
            }

            // MediaRecorder cannot encode MP3 — it only emits Opus/WebM (or
            // MP4/AAC on Safari). Pick the best *audio-only* type so we never
            // end up with a video/webm container, and let the server transcode
            // to MP3 on upload.
            const AUDIO_MIME_CANDIDATES = [
                "audio/webm;codecs=opus",
                "audio/ogg;codecs=opus",
                "audio/webm",
                "audio/ogg",
                "audio/mp4",
            ];
            const mimeType = AUDIO_MIME_CANDIDATES.find((type) =>
                MediaRecorder.isTypeSupported(type),
            );

            const recorder = new MediaRecorder(
                destination.stream,
                mimeType
                    ? { mimeType, audioBitsPerSecond: 48000 }
                    : { audioBitsPerSecond: 48000 },
            );
            recordChunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordChunksRef.current.push(event.data);
                }
            };
            recorder.onstop = async () => {
                const blob = new Blob(recordChunksRef.current, {
                    type: recorder.mimeType || mimeType || "audio/webm",
                });
                recordChunksRef.current = [];
                const duration = recordStartedAtRef.current
                    ? Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000))
                    : 1;
                recordStartedAtRef.current = null;
                setRecordingUploading(true);
                try {
                    const form = new FormData();
                    // Upload with a container-appropriate extension; the server
                    // transcodes to MP3 before storing.
                    const extension =
                        (recorder.mimeType || mimeType || "").includes("mp4")
                            ? "m4a"
                            : (recorder.mimeType || mimeType || "").includes("ogg")
                              ? "ogg"
                              : "webm";
                    form.append("recording", blob, `call-${Date.now()}.${extension}`);
                    form.append("duration", String(duration));
                    // Which channel/line this recording was captured on, so the
                    // recordings view can group by line.
                    form.append("device_id", String(activeDeviceId ?? ""));
                    // Why this call reached this agent: the matched lead (or the
                    // fact it was unmatched) and the routing decision.
                    if (callLead) {
                        form.append("entity_type", "lead");
                        form.append("entity_id", String(callLead.id));
                    }
                    if (callLead?.name) {
                        form.append("lead_name", callLead.name);
                    }
                    form.append(
                        "phone_number",
                        activeCall?.peer ?? lastInboundPhone ?? "",
                    );
                    form.append(
                        "direction",
                        activeCall?.direction === "inbound" ? "inbound" : "outbound",
                    );
                    form.append("routing_reason", callRoutingReason);
                    if (callRef) {
                        form.append("call_ref", callRef);
                    }
                    const response = await axios.post(
                        route("call-recordings.store"),
                        form,
                        {
                            headers: {
                                "X-CSRF-TOKEN":
                                    document
                                        .querySelector('meta[name="csrf-token"]')
                                        ?.getAttribute("content") || "",
                            },
                        },
                    );
                    const playUrl =
                        response.data?.data?.play_url ||
                        response.data?.play_url;
                    if (playUrl) {
                        setLastRecordingUrl(playUrl);
                    }
                    void loadRecordings();
                } catch {
                    console.warn("[softphone] Recording upload failed");
                } finally {
                    setRecordingUploading(false);
                }
                micStream?.getTracks().forEach((track) => track.stop());
                try {
                    await ctx.close();
                } catch {
                    // ignore
                }
                recordRecorderRef.current = null;
            };
            recordContextRef.current = ctx;
            recordStreamRef.current = destination.stream;
            recordRecorderRef.current = recorder;
            recordStartedAtRef.current = Date.now();
            recorder.start(1000);
        };

        void started();
        return () => {
            const recorder = recordRecorderRef.current;
            if (recorder && recorder.state !== "inactive") {
                recorder.stop();
            }
            recordRecorderRef.current = null;
            recordContextRef.current?.close().catch(() => undefined);
            recordContextRef.current = null;
            recordStartedAtRef.current = null;
        };
    }, [activeCall?.id, activeCall?.phase, canRecord, hasActiveCall]);

    const hasCall = activeCall !== null;

    // Auto-open while a call rings or is live; collapse once it ends.
    // A FAILED call keeps the dock open with the reason — closing silently
    // left agents thinking the app had hung. It self-dismisses after
    // FAILURE_NOTICE_MS so it cannot sit on screen forever.
    const callFailure = state.callFailure;
    const open = pinnedOpen || hasCall || callFailure !== null;

    useEffect(() => {
        if (!callFailure) {
            return;
        }
        const timer = window.setTimeout(
            () => clearCallFailure(),
            FAILURE_NOTICE_MS,
        );
        return () => window.clearTimeout(timer);
    }, [callFailure, clearCallFailure]);

    const retryFailedCall = () => {
        const failure = callFailure;
        clearCallFailure();
        if (failure?.peer) {
            void softphone.call(failure.peer, failure.context);
        }
    };

    if (!isEnabled) {
        return null;
    }

    // Owner-first / non-eligible sessions are hidden locally only when we
    // actually know they shouldn't ring. While the lead-match request is in
    // flight (or failed) inboundRoute is null and the call must still be
    // answerable, otherwise the user gets a ring with no controls at all.
    const isOwnerSession =
        inboundRoute === null ||
        routingMode !== "owner" ||
        Number(inboundRoute.owner_id ?? -1) === Number(props.auth?.user?.id ?? -1);
    const isEligibleSession =
        inboundRoute === null || routingMode === "owner" || inboundRoute.can_ring;

    const ringingInbound =
        activeCall?.phase === "inbound" && isOwnerSession && isEligibleSession;
    const inCall =
        activeCall !== null &&
        (activeCall.phase === "active" || activeCall.phase === "outbound");

    const quality =
        connectionQuality === "poor"
            ? "poor"
            : connectionQuality === "unstable"
              ? "fair"
              : "good";

    const statusDotClass =
        state.registration === "registered"
            ? "sp__dot sp__dot--registered"
            : state.registration === "registering"
              ? "sp__dot sp__dot--registering"
              : "sp__dot sp__dot--unregistered";

    // Keep the matched lead's name visible even after the call is answered
    // (the design's title is the identity block, shared across both states).
    const titleName =
        callLead?.name ??
        (inboundRoute?.matched ? (inboundRoute?.name ?? activeCall?.peer ?? "") : (activeCall?.peer ?? ""));

    // No floating FAB is shipped — the dock opens on its own when a call
    // arrives, and stays pinned in development for testing.

    return (
        <>
            <audio ref={remoteAudioCallback} className="hidden" />

            {/* Failed call — the reason sticks around until closed. */}
            {callFailure && !hasCall && (
                <CallFailedNotice
                    failure={callFailure}
                    onRetry={retryFailedCall}
                    onClose={clearCallFailure}
                />
            )}

            {/* Inbound call was not matched to a lead — prompt to create one. */}
            {unmatchedPromptPhone && (
                <div className="sp__unmatched-notice">
                    <p>
                        This call was not matched to an existing lead. Would you like to create a new lead from this call?
                    </p>
                    <div className="sp__unmatched-actions">
                        <button
                            type="button"
                            className="act act--ok"
                            onClick={() => {
                                window.location.href = route("lead.create", {
                                    phone_number: unmatchedPromptPhone,
                                });
                            }}
                        >
                            Create lead
                        </button>
                        <button
                            type="button"
                            className="act act--danger"
                            onClick={() => setUnmatchedPromptPhone(null)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            {/* Idle state — line picker + status. Only when no call is live and no failed
                call is being reported (otherwise both panels render at once). */}
            {!hasCall && !callFailure && open && (
                <section className="sp" aria-label="Softphone status">
                    <header className="sp__head">
                        <span className={statusDotClass} />
                        Softphone
                        <span className="sp__signal" data-quality={quality} title={`Connection: ${quality}`}>
                            <i />
                            <i />
                            <i />
                        </span>
                    </header>
                    <div className="sp__idle">
                        {state.lastCallError && (
                            <p className="sp__note sp__note--danger">{state.lastCallError}</p>
                        )}
                        {state.registration === "failed" && (
                            <p className="sp__note sp__note--danger">
                                {state.registrationError ?? "Registration failed."}
                            </p>
                        )}
                        {state.registration === "registering" && (
                            <p className="sp__note">Connecting to sipgate…</p>
                        )}
                        {devices.length === 0 && (
                            <p className="sp__note">
                                No phone lines configured — add one in Settings.
                            </p>
                        )}
                        {devices.length > 0 && (
                            <div className="sp__field">
                                <span>Active line</span>
                                <select
                                    value={activeDeviceId ?? ""}
                                    onChange={(e) =>
                                        setActiveDevice(Number(e.target.value))
                                    }
                                    className="sp__select"
                                >
                                    {devices.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.label}
                                        </option>
                                    ))}
                                </select>
                                {state.registration === "registered" && (
                                    <p className="sp__note sp__note--ok">
                                        Ready — calls are placed from the CRM.
                                    </p>
                                )}
                            </div>
                        )}
                        {state.registration === "unregistered" && (
                            <p className="sp__note">Not registered.</p>
                        )}
                        {!isActiveTab && (
                            <p className="sp__note">
                                Another browser tab is handling calls.
                            </p>
                        )}
                        {lastRecordingUrl ? (
                            <div className="sp__card">
                                <p className="sp__note" style={{ marginBottom: 6 }}>
                                    Latest recording
                                </p>
                                <audio
                                    controls
                                    preload="none"
                                    src={lastRecordingUrl}
                                    style={{ width: "100%" }}
                                />
                            </div>
                        ) : null}
                        {recordingUploading ? (
                            <p className="sp__note">Uploading recording…</p>
                        ) : null}
                        <button
                            type="button"
                            className="sp__close"
                            onClick={() => setPinnedOpen(false)}
                        >
                            Hide
                        </button>
                    </div>
                </section>
            )}

            {/* Inbound ringing */}
            {ringingInbound && activeCall && (
                <section
                    className="sp sp--incoming"
                    aria-label="Softphone, incoming call"
                >
                    <header className="sp__head">
                        <span className={statusDotClass} />
                        Softphone
                        <span
                            className="sp__signal"
                            data-quality={quality}
                            title={`Connection: ${connectionQuality}`}
                        >
                            <i />
                            <i />
                            <i />
                        </span>
                    </header>
                    <div className="sp__body">
                        <CallIdentity
                            name={titleName}
                            peer={activeCall.peer}
                            leadUrl={callLead?.url}
                        >
                            {inboundRoute?.matched && (
                                <span className="sp__lead">
                                    {callRoutingReason === "lead_owner"
                                        ? "Lead owner"
                                        : "Call pool"}
                                </span>
                            )}
                        </CallIdentity>
                        <CallStateBadge stage={activeCall.stage} />
                        <div className="sp__actions">
                            <button
                                type="button"
                                className="act act--danger"
                                onClick={() => void reject()}
                            >
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M10.7 13.3a16 16 0 0 1-2.4-3.1l1.6-1.4a1.5 1.5 0 0 0 .4-1.6L9.6 4.8A1.5 1.5 0 0 0 8.1 4H5.5A1.5 1.5 0 0 0 4 5.6 17 17 0 0 0 18.4 20a1.5 1.5 0 0 0 1.6-1.5v-2.6a1.5 1.5 0 0 0-.8-1.4l-3-1.1a1.5 1.5 0 0 0-1.6.4l-1.4 1.6" />
                                        <path d="M3 3l18 18" />
                                    </svg>
                                </span>
                                Decline
                            </button>
                            <button
                                type="button"
                                className="act act--ok"
                                onClick={() => {
                                    const callId = activeCall.id;
                                    const peer = activeCall.peer;
                                    void answer().then(() =>
                                        logInboundCallStarted(callId, peer),
                                    );
                                }}
                            >
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M5.5 4h2.6a1.5 1.5 0 0 1 1.5.8l1 3a1.5 1.5 0 0 1-.4 1.6l-1.6 1.4a16 16 0 0 0 5.6 5.6l1.4-1.6a1.5 1.5 0 0 1 1.6-.4l3 1.1a1.5 1.5 0 0 1 .8 1.4v2.6A1.5 1.5 0 0 1 18.4 20 17 17 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4z" />
                                    </svg>
                                </span>
                                Answer
                            </button>
                        </div>
                    </div>
                </section>
            )}

            {/* Live / outbound call */}
            {inCall && activeCall && (
                <section
                    className="sp sp--active"
                    aria-label="Softphone, in call"
                >
                    <header className="sp__head">
                        <span className={statusDotClass} />
                        Softphone
                        <span
                            className="sp__signal"
                            data-quality={quality}
                            title={`Connection: ${connectionQuality}`}
                        >
                            <i />
                            <i />
                            <i />
                        </span>
                    </header>
                    <div className="sp__body">
                        <CallIdentity
                            name={titleName}
                            peer={activeCall.peer}
                            leadUrl={callLead?.url}
                        >
                            {/* Only for a lead we MATCHED from the caller's number. On an
                            outbound call the lead came from the entry point
                            that placed it — there was nothing to match, so no
                            pill; the name is still a link to it. */}
                            {matchedLead && titleName !== activeCall.peer && (
                                <span className="sp__lead">Matching lead</span>
                            )}
                        </CallIdentity>
                        <CallStateBadge stage={activeCall.stage} />
                        {/* Only once media actually flows — a running timer over
                            "Calling…" was the confusing part this replaces. */}
                        {activeCall.stage === "connected" && elapsed !== null && (
                            <p className="sp__timer" role="timer">
                                {elapsed}
                            </p>
                        )}
                        {activeCall.stage === "connecting" && state.lastCallError && (
                            <p className="sp__note sp__note--danger">
                                {state.lastCallError}
                            </p>
                        )}
                        <div className="sp__actions">
                            <button
                                type="button"
                                className="act"
                                aria-pressed={activeCall.muted}
                                onClick={() => setMuted(!activeCall.muted)}
                            >
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24">
                                        <rect
                                            x="9"
                                            y="3"
                                            width="6"
                                            height="11"
                                            rx="3"
                                        />
                                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                                    </svg>
                                </span>
                                {activeCall.muted ? "Unmute" : "Mute"}
                            </button>
                            <button
                                type="button"
                                className="act act--danger"
                                onClick={() => {
                                    const direction =
                                        activeCall.direction === "inbound"
                                            ? "inbound"
                                            : "outbound";
                                    const duration = activeCall.answeredAt
                                        ? Math.max(
                                              1,
                                              Math.round(
                                                  (Date.now() - activeCall.answeredAt) / 1000,
                                              ),
                                          )
                                        : 0;
                                    if (
                                        activeCall.phase === "active" &&
                                        callLead
                                    ) {
                                        void axios
                                            .post(
                                                route("telephony.softphone.events.store"),
                                                {
                                                    phone: activeCall.peer,
                                                    entity_type: "lead",
                                                    entity_id: callLead.id,
                                                    event: "call.ended",
                                                    direction,
                                                    status: "completed",
                                                    duration,
                                                    ...(callRef ? { call_ref: callRef } : {}),
                                                },
                                            )
                                            .catch(() => undefined);
                                    }
                                    void hangup();
                                }}
                            >
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24">
                                        <path d="M10.7 13.3a16 16 0 0 1-2.4-3.1l1.6-1.4a1.5 1.5 0 0 0 .4-1.6L9.6 4.8A1.5 1.5 0 0 0 8.1 4H5.5A1.5 1.5 0 0 0 4 5.6 17 17 0 0 0 18.4 20a1.5 1.5 0 0 0 1.6-1.5v-2.6a1.5 1.5 0 0 0-.8-1.4l-3-1.1a1.5 1.5 0 0 0-1.6.4l-1.4 1.6" />
                                        <path d="M3 3l18 18" />
                                    </svg>
                                    <span className="sr-only">End call</span>
                                </span>
                                End
                            </button>
                        </div>
                    </div>
                </section>
            )}

        </>
    );
}