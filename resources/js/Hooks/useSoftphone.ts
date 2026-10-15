import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import type {
    SoftphoneDeviceCredentialsResponse,
    SoftphoneDeviceSummary,
    SoftphoneDevicesResponse,
    SoftphoneState,
} from "@/Types/api/softphone";

const FEATURE_FLAG = "shared.softphone";
const ACTIVE_DEVICE_KEY = "softphone.active_device_id";

function readStoredDeviceId(): number | null {
    try {
        const raw = window.localStorage.getItem(ACTIVE_DEVICE_KEY);
        return raw ? Number(raw) : null;
    } catch {
        return null;
    }
}

function storeDeviceId(id: number): void {
    try {
        window.localStorage.setItem(ACTIVE_DEVICE_KEY, String(id));
    } catch {
        // ignore storage errors
    }
}

/**
 * Bridges the module-scope SoftphoneClient into React. Loads the company's
 * device lines, keeps one ACTIVE line registered (switching swaps the
 * registration), and exposes live registration/call state plus controls.
 */
export default function useSoftphone() {
    const { props } = usePage();
    const isEnabled = props.featureFlags?.[FEATURE_FLAG] === true;
    const [devices, setDevices] = useState<SoftphoneDeviceSummary[]>([]);
    const [activeDeviceId, setActiveDeviceIdState] = useState<number | null>(null);
    const [configLoaded, setConfigLoaded] = useState(false);

    const state: SoftphoneState = useSyncExternalStore(
        (listener) => softphone.subscribe(listener),
        () => softphone.getState(),
        () => softphone.getState(),
    );

    // Load the device list once.
    useEffect(() => {
        if (!isEnabled) {
            return;
        }
        axios
            .get<SoftphoneDevicesResponse>(route("telephony.softphone.devices.index"))
            .then((response) => {
                setDevices(response.data?.data?.devices ?? []);
            })
            .catch(() => setDevices([]));
    }, [isEnabled]);

    // Pick the initial active line once the list loads (stored → default → first).
    useEffect(() => {
        if (!isEnabled || devices.length === 0 || activeDeviceId !== null) {
            return;
        }
        const stored = readStoredDeviceId();
        const initial =
            devices.find((d) => d.id === stored) ??
            devices.find((d) => d.is_default) ??
            devices[0];
        if (initial) {
            setActiveDeviceIdState(initial.id);
            storeDeviceId(initial.id);
        }
    }, [isEnabled, devices, activeDeviceId]);

    // Fetch credentials for the active line and register it. Re-runs on switch.
    useEffect(() => {
        if (!isEnabled || activeDeviceId === null) {
            return;
        }
        const device = devices.find((d) => d.id === activeDeviceId);
        if (!device) {
            setConfigLoaded(false);
            return;
        }

        let cancelled = false;
        setConfigLoaded(false);

        axios
            .get<SoftphoneDeviceCredentialsResponse>(
                route("telephony.softphone.devices.credentials", { id: device.id }),
            )
            .then(async (response) => {
                if (cancelled) {
                    return;
                }
                const credentials = response.data?.data;
                if (response.data?.status === "success" && credentials) {
                    await softphone.start(credentials);
                }
            })
            .catch(() => {
                // Missing credentials / flag off server-side — leave dock inert.
            })
            .finally(() => {
                if (!cancelled) {
                    setConfigLoaded(true);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [isEnabled, devices, activeDeviceId]);

    const setActiveDevice = useCallback((id: number) => {
        setActiveDeviceIdState(id);
        storeDeviceId(id);
    }, []);

    const attachRemoteAudio = useCallback((el: HTMLAudioElement | null) => {
        softphone.attachRemoteAudio(el);
    }, []);

    const call = useCallback((target: string) => softphone.call(target), []);
    const answer = useCallback(() => softphone.answer(), []);
    const reject = useCallback(() => softphone.reject(), []);
    const hangup = useCallback(() => softphone.hangup(), []);
    const setMuted = useCallback((muted: boolean) => softphone.setMuted(muted), []);
    const setHold = useCallback((hold: boolean) => softphone.setHold(hold), []);

    const activeDevice = useMemo(
        () => devices.find((d) => d.id === activeDeviceId) ?? null,
        [devices, activeDeviceId],
    );

    return {
        isEnabled,
        configLoaded,
        devices,
        activeDevice,
        activeDeviceId,
        setActiveDevice,
        state,
        attachRemoteAudio,
        call,
        answer,
        reject,
        hangup,
        setMuted,
        setHold,
        isReady: state.registration === "registered",
    };
}
