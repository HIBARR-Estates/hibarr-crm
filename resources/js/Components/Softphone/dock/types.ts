import type { SoftphoneCallStage, SoftphoneRegistrationState } from "@/lib/softphone/SoftphoneClient";

export type CallRecordingItem = {
    id: number;
    filename: string;
    play_url: string;
    is_expired: boolean;
};

export type FailedCallInfo = {
    callRef: string;
    phone: string;
    leadId?: number;
    leadName?: string;
    error: string;
    timestamp: number;
};

export type LeadMatchData = {
    id: number;
    name: string;
    lead_url?: string;
};

export const STATUS_DOT: Record<SoftphoneRegistrationState, string> = {
    idle: "bg-slate-300",
    registering: "bg-amber-400 animate-pulse",
    registered: "bg-emerald-500",
    unregistered: "bg-amber-400",
    failed: "bg-red-500",
};

/** What the dock says for each stage of the call lifecycle. */
export const STAGE_LABEL: Record<SoftphoneCallStage, string> = {
    calling: "Calling…",
    ringing: "Ringing…",
    connecting: "Connecting…",
    connected: "Connected",
    ended: "Call ended",
};
