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
    SoftphoneCallPhase,
    SoftphoneCallStage,
    SoftphoneDeviceSummary,
    SoftphoneRegistrationState,
} from "@/Types/api/softphone";

/** How often to re-check the caller's number and rotation state while ringing. */
const LEAD_MATCH_POLL_MS = 3000;

type MatchedLead = {
    id: number;
    name: string;
    url: string;
};

type RotationUser = {
    id: number;
    name: string;
    role: "owner" | "pool";
    priority?: number;
};

type CallRouting = {
    matched: boolean;
    match_count?: number;
    lead_id: number | null;
    owner_id: number | null;
    owner_name?: string | null;
    name: string | null;
    url: string | null;
    route: "owner" | "pool" | "all" | null;
    can_ring: boolean;
    pool_user_ids: number[];
    rotation_users?: RotationUser[];
    passed_user_ids?: number[];
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
    const source = name?.trim() ? name.trim() : (fallback ?? "");
    return (
        source
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
    const hasLink = Boolean(leadUrl && name.trim());
    return (
        <>
            <div className="sp__avatar" aria-hidden="true">
                {initialsOf(name, peer)}
            </div>
            <h2 className="sp__name">
                {hasLink && leadUrl ? (
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

/** Why a call never connected. Stays on screen until the agent closes it (or the company fallback duration passes) */
function CallFailedNotice({
    failure,
    devices,
    activeDeviceId,
    onSelectDevice,
    onRetry,
    onClose,
}: {
    failure: SoftphoneCallFailure;
    devices: SoftphoneDeviceSummary[];
    activeDeviceId: number | null;
    onSelectDevice: (deviceId: number) => void;
    onRetry: () => void;
    onClose: () => void;
}) {
    const activeLabel = devices.find((d) => d.id === activeDeviceId)?.label;
    return (
        <section className="sp sp--failed" role="alertdialog" aria-label="Call failed">
            <header className="sp__head">
                <span className="sp__dot sp__dot--failed" />
                {activeLabel ? `Phone · ${activeLabel}` : "Phone"}
            </header>
            <div className="sp__body">
                <div className="sp__avatar sp__avatar--failed" aria-hidden="true">
                    <PhoneOff size={30} strokeWidth={1.7} />
                </div>
                <h2 className="sp__name">Call failed</h2>
                {/* Who it was about, not just the digits — otherwise a failed call is just "a number" with no owner. */}
                <p className="sp__number">
                    {failure.direction === "outbound" ? "To" : "From"} {" "}{failure.context?.leadName || failure.peer}
                </p>
                {failure.context?.leadName && (
                    <p className="sp__number sp__number--peer">{failure.peer}</p>
                )}
                <p className="sp__reason">{failure.reason}</p>

                {devices.length > 1 && (
                    <div className="sp__field" style={{ width: "100%", marginTop: 8 }}>
                        <span>Active line</span>
                        <select
                            value={activeDeviceId ?? ""}
                            onChange={(e) => onSelectDevice(Number(e.target.value))}
                            className="sp__select"
                        >
                            {devices.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    </div>
                )}

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
    const isAdmin = (props.auth?.user?.roles ?? []).some(
        (role: { name?: string }) => role?.name === "admin",
    );
    const canRecord =
        isAdmin ||
        ["all", "added"].includes(
            props.auth?.permissions?.make_softphone_calls as string,
        );
    const {
        isEnabled,
        state,
        devices,
        activeDevice,
        activeDeviceId,
        setActiveDevice,
        attachRemoteAudio,
        call,
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
    // Stable ref callback: an inline arrow would be re-run on every render, detaching/reattaching the audio element (and resetting playback).
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
    const [matchCount, setMatchCount] = useState<number | null>(null);
    const [inboundRoute, setInboundRoute] = useState<CallRouting | null>(null);
    const [routingMode, setRoutingMode] = useState<"owner" | "pool" | "all">("all");
    const [rotationIndex, setRotationIndex] = useState(0);
    const [passedCallId, setPassedCallId] = useState<string | null>(null);
    const [unmatchedPromptPhone, setUnmatchedPromptPhone] = useState<string | null>(null);
    const [lastInboundPhone, setLastInboundPhone] = useState<string | null>(null);
    const fallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const routeInitializedCallIdRef = useRef<string | null>(null);
    // Guards against double-logging when Answer is clicked in the dock while the island alert for the same call is also on screen.
    const inboundLoggedRef = useRef<string | null>(null);

    const currentUserId = Number(
        props.auth?.user?.id ?? inboundRoute?.current_user_id ?? -1,
    );

    /** Ordered rotation sequence of active users (lead owner first if present, then pool agents by priority). */
    const rotationUsers = useMemo<RotationUser[]>(() => {
        if (!inboundRoute) return [];
        if (Array.isArray(inboundRoute.rotation_users)) {
            return inboundRoute.rotation_users;
        }
        const list: RotationUser[] = [];
        if (inboundRoute.owner_id != null) {
            list.push({
                id: Number(inboundRoute.owner_id),
                name: inboundRoute.owner_name || `User #${inboundRoute.owner_id}`,
                role: "owner",
            });
        }
        for (const uid of inboundRoute.pool_user_ids ?? []) {
            if (Number(uid) !== Number(inboundRoute.owner_id ?? -1)) {
                list.push({
                    id: Number(uid),
                    name: `User #${uid}`,
                    role: "pool",
                });
            }
        }
        return list;
    }, [inboundRoute]);

    const passedUserIds = inboundRoute?.passed_user_ids ?? [];

    /** True only when the call has actually rotated past at least one earlier user in the sequence. */
    const isForwarded =
        activeCall?.direction === "inbound" &&
        rotationIndex > 0 &&
        rotationUsers.length > 0;

    /** The user who most recently had the call before it was forwarded. Null when not forwarded. */
    const lastForwardedUser = useMemo<RotationUser | null>(() => {
        if (!isForwarded || rotationUsers.length === 0) {
            return null;
        }
        const lastIdx = Math.min(rotationIndex - 1, rotationUsers.length - 1);
        return rotationUsers[lastIdx] ?? null;
    }, [isForwarded, rotationIndex, rotationUsers]);

    const currentRotationTarget =
        rotationIndex < rotationUsers.length
            ? rotationUsers[rotationIndex]
            : null;

    const elapsed = useElapsed(
        activeCall?.connectedAt ?? activeCall?.answeredAt ?? null,
    );

    /** The lead this call is about: matched from the number or supplied by the caller's entry point. */
    const callLead = useMemo<MatchedLead | null>(() => {
        if (matchedLead) {
            return matchedLead;
        }
        const context = activeCall?.context;
        if (context?.leadId) {
            return {
                id: context.leadId,
                name: context.leadName ?? "",
                url: route("lead-contact.show", context.leadId),
            };
        }
        return null;
    }, [activeCall?.context, matchedLead]);

    /** Stable reference for the current call. Shared by the hang-up timeline event and the recording upload so the two can be linked afterwards. */
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

    /** Why this call reached this agent. Shown in the ringing popup and stored on the recording so the audio can be traced back to its cause. */
    const callRoutingReason = useMemo(() => {
        if (activeCall?.direction !== "inbound") {
            return "outbound";
        }
        if (!inboundRoute?.matched) {
            return "unmatched";
        }
        if (routingMode === "owner" && !isForwarded) {
            return "lead_owner";
        }
        return "pool_fallback";
    }, [activeCall?.direction, inboundRoute?.matched, routingMode, isForwarded]);

    const forwardedInfoRef = useRef<{
        isForwarded: boolean;
        lastForwardedUser: RotationUser | null;
        callRoutingReason: string;
    }>({
        isForwarded: false,
        lastForwardedUser: null,
        callRoutingReason: "outbound",
    });
    useEffect(() => {
        forwardedInfoRef.current = {
            isForwarded,
            lastForwardedUser,
            callRoutingReason,
        };
    }, [isForwarded, lastForwardedUser, callRoutingReason]);

    const hasPassedCurrentCall =
        (activeCall !== null && passedCallId === activeCall.id) ||
        passedUserIds.includes(currentUserId);

    // Owner-first / step-by-step rotation: while a specific user in rotationUsers is active, only that user rings (plus admins once the call has been forwarded). Once all individual rotation steps have timed out, all eligible pool agents and admins ring.
    const isCurrentRotationSession =
        inboundRoute === null ||
        rotationUsers.length === 0 ||
        (currentRotationTarget !== null
            ? Number(currentRotationTarget.id) === currentUserId
            : true);

    const isEligibleSession =
        inboundRoute === null ||
        (currentRotationTarget !== null &&
            Number(currentRotationTarget.id) === currentUserId) ||
        inboundRoute.can_ring ||
        isAdmin;

    const ringingInbound =
        activeCall?.phase === "inbound" &&
        !hasPassedCurrentCall &&
        isCurrentRotationSession &&
        isEligibleSession;

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

    // Ring/state sounds come from real MP3s in public/audio/softphone rather than a synthesised oscillator tone.
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

    const isOutboundRinging =
        activeCall !== null &&
        (activeCall.phase === "outbound" ||
            activeCall.stage === "calling" ||
            activeCall.stage === "ringing");
    const isRinging =
        activeCall?.phase === "inbound"
            ? ringingInbound
            : isOutboundRinging;

    // Drive the sounds from the call state. Only the owning tab should ring, and for inbound calls only when this user's session is currently ringing.
    useEffect(() => {
        if (!isActiveTab || !isRinging) {
            stopRinging();
            if (!isActiveTab) {
                stopAll();
            }
            return;
        }

        if (activeCall?.phase === "inbound") {
            playIncoming();
        }
        startRinging();

        return () => stopRinging();
    }, [activeCall?.id, activeCall?.phase === "inbound", isRinging, isActiveTab, playIncoming, startRinging, stopRinging, stopAll]);

    // One-shot "call finished" cue when a live call drops.
    const wasInCallRef = useRef(false);
    useEffect(() => {
        const isConnected =
            activeCall !== null &&
            (activeCall.phase === "active" ||
                activeCall.stage === "connecting" ||
                activeCall.stage === "connected");

        if (isRinging) {
            wasInCallRef.current = true;
            return;
        }

        if (isConnected) {
            wasInCallRef.current = true;
            stopRinging();
            return;
        }

        if (wasInCallRef.current) {
            wasInCallRef.current = false;
            stopAll();
            playEnded();
        }
    }, [activeCall, isRinging, stopRinging, stopAll, playEnded]);

    // Lead matching by phone number. When a single lead matches the peer's number we display its name and link; when zero or multiple leads match we report the number of matches instead of rendering a blank title.
    const matchedLeadRef = useRef<MatchedLead | null>(null);
    useEffect(() => {
        matchedLeadRef.current = matchedLead;
    }, [matchedLead]);

    const callPhaseRef = useRef<SoftphoneCallPhase | null>(null);
    callPhaseRef.current = activeCall?.phase ?? null;

    useEffect(() => {
        const call = activeCall;
        if (call === null) {
            matchedLeadRef.current = null;
            routeInitializedCallIdRef.current = null;
            setMatchedLead(null);
            setMatchCount(null);
            setInboundRoute(null);
            setRoutingMode("all");
            setRotationIndex(0);
            setPassedCallId(null);
            return;
        }

        const phone = call.peer;
        if (!phone) {
            return;
        }
        if (call.direction === "inbound") {
            setLastInboundPhone(phone);
            if (routeInitializedCallIdRef.current !== call.id) {
                routeInitializedCallIdRef.current = call.id;
                setRotationIndex(0);
                setPassedCallId(null);
            }
        }

        let cancelled = false;
        const lookup = async () => {
            try {
                const response = await axios.get(route("telephony.softphone.lead-match"), {
                    params: { phone, device_id: activeDeviceId, call_id: call.id },
                });
                if (cancelled) return;
                const data = response.data?.data as CallRouting | null;
                const count =
                    typeof data?.match_count === "number"
                        ? data.match_count
                        : data?.matched
                          ? 1
                          : 0;
                setMatchCount(count);
                if (call.direction === "inbound") {
                    // Routing only applies to inbound calls.
                    setInboundRoute((prev) => {
                        if (prev === null) {
                            setRoutingMode(data?.route === "owner" ? "owner" : "all");
                        }
                        return data;
                    });
                }
                const lead = data?.matched && data.lead_id ? {
                    id: data.lead_id,
                    name: data.name || `Lead #${data.lead_id}`,
                    url: data.url ?? "",
                } : null;
                matchedLeadRef.current = lead;
                setMatchedLead(lead);
                if (lead) {
                    // Tell the client who this call is about: it copies this onto the call (and onto a failure notice if the call dies).
                    softphone.setCallContext({ leadId: lead.id, leadName: lead.name });
                }
            } catch {
                if (!cancelled) {
                    setMatchedLead(null);
                    setMatchCount(0);
                    if (call.direction === "inbound") {
                        setInboundRoute(null);
                        setRoutingMode("all");
                    }
                }
            }
        };

        void lookup();
        const poll = window.setInterval(() => {
            const isInboundRinging = call.direction === "inbound" && callPhaseRef.current === "inbound";
            const isUnresolvedOutbound =
                call.direction !== "inbound" &&
                callPhaseRef.current === "outbound" &&
                !matchedLeadRef.current;
            if (isInboundRinging || isUnresolvedOutbound) {
                void lookup();
            }
        }, LEAD_MATCH_POLL_MS);

        return () => {
            cancelled = true;
            window.clearInterval(poll);
        };
        // Keyed on the call id only: the phase changes as the call progresses, and re-running then would wipe a match we already have.
    }, [activeCall?.id, activeDeviceId]);

    // Advance rotationIndex immediately past any users who explicitly declined/passed this call.
    useEffect(() => {
        if (rotationUsers.length === 0 || passedUserIds.length === 0) return;
        setRotationIndex((prev) => {
            let next = prev;
            while (
                next < rotationUsers.length &&
                passedUserIds.includes(Number(rotationUsers[next].id))
            ) {
                next += 1;
            }
            return next;
        });
    }, [rotationUsers, passedUserIds]);

    // Step through rotationUsers one active user at a time using fallback_seconds.
    // Keyed on stable primitives (not the inboundRoute / rotationUsers objects) so a lead-match poll that returns equivalent data does not restart the timeout.
    const hasInboundRoute = inboundRoute !== null;
    const routeFallbackSeconds = inboundRoute?.fallback_seconds ?? null;
    const rotationUsersKey = rotationUsers
        .map((u) => `${u.id}:${u.role ?? ""}`)
        .join("|");
    useEffect(() => {
        if (!activeCall || activeCall.phase !== "inbound" || !hasInboundRoute) return;

        if (rotationIndex >= rotationUsers.length) {
            setRoutingMode("pool");
            return;
        }

        const currentTarget = rotationUsers[rotationIndex];
        setRoutingMode(currentTarget?.role === "owner" ? "owner" : "pool");

        fallbackRef.current = setTimeout(() => {
            setRotationIndex((prev) => Math.min(rotationUsers.length, prev + 1));
        }, Math.max(1, routeFallbackSeconds ?? 20) * 1000);

        return () => {
            if (fallbackRef.current) {
                clearTimeout(fallbackRef.current);
                fallbackRef.current = null;
            }
        };
    }, [
        activeCall?.id,
        activeCall?.phase,
        hasInboundRoute,
        rotationIndex,
        rotationUsersKey,
        routeFallbackSeconds,
    ]);

    const handleDeclineInbound = useCallback(async () => {
        if (!activeCall) return;

        const hasRemainingRotation =
            rotationUsers.some(
                (u, idx) =>
                    idx > rotationIndex &&
                    Number(u.id) !== currentUserId &&
                    !passedUserIds.includes(Number(u.id)),
            ) || !isAdmin;

        if (hasRemainingRotation && activeCall.peer) {
            setPassedCallId(activeCall.id);
            stopRinging();
            try {
                await axios.post(route("telephony.softphone.pass"), {
                    phone: activeCall.peer,
                    device_id: activeDeviceId,
                    call_id: activeCall.id,
                    ...(callRef ? { call_ref: callRef } : {}),
                });
                const res = await axios.get(route("telephony.softphone.lead-match"), {
                    params: {
                        phone: activeCall.peer,
                        device_id: activeDeviceId,
                        call_id: activeCall.id,
                    },
                });
                const updated = res.data?.data as CallRouting | null;
                if (updated) {
                    setInboundRoute(updated);
                }
            } catch {
                // Local pass already hid the call on this browser.
            }
            return;
        }

        await reject();
    }, [
        activeCall,
        rotationUsers,
        rotationIndex,
        currentUserId,
        passedUserIds,
        isAdmin,
        stopRinging,
        activeDeviceId,
        reject,
    ]);

    /** One-shot "call finished" cue when a live call drops. Shared by the dock Answer button and the notification island Answer action, and keyed on the call id so one answered call can only ever log once. */
    const logInboundCallStarted = useCallback(
        async (callId: string, peer: string | null) => {
            if (!peer) {
                return;
            }
            if (inboundLoggedRef.current === callId) {
                return;
            }
            inboundLoggedRef.current = callId;
            const fwd = forwardedInfoRef.current;
            await axios
                .post(route("telephony.softphone.events.store"), {
                    phone: peer,
                    device_id: activeDeviceId,
                    call_id: callId,
                    // Only sent when this agent may see the lead; otherwise the
                    // server matches the number itself, so the call still lands
                    // on the lead (or in the Calls page as unlinked).
                    ...(inboundRoute?.matched && inboundRoute.lead_id
                        ? { entity_type: "lead", entity_id: inboundRoute.lead_id }
                        : {}),
                    event: "call.started",
                    direction: "inbound",
                    routing_reason: fwd.callRoutingReason,
                    ...(callRef ? { call_ref: callRef } : {}),
                    ...(fwd.isForwarded && fwd.lastForwardedUser
                        ? {
                              is_forwarded: true,
                              forwarded_from_user_id: fwd.lastForwardedUser.id,
                              forwarded_from_user_name: fwd.lastForwardedUser.name,
                          }
                        : {}),
                })
                .catch(() => {
                    // Timeline logging is best-effort only.
                    inboundLoggedRef.current = null;
                });
        },
        [inboundRoute, activeDeviceId, callRef],
    );

    /**
     * Log "call ended" whenever a connected call ends, whoever hangs up. It
     * used to be logged only from the dock's End button, so a call the other
     * side ended left no ended row and its recording never reached the lead.
     * Keyed on the call id so one call logs once.
     */
    const connectedCallRef = useRef<{
        id: string;
        peer: string | null;
        direction: "inbound" | "outbound";
        answeredAt: number | null;
        callRef: string | null;
        leadId: number | null;
        deviceId: number | null;
        /** Snapshot while live: the routing/forwarding refs reset when the call ends. */
        fwd: {
            isForwarded: boolean;
            lastForwardedUser: RotationUser | null;
            callRoutingReason: string;
        };
    } | null>(null);
    const endedLoggedRef = useRef<string | null>(null);
    useEffect(() => {
        // Every open tab mounts the dock and passive tabs mirror the owner's
        // call; only the tab that owns the call logs it, or each extra tab
        // would add a duplicate "ended" row.
        if (!isActiveTab) {
            connectedCallRef.current = null;
            return;
        }
        if (activeCall && activeCall.phase === "active") {
            connectedCallRef.current = {
                id: activeCall.id,
                peer: activeCall.peer ?? null,
                direction: activeCall.direction === "inbound" ? "inbound" : "outbound",
                answeredAt: activeCall.answeredAt ?? null,
                callRef,
                leadId: callLead?.id ?? null,
                deviceId: activeDeviceId ?? null,
                fwd: { ...forwardedInfoRef.current },
            };
            return;
        }
        const ended = connectedCallRef.current;
        if (!ended || (activeCall && activeCall.id === ended.id && activeCall.phase === "active")) {
            return;
        }
        connectedCallRef.current = null;
        if (endedLoggedRef.current === ended.id || !ended.peer) {
            return;
        }
        endedLoggedRef.current = ended.id;
        const fwd = ended.fwd;
        const duration = ended.answeredAt
            ? Math.max(1, Math.round((Date.now() - ended.answeredAt) / 1000))
            : 0;
        void axios
            .post(route("telephony.softphone.events.store"), {
                phone: ended.peer,
                device_id: ended.deviceId,
                // Without a lead the server matches inbound numbers itself.
                ...(ended.leadId ? { entity_type: "lead", entity_id: ended.leadId } : {}),
                event: "call.ended",
                direction: ended.direction,
                status: "completed",
                duration,
                routing_reason: fwd.callRoutingReason,
                ...(ended.callRef ? { call_ref: ended.callRef } : {}),
                ...(fwd.isForwarded && fwd.lastForwardedUser
                    ? {
                          is_forwarded: true,
                          forwarded_from_user_id: fwd.lastForwardedUser.id,
                          forwarded_from_user_name: fwd.lastForwardedUser.name,
                      }
                    : {}),
            })
            .catch(() => {
                // Timeline logging is best-effort only.
            });
    }, [
        activeCall?.id,
        activeCall?.phase,
        callRef,
        callLead?.id,
        activeDeviceId,
        isActiveTab,
        isForwarded,
        lastForwardedUser,
        callRoutingReason,
    ]);

    // Incoming calls are surfaced in the softphone dock only. The dock auto-opens while a call is ringing or live and owns Answer/Decline/Hang up.

    useEffect(() => {
        if (
            activeCall === null &&
            inboundRoute &&
            !inboundRoute.matched &&
            (inboundRoute.match_count ?? 0) === 0
        ) {
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
            const remoteStream = audioEl?.srcObject instanceof MediaStream ? audioEl.srcObject : null;
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

            // MediaRecorder cannot encode MP3 — it only emits Opus/WebM (or MP4/AAC on Safari). Pick the best *audio-only* type so we never end up with a video/webm container, and let the server transcode to MP3 on upload.
            const AUDIO_MIME_CANDIDATES = [
                "audio/webm;codecs=opus",
                "audio/ogg;codecs=opus",
                "audio/webm",
                "audio/ogg",
                "audio/mp4",
            ];
            const mimeType = AUDIO_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));

            const recorder = new MediaRecorder(
                destination.stream,
                mimeType ? { mimeType, audioBitsPerSecond: 48000 } : { audioBitsPerSecond: 48000 },
            );
            recordChunksRef.current = [];
            recorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    recordChunksRef.current.push(event.data);
                }
            };
            recorder.onstop = async () => {
                const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
                recordChunksRef.current = [];
                const duration = recordStartedAtRef.current ? Math.max(1, Math.round((Date.now() - recordStartedAtRef.current) / 1000)) : 1;
                recordStartedAtRef.current = null;
                setRecordingUploading(true);
                try {
                    const form = new FormData();
                    // Upload with a container-appropriate extension; the server transcodes to MP3 before storing.
                    const fallback = recorder.mimeType || mimeType || "";
                    const extension = fallback.includes("mp4")
                        ? "m4a"
                        : fallback.includes("ogg")
                            ? "ogg"
                            : "webm";
                    form.append("recording", blob, `call-${Date.now()}.${extension}`);
                    form.append("duration", String(duration));
                    // Which channel/line this recording was captured on, so the recordings view can group by line.
                    form.append("device_id", String(activeDeviceId ?? ""));
                    // Why this call reached this agent: the matched lead (or the fact it was unmatched) and the routing decision.
                    if (callLead) {
                        form.append("entity_type", "lead");
                        form.append("entity_id", String(callLead.id));
                    }
                    if (callLead?.name) {
                        form.append("lead_name", callLead.name);
                    }
                    form.append("phone_number", activeCall?.peer ?? lastInboundPhone ?? "");
                    form.append("direction", activeCall?.direction === "inbound" ? "inbound" : "outbound");
                    const fwd = forwardedInfoRef.current;
                    form.append("routing_reason", fwd.callRoutingReason);
                    if (fwd.isForwarded && fwd.lastForwardedUser) {
                        form.append("is_forwarded", "1");
                        form.append("forwarded_from_user_id", String(fwd.lastForwardedUser.id));
                        form.append("forwarded_from_user_name", fwd.lastForwardedUser.name);
                    }
                    if (callRef) {
                        form.append("call_ref", callRef);
                    }
                    const response = await axios.post(route("call-recordings.store"), form, {
                        headers: {
                            "X-CSRF-TOKEN": document.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "",
                        },
                    });
                    const playUrl = response.data?.data?.play_url || response.data?.play_url;
                    if (playUrl) {
                        setLastRecordingUrl(playUrl);
                    }
                    void loadRecordings();
                } catch {
                    console.warn("[softphone] Recording upload failed");
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

    // Auto-open while a call rings or is live; collapse once it ends. A FAILED call keeps the dock open with the reason — closing silently left agents thinking the app had hung. It self-dismisses after company fallback seconds so it cannot sit on screen forever.
    const callFailure = state.callFailure;
    const open = pinnedOpen || hasCall || callFailure !== null;
    const failureNoticeMs =
        Math.max(
            1,
            Number(
                (props.company as { incoming_call_fallback_seconds?: number } | null | undefined)
                    ?.incoming_call_fallback_seconds ?? 30,
            ),
        ) * 1000;

    useEffect(() => {
        if (!callFailure) {
            return;
        }
        const timer = window.setTimeout(() => clearCallFailure(), failureNoticeMs);
        return () => window.clearTimeout(timer);
    }, [callFailure, clearCallFailure, failureNoticeMs]);

    // Every outbound attempt that never connected (busy, declined, no answer,
    // not registered, ...) goes on the lead's timeline. The failure object is
    // replaced per attempt, so keying on identity logs each one exactly once.
    const loggedFailureRef = useRef<typeof callFailure>(null);
    useEffect(() => {
        if (
            !callFailure ||
            callFailure.direction !== "outbound" ||
            loggedFailureRef.current === callFailure
        ) {
            return;
        }
        loggedFailureRef.current = callFailure;
        const leadId = callFailure.context?.leadId;
        if (!leadId) {
            return;
        }
        const event =
            callFailure.code === "busy"
                ? { event: "call.busy", status: "busy" }
                : callFailure.code === "declined"
                  ? { event: "call.declined", status: "declined" }
                  : callFailure.code === "no-answer"
                    ? { event: "call.missed", status: "missed" }
                    : { event: "call.failed", status: "failed" };
        void axios
            .post(route("telephony.softphone.events.store"), {
                phone: callFailure.peer,
                entity_type: "lead",
                entity_id: leadId,
                direction: "outbound",
                failure_reason: callFailure.code,
                failure_message: callFailure.reason.slice(0, 255),
                ...event,
            })
            .catch(() => {
                // Timeline logging is best-effort only.
            });
    }, [callFailure]);

    const retryFailedCall = () => {
        const failure = callFailure;
        clearCallFailure();
        if (failure?.peer) {
            void call(
                failure.peer,
                failure.context,
                activeDeviceId ?? undefined,
            );
        }
    };

    if (!isEnabled) {
        return null;
    }

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

    // When a single lead is matched, show its name and link. When number matching cannot find a single lead (0 or 2+ matches), tell the user how many matches were found instead of leaving the name blank.
    const contextLeadName = activeCall?.context?.leadName?.trim() || "";
    const isOutbound = activeCall?.direction !== "inbound";
    const hasContextLead = Boolean(contextLeadName && activeCall?.context?.leadId);
    const matchSummaryLabel =
        !hasContextLead && matchCount !== null && matchCount !== 1
            ? `There ${matchCount === 1 ? "is 1 match" : `are ${matchCount} matches`}`
            : null;
    const titleName = matchedLead?.name
        ? matchedLead.name
        : isOutbound && hasContextLead
          ? contextLeadName
          : !hasContextLead && matchCount !== null && matchCount !== 1
            ? `${matchCount} ${matchCount === 1 ? "match" : "matches"}`
            : contextLeadName || (activeCall?.peer ?? "");
    const displayLeadUrl = matchedLead?.url
        ? matchedLead.url
        : isOutbound && hasContextLead && activeCall?.context?.leadId
          ? route("lead-contact.show", activeCall.context.leadId)
          : matchCount === null && contextLeadName && activeCall?.context?.leadId
            ? route("lead-contact.show", activeCall.context.leadId)
            : null;

    const headerTitle = activeDevice
        ? `Phone · ${activeDevice.label}`
        : "Phone";

    // No floating FAB is shipped — the dock opens on its own when a call arrives, and stays pinned in development for testing.

    return (
        <>
            <audio ref={remoteAudioCallback} className="hidden" />

            {/* Failed call — the reason sticks around until closed. */}
            {callFailure && !hasCall && (
                <CallFailedNotice
                    failure={callFailure}
                    devices={devices}
                    activeDeviceId={activeDeviceId}
                    onSelectDevice={setActiveDevice}
                    onRetry={retryFailedCall}
                    onClose={clearCallFailure}
                />
            )}

            {/* Inbound call was not matched to a lead — prompt to create one. */}
            {unmatchedPromptPhone && (
                <div className="sp__unmatched-notice">
                    <p>This call was not matched to an existing lead. Would you like to create a new lead from this call?</p>
                    <div className="sp__unmatched-actions">
                        <button type="button" className="act act--ok" onClick={() => {
                            window.location.href = route("lead.create", { phone_number: unmatchedPromptPhone });
                        }}>
                            Create lead
                        </button>
                        <button type="button" className="act act--danger" onClick={() => setUnmatchedPromptPhone(null)}>Close</button>
                    </div>
                </div>
            )}

            {/* Idle state — line picker + status. Only when no call is live and no failed call is being reported (otherwise both panels render at once). */}
            {!hasCall && !callFailure && open && (
                <section className="sp" aria-label="Phone status">
                    <header className="sp__head">
                        <span className={statusDotClass} />
                        {headerTitle}
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
                            <p className="sp__note">No phone lines configured — add one in Settings.</p>
                        )}
                        {devices.length > 0 && (
                            <div className="sp__field">
                                <span>Active line</span>
                                <select
                                    value={activeDeviceId ?? ""}
                                    onChange={(e) => setActiveDevice(Number(e.target.value))}
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
                            <p className="sp__note">Another browser tab is handling calls.</p>
                        )}
                        {lastRecordingUrl ? (
                            <div className="sp__card">
                                <p className="sp__note" style={{ marginBottom: 6 }}>Latest recording</p>
                                <audio controls preload="none" src={lastRecordingUrl} style={{ width: "100%" }} />
                            </div>
                        ) : null}
                        {recordingUploading ? (
                            <p className="sp__note">Uploading recording…</p>
                        ) : null}
                        <button type="button" className="sp__close" onClick={() => setPinnedOpen(false)}>
                            Hide
                        </button>
                    </div>
                </section>
            )}

            {/* Inbound ringing */}
            {ringingInbound && activeCall && (
                <section className="sp sp--incoming" aria-label="Phone, incoming call">
                    <header className="sp__head">
                        <span className={statusDotClass} />
                        {headerTitle}
                        <span className="sp__signal" data-quality={quality} title={`Connection: ${connectionQuality}`}>
                            <i />
                            <i />
                            <i />
                        </span>
                    </header>
                    <div className="sp__body">
                        <CallIdentity name={titleName} peer={activeCall.peer} leadUrl={displayLeadUrl}>
                            {isAdmin && isForwarded && lastForwardedUser ? (
                                <span className="sp__lead" data-forwarded="true">
                                    Forwarded · Last user: {lastForwardedUser.name}
                                </span>
                            ) : inboundRoute?.matched ? (
                                <span className="sp__lead">
                                    {callRoutingReason === "lead_owner" ? "Lead owner" : "Call pool"}
                                </span>
                            ) : matchSummaryLabel ? (
                                <span className="sp__lead">{matchSummaryLabel}</span>
                            ) : null}
                        </CallIdentity>
                        <CallStateBadge stage={activeCall.stage} />
                        <div className="sp__actions">
                            <button type="button" className="act act--danger" onClick={() => void handleDeclineInbound()}>
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24" style={{ transform: "rotate(135deg)" }}>
                                        <path d="M5.5 4h2.6a1.5 1.5 0 0 1 1.5.8l1 3a1.5 1.5 0 0 1-.4 1.6l-1.6 1.4a16 16 0 0 0 5.6 5.6l1.4-1.6a1.5 1.5 0 0 1 1.6-.4l3 1.1a1.5 1.5 0 0 1 .8 1.4v2.6A1.5 1.5 0 0 1 18.4 20 17 17 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4z" />
                                    </svg>
                                </span>
                                Decline
                            </button>
                            <button type="button" className="act act--ok" onClick={() => {
                                const callId = activeCall.id;
                                const peer = activeCall.peer;
                                void answer().then(() => logInboundCallStarted(callId, peer));
                            }}>
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
                <section className="sp sp--active" aria-label="Phone, in call">
                    <header className="sp__head">
                        <span className={statusDotClass} />
                        {headerTitle}
                        <span className="sp__signal" data-quality={quality} title={`Connection: ${connectionQuality}`}>
                            <i />
                            <i />
                            <i />
                        </span>
                    </header>
                    <div className="sp__body">
                        <CallIdentity name={titleName} peer={activeCall.peer} leadUrl={displayLeadUrl}>
                            {isAdmin && isForwarded && lastForwardedUser ? (
                                <span className="sp__lead" data-forwarded="true">
                                    Forwarded · Last user: {lastForwardedUser.name}
                                </span>
                            ) : matchedLead ? (
                                <span className="sp__lead">Matching lead</span>
                            ) : matchSummaryLabel ? (
                                <span className="sp__lead">{matchSummaryLabel}</span>
                            ) : null}
                        </CallIdentity>
                        <CallStateBadge stage={activeCall.stage} />
                        {/* Only once media actually flows — a running timer over "Calling…" was the confusing part this replaces. */}
                        {activeCall.stage === "connected" && elapsed !== null && (
                            <p className="sp__timer" role="timer">{elapsed}</p>
                        )}
                        {activeCall.stage === "connecting" && state.lastCallError && (
                            <p className="sp__note sp__note--danger">{state.lastCallError}</p>
                        )}
                        <div className="sp__actions">
                            <button type="button" className="act" aria-pressed={activeCall.muted} onClick={() => setMuted(!activeCall.muted)}>
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24">
                                        <rect x="9" y="3" width="6" height="11" rx="3" />
                                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
                                        {!activeCall.muted && <path d="M3 3l18 18" />}
                                    </svg>
                                </span>
                                {activeCall.muted ? "Unmute" : "Mute"}
                            </button>
                            <button type="button" className="act act--danger" onClick={() => {
                                // "call ended" is logged by the effect that watches the
                                // call end, so a hang-up from the other side logs too.
                                void hangup();
                            }}>
                                <span className="act__btn">
                                    <svg viewBox="0 0 24 24" style={{ transform: "rotate(135deg)" }}>
                                        <path d="M5.5 4h2.6a1.5 1.5 0 0 1 1.5.8l1 3a1.5 1.5 0 0 1-.4 1.6l-1.6 1.4a16 16 0 0 0 5.6 5.6l1.4-1.6a1.5 1.5 0 0 1 1.6-.4l3 1.1a1.5 1.5 0 0 1 .8 1.4v2.6A1.5 1.5 0 0 1 18.4 20 17 17 0 0 1 4 5.6 1.5 1.5 0 0 1 5.5 4z" />
                                    </svg>
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
