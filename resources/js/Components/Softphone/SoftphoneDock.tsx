import { useEffect, useMemo, useState } from "react";
import {
    Mic,
    MicOff,
    Pause,
    Phone,
    PhoneOff,
    Play,
} from "lucide-react";
import useSoftphone from "@/Hooks/useSoftphone";
import type { SoftphoneRegistrationState } from "@/Types/api/softphone";

const STATUS_DOT: Record<SoftphoneRegistrationState, string> = {
    idle: "bg-slate-300",
    registering: "bg-amber-400 animate-pulse",
    registered: "bg-emerald-500",
    unregistered: "bg-amber-400",
    failed: "bg-red-500",
};

function formatDuration(ms: number): string {
    const total = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Ticks once a second while a call is active; null otherwise. */
function useElapsed(answeredAt: number | null): string | null {
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        if (answeredAt === null) {
            return;
        }
        const id = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(id);
    }, [answeredAt]);

    return useMemo(() => {
        if (answeredAt === null) {
            return null;
        }
        return formatDuration(now - answeredAt);
    }, [answeredAt, now]);
}

/**
 * Call-control widget for the in-browser softphone (sipgate Neo via SIP.js).
 * No dialer — calls are originated by click-to-call elsewhere; this surface
 * auto-opens while a call is ringing/active and shows answer/decline or
 * mute/hold/hangup. Audio is browser ↔ sipgate; the CRM timeline is driven
 * by the OL call-bridge poll and is unaffected here.
 */
export default function SoftphoneDock() {
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
    } = useSoftphone();

    const [pinnedOpen, setPinnedOpen] = useState(false);
    const activeCall = state.call;
    const elapsed = useElapsed(activeCall?.answeredAt ?? null);

    const hasCall = activeCall !== null;
    // Auto-open while a call rings or is live; collapse once it ends.
    const open = pinnedOpen || hasCall;

    if (!isEnabled) {
        return null;
    }

    const ringingInbound = activeCall?.phase === "inbound";
    const inCall = activeCall !== null && !ringingInbound;

    return (
        <>
            {/* Remote audio — always mounted while the dock is present. */}
            <audio ref={attachRemoteAudio} className="hidden" />

            {!open && (
                <button
                    type="button"
                    onClick={() => setPinnedOpen(true)}
                    aria-label="Show softphone status"
                    className="fixed bottom-5 right-5 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg transition hover:bg-slate-800"
                >
                    <Phone size={18} />
                    <span
                        className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-slate-900 ${STATUS_DOT[state.registration]}`}
                    />
                </button>
            )}

            {open && (
                <div className="fixed bottom-5 right-5 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-center gap-2">
                            <span
                                className={`h-2 w-2 rounded-full ${STATUS_DOT[state.registration]}`}
                            />
                            <span className="text-sm font-medium text-slate-700">
                                Softphone
                            </span>
                        </div>
                        {!hasCall && (
                            <button
                                type="button"
                                onClick={() => setPinnedOpen(false)}
                                aria-label="Hide softphone"
                                className="rounded px-1.5 text-xs text-slate-400 hover:bg-slate-200 hover:text-slate-600"
                            >
                                Hide
                            </button>
                        )}
                    </div>

                    <div className="p-3">
                        {state.registration === "failed" && (
                            <p className="text-xs text-red-600">
                                {state.registrationError ?? "Registration failed."}
                            </p>
                        )}
                        {state.registration === "registering" && (
                            <p className="text-xs text-slate-400">
                                Connecting to sipgate…
                            </p>
                        )}
                        {devices.length === 0 && !hasCall && (
                            <p className="text-xs text-slate-400">
                                No phone lines configured — add one in Settings.
                            </p>
                        )}
                        {devices.length > 0 && !hasCall && (
                            <div>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                    Active line
                                </label>
                                <select
                                    value={activeDeviceId ?? ""}
                                    onChange={(e) => setActiveDevice(Number(e.target.value))}
                                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none"
                                >
                                    {devices.map((d) => (
                                        <option key={d.id} value={d.id}>
                                            {d.label}
                                        </option>
                                    ))}
                                </select>
                                {state.registration === "registered" && (
                                    <p className="mt-2 text-xs text-slate-500">
                                        Ready — calls are placed from the CRM.
                                    </p>
                                )}
                            </div>
                        )}
                        {state.registration === "unregistered" && !hasCall && (
                            <p className="text-xs text-slate-400">Not registered.</p>
                        )}

                        {/* Inbound ringing */}
                        {ringingInbound && activeCall && (
                            <div className="text-center">
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                    Incoming call
                                </p>
                                <p className="mt-1 truncate text-lg font-semibold text-slate-800">
                                    {activeCall.peer}
                                </p>
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => void reject()}
                                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-red-600 py-2 text-sm font-medium text-white hover:bg-red-700"
                                    >
                                        <PhoneOff size={15} /> Decline
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void answer()}
                                        className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                                    >
                                        <Phone size={15} /> Answer
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Live / outbound call */}
                        {inCall && activeCall && (
                            <div className="text-center">
                                <p className="text-xs uppercase tracking-wide text-slate-400">
                                    {activeCall.phase === "outbound"
                                        ? "Calling…"
                                        : activeCall.onHold
                                          ? "On hold"
                                          : "In call"}
                                </p>
                                <p className="mt-1 truncate text-lg font-semibold text-slate-800">
                                    {activeCall.peer}
                                </p>
                                <p className="mt-0.5 text-sm tabular-nums text-slate-500">
                                    {elapsed ?? "00:00"}
                                </p>
                                <div className="mt-3 flex items-center justify-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setMuted(!activeCall.muted)}
                                        aria-label={activeCall.muted ? "Unmute" : "Mute"}
                                        className={`rounded-full p-2.5 ${activeCall.muted ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        {activeCall.muted ? <MicOff size={16} /> : <Mic size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHold(!activeCall.onHold)}
                                        aria-label={activeCall.onHold ? "Resume" : "Hold"}
                                        className={`rounded-full p-2.5 ${activeCall.onHold ? "bg-amber-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                                    >
                                        {activeCall.onHold ? <Play size={16} /> : <Pause size={16} />}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => void hangup()}
                                        aria-label="Hang up"
                                        className="rounded-full bg-red-600 p-2.5 text-white hover:bg-red-700"
                                    >
                                        <PhoneOff size={16} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
