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

export interface SoftphoneCall {
    id: string;
    direction: "outbound" | "inbound";
    /** Remote party (number or sip identity) as best we know it. */
    peer: string;
    phase: SoftphoneCallPhase;
    /** Epoch ms once the call is established (answered); null before. */
    answeredAt: number | null;
    muted: boolean;
    onHold: boolean;
}

export interface SoftphoneState {
    registration: SoftphoneRegistrationState;
    registrationError: string | null;
    call: SoftphoneCall | null;
}
