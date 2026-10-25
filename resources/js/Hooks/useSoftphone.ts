import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import axios from "axios";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import { SoftphoneTabLease } from "@/lib/softphone/SoftphoneTabLease";
import type {
    SoftphoneCallContext,
    SoftphoneDeviceCredentialsResponse,
    SoftphoneDeviceSummary,
    SoftphoneDevicesResponse,
    SoftphoneState,
} from "@/Types/api/softphone";

const FEATURE_FLAG = "crm.softphone";
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
    const [activeDeviceId, setActiveDeviceIdState] = useState<number | null>(
        null,
    );
    const [configLoaded, setConfigLoaded] = useState(false);
    // Only the tab holding the cross-tab lease registers a SIP agent. Other
    // tabs mirror the call so they never ring or race the owning tab.
    const [isActiveTab, setIsActiveTab] = useState(true);
    const leaseRef = useRef<SoftphoneTabLease | null>(null);

    const state: SoftphoneState = useSyncExternalStore(
        (listener) => softphone.subscribe(listener),
        () => softphone.getState(),
        () => softphone.getState(),
    );

    // Mirror the owning tab's call into passive tabs so they can display it
    // without registering or ringing themselves.
    const [mirroredCall, setMirroredCall] = useState<
        SoftphoneState["call"] | null
    >(null);

    // Owner broadcasts its current call so other tabs stay in sync.
    useEffect(() => {
        if (!isActiveTab) {
            return;
        }
        leaseRef.current?.broadcastCall(state.call ?? null);
    }, [isActiveTab, state.call]);

    // Load the device list once.
    useEffect(() => {
        if (!isEnabled) {
            return;
        }
        axios
            .get<SoftphoneDevicesResponse>(
                route("telephony.softphone.devices.index"),
            )
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

    // Acquire the cross-tab lease. Exactly one tab registers; the rest mirror.
    useEffect(() => {
        if (!isEnabled) {
            return;
        }

        const lease = new SoftphoneTabLease();
        leaseRef.current = lease;
        const unsubscribe = lease.subscribe((owner, mirrored) => {
            setIsActiveTab(owner);
            if (!owner) {
                setMirroredCall((mirrored as SoftphoneState["call"]) ?? null);
                // Ownership lost — tear down any SIP registration this tab
                // may have started before the lease changed hands.
                void softphone.stop();
            }
        });

        let cancelled = false;
        void lease.acquire().then((owner) => {
            if (cancelled) {
                if (!owner) {
                    // Not the owner — make sure this tab never registers.
                    void softphone.stop();
                }
                return;
            }
            setIsActiveTab(owner);
            if (!owner) {
                void softphone.stop();
            }
        });

        return () => {
            cancelled = true;
            unsubscribe();
            lease.dispose();
            leaseRef.current = null;
        };
    }, [isEnabled]);

    // Fetch credentials for the active line and register it. Re-runs on switch.
    useEffect(() => {
        if (!isEnabled || !isActiveTab || activeDeviceId === null) {
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
                route("telephony.softphone.devices.credentials", {
                    id: device.id,
                }),
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
            // Unregister the line. Without this the SIP registration — and
            // with it the browser's microphone — stayed active after the dock
            // was unmounted, and the line kept ringing in the background.
            void softphone.stop();
        };
    }, [isEnabled, isActiveTab, devices, activeDeviceId]);

    const setActiveDevice = useCallback((id: number) => {
        setActiveDeviceIdState(id);
        storeDeviceId(id);
    }, []);

    const attachRemoteAudio = useCallback((el: HTMLAudioElement | null) => {
        softphone.attachRemoteAudio(el);
    }, []);

    // Passive tabs must never place/answer/reject — that is the owning tab's
    // job, otherwise two tabs fight over the same SIP session.
    const call = useCallback(
        async (target: string, context?: SoftphoneCallContext | null) => {
            if (!isActiveTab) return;
            await softphone.call(target, context ?? null);
        },
        [isActiveTab],
    );
    const clearCallFailure = useCallback(
        () => softphone.clearCallFailure(),
        [],
    );
    const answer = useCallback(async () => {
        if (!isActiveTab) return;
        await softphone.answer();
    }, [isActiveTab]);
    const reject = useCallback(async () => {
        if (!isActiveTab) return;
        await softphone.reject();
    }, [isActiveTab]);
    const hangup = useCallback(async () => {
        if (!isActiveTab) return;
        await softphone.hangup();
    }, [isActiveTab]);
    const setMuted = useCallback(
        (muted: boolean) => softphone.setMuted(muted),
        [],
    );
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
        state: isActiveTab ? state : { ...state, call: mirroredCall },
        isActiveTab,
        attachRemoteAudio,
        call,
        clearCallFailure,
        answer,
        reject,
        hangup,
        setMuted,
        setHold,
        isReady: state.registration === "registered",
    };
}
