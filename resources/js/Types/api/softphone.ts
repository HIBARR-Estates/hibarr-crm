/** sipgate Neo WebRTC config for one device/line (from its credentials). */
export interface SoftphoneConfig {
    wss_url: string;
    uri: string;
    authorization_username: string | null;
    authorization_password: string;
    display_name: string | null;
}

/** A device/line as listed for the picker + settings (no secrets). */
export interface SoftphoneDeviceSummary {
    id: number;
    label: string;
    is_default: boolean;
}

export interface SoftphoneDevicesResponse {
    status: "success" | "fail";
    message?: string | null;
    data?: { devices: SoftphoneDeviceSummary[] };
}

/** Full credentials for one device so the browser can register it. */
export interface SoftphoneDeviceCredentials extends SoftphoneConfig {
    id: number;
    label: string;
}

export interface SoftphoneDeviceCredentialsResponse {
    status: "success" | "fail";
    message?: string | null;
    data?: SoftphoneDeviceCredentials;
}

export type SoftphoneRegistrationState =
    | "idle"
    | "registering"
    | "registered"
    | "unregistered"
    | "failed";

export type SoftphoneCallPhase =
    | "outbound"
    | "inbound"
    | "active"
    | "ended";

/**
 * Where the call is in its lifecycle, for the UI to narrate.
 *
 * Independent of `phase`, which only records *whose* call it is (direction)
 * and whether it is established (used for recording + timeline logging):
 *
 *   calling    — INVITE sent, no response from the callee yet
 *   ringing    — inbound: ringing us / outbound: callee's phone is ringing
 *   connecting — answered (200 OK), media path (ICE/DTLS) still negotiating
 *   connected  — media is flowing both ways; the call timer runs from here
 *   ended      — the session terminated (the call object is dropped then)
 */
export type SoftphoneCallStage =
    | "calling"
    | "ringing"
    | "connecting"
    | "connected"
    | "ended";

export interface SoftphoneCall {
    id: string;
    direction: "outbound" | "inbound";
    /** Remote party (number or sip identity) as best we know it. */
    peer: string;
    phase: SoftphoneCallPhase;
    /** Lifecycle stage, for the status line ("Calling…", "Connected"). */
    stage: SoftphoneCallStage;
    /** Lead the caller already knew about, when the entry point had one. */
    context: SoftphoneCallContext | null;
    /** Epoch ms once the call is established (answered); null before. */
    answeredAt: number | null;
    /** Epoch ms once media actually flows (ICE connected); null before. */
    connectedAt: number | null;
    muted: boolean;
    onHold: boolean;
}

export type SoftphoneConnectionQuality =
    | "good"
    | "unstable"
    | "poor"
    | "unknown";

/**
 * What the caller already knew about who they are dialling.
 *
 * Only passed by entry points that have the lead in hand (a task's quick-action,
 * a phone shown next to a lead). A click-to-call from an arbitrary screen passes
 * nothing — that call then carries just the number.
 */
export interface SoftphoneCallContext {
    leadId: number | null;
    leadName?: string | null;
}

/** Why a call ended before it ever connected. */
export type SoftphoneCallFailureCode =
    | "busy"
    | "declined"
    | "unreachable"
    | "no-answer"
    | "not-found"
    | "cancelled"
    | "media"
    | "terminated"
    | "unknown";

/**
 * A failed call, kept in state after the session is torn down so the dock can
 * explain what happened instead of vanishing silently. Dismissed by the agent,
 * or automatically after a while.
 */
export interface SoftphoneCallFailure {
    code: SoftphoneCallFailureCode;
    /** Agent-facing sentence, e.g. "The line is busy." */
    reason: string;
    peer: string;
    direction: "outbound" | "inbound";
    /** Kept so "Try again" redials the same number with the same context. */
    context: SoftphoneCallContext | null;
}

export interface SoftphoneState {
    registration: SoftphoneRegistrationState;
    registrationError: string | null;
    call: SoftphoneCall | null;
    /** Set when a call ends without connecting; cleared by the dock. */
    callFailure: SoftphoneCallFailure | null;
    /** Last error raised by a call attempt, cleared on a successful sale. */
    lastCallError: string | null;
    /** Rough audio/connection quality while a call is active. */
    quality: SoftphoneConnectionQuality;
}
