import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
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

interface SoftphoneStoreState {
    devices: SoftphoneDeviceSummary[];
    activeDeviceId: number | null;
    configLoaded: boolean;
    /** True once the (permission-filtered) line list has been fetched. */
    devicesLoaded: boolean;
    isActiveTab: boolean;
    mirroredCall: SoftphoneState["call"] | null;
}

let storeState: SoftphoneStoreState = {
    devices: [],
    activeDeviceId: null,
    configLoaded: false,
    devicesLoaded: false,
    isActiveTab: true,
    mirroredCall: null,
};

const storeListeners = new Set<() => void>();

function emitStoreChange(): void {
    storeListeners.forEach((listener) => listener());
}

function updateStore(partial: Partial<SoftphoneStoreState>): void {
    storeState = { ...storeState, ...partial };
    emitStoreChange();
}

function subscribeStore(listener: () => void): () => void {
    storeListeners.add(listener);
    return () => {
        storeListeners.delete(listener);
    };
}

function getStoreSnapshot(): SoftphoneStoreState {
    return storeState;
}

let devicesFetchPromise: Promise<SoftphoneDeviceSummary[]> | null = null;
let devicesLoadedOnce = false;
let sharedLease: SoftphoneTabLease | null = null;
let sharedLeaseUnsubscribe: (() => void) | null = null;
let sharedClientUnsubscribe: (() => void) | null = null;
let mountedEnabledConsumers = 0;

let registeredDeviceId: number | null = null;
let activatingDeviceId: number | null = null;
let activationPromise: Promise<boolean> | null = null;
let activationToken = 0;

function pickInitialDeviceId(
    devices: SoftphoneDeviceSummary[],
    currentId: number | null,
): number | null {
    if (currentId !== null && devices.some((d) => d.id === currentId)) {
        return currentId;
    }
    const stored = readStoredDeviceId();
    const initial =
        devices.find((d) => d.id === stored) ??
        devices.find((d) => d.is_default) ??
        devices[0];
    return initial ? initial.id : null;
}

export async function refreshSoftphoneDevices(): Promise<
    SoftphoneDeviceSummary[]
> {
    if (devicesFetchPromise) {
        return devicesFetchPromise;
    }
    devicesFetchPromise = axios
        .get<SoftphoneDevicesResponse>(
            route("telephony.softphone.devices.index"),
        )
        .then((response) => {
            const list = response.data?.data?.devices ?? [];
            devicesLoadedOnce = true;
            // A refresh must not move the active line (or reactivate a
            // different one) while a call is live: keep the current selection.
            const liveCallLine = registeredDeviceId;
            const keepLiveLine =
                softphone.getState().call != null &&
                liveCallLine !== null &&
                storeState.activeDeviceId === liveCallLine;
            const nextActiveId = keepLiveLine
                ? liveCallLine
                : pickInitialDeviceId(list, storeState.activeDeviceId);
            if (nextActiveId !== null) {
                storeDeviceId(nextActiveId);
            }
            updateStore({
                devices: list,
                devicesLoaded: true,
                activeDeviceId: nextActiveId,
            });
            if (
                storeState.isActiveTab &&
                nextActiveId !== null &&
                registeredDeviceId !== nextActiveId
            ) {
                void activateDeviceInternal(nextActiveId);
            }
            return list;
        })
        .catch(() => {
            devicesLoadedOnce = true;
            updateStore({ devices: [], devicesLoaded: true });
            return [];
        })
        .finally(() => {
            devicesFetchPromise = null;
        });

    return devicesFetchPromise;
}

async function ensureDevicesLoaded(): Promise<SoftphoneDeviceSummary[]> {
    if (devicesLoadedOnce) {
        return storeState.devices;
    }
    return refreshSoftphoneDevices();
}

/**
 * True when switching to `deviceId` would tear down the line carrying a live
 * (ringing, dialling or connected) call. Re-activating the same line is fine.
 */
function wouldInterruptLiveCall(deviceId: number): boolean {
    return (
        softphone.getState().call != null &&
        registeredDeviceId !== null &&
        registeredDeviceId !== deviceId
    );
}

async function activateDeviceInternal(deviceId: number): Promise<boolean> {
    // Never change the active line (or re-register) while a call is live:
    // softphone.start() on another line would drop the call.
    if (wouldInterruptLiveCall(deviceId)) {
        return false;
    }

    if (storeState.activeDeviceId !== deviceId) {
        storeDeviceId(deviceId);
        updateStore({ activeDeviceId: deviceId });
    } else {
        storeDeviceId(deviceId);
    }

    if (!storeState.isActiveTab) {
        return false;
    }

    if (
        registeredDeviceId === deviceId &&
        softphone.getState().registration === "registered"
    ) {
        if (!storeState.configLoaded) {
            updateStore({ configLoaded: true });
        }
        return true;
    }

    if (activationPromise && activatingDeviceId === deviceId) {
        return activationPromise;
    }

    const token = ++activationToken;
    activatingDeviceId = deviceId;
    updateStore({ configLoaded: false });

    const promise = axios
        .get<SoftphoneDeviceCredentialsResponse>(
            route("telephony.softphone.devices.credentials", {
                id: deviceId,
            }),
        )
        .then(async (response) => {
            if (token !== activationToken || !storeState.isActiveTab) {
                return false;
            }
            const credentials = response.data?.data;
            if (response.data?.status === "success" && credentials) {
                await softphone.start(credentials);
                const ready =
                    softphone.getState().registration === "registered";
                if (token === activationToken) {
                    registeredDeviceId = ready ? deviceId : null;
                }
                return ready;
            }
            return false;
        })
        .catch(() => {
            if (token === activationToken) {
                registeredDeviceId = null;
            }
            return false;
        })
        .finally(() => {
            if (token === activationToken) {
                activatingDeviceId = null;
                activationPromise = null;
                updateStore({ configLoaded: true });
            }
        });

    activationPromise = promise;
    return promise;
}

function retainSoftphoneRuntime(): () => void {
    mountedEnabledConsumers += 1;

    if (mountedEnabledConsumers === 1) {
        const lease = new SoftphoneTabLease();
        sharedLease = lease;
        sharedLeaseUnsubscribe = lease.subscribe((owner, mirrored) => {
            const wasOwner = storeState.isActiveTab;
            updateStore({
                isActiveTab: owner,
                mirroredCall: owner
                    ? storeState.mirroredCall
                    : ((mirrored as SoftphoneState["call"]) ?? null),
            });
            if (!owner) {
                registeredDeviceId = null;
                void softphone.stop();
            } else if (!wasOwner && storeState.activeDeviceId !== null) {
                void activateDeviceInternal(storeState.activeDeviceId);
            }
        });

        sharedClientUnsubscribe = softphone.subscribe(() => {
            if (storeState.isActiveTab) {
                sharedLease?.broadcastCall(softphone.getState().call ?? null);
            }
        });

        void lease.acquire().then((owner) => {
            if (sharedLease !== lease) {
                if (!owner) {
                    void softphone.stop();
                }
                return;
            }
            updateStore({ isActiveTab: owner });
            if (!owner) {
                registeredDeviceId = null;
                void softphone.stop();
                return;
            }
            void ensureDevicesLoaded().then(() => {
                if (
                    sharedLease === lease &&
                    storeState.isActiveTab &&
                    storeState.activeDeviceId !== null
                ) {
                    void activateDeviceInternal(storeState.activeDeviceId);
                }
            });
        });

        void ensureDevicesLoaded();
    }

    return () => {
        mountedEnabledConsumers = Math.max(0, mountedEnabledConsumers - 1);
        if (mountedEnabledConsumers === 0) {
            activationToken += 1;
            activatingDeviceId = null;
            activationPromise = null;
            registeredDeviceId = null;
            sharedLeaseUnsubscribe?.();
            sharedLeaseUnsubscribe = null;
            sharedClientUnsubscribe?.();
            sharedClientUnsubscribe = null;
            sharedLease?.dispose();
            sharedLease = null;
            void softphone.stop();
        }
    };
}

/**
 * Bridges the module-scope SoftphoneClient into React. Loads the company's
 * device lines, keeps one ACTIVE line registered (switching swaps the
 * registration), and exposes live registration/call state plus controls.
 *
 * State and cross-tab lease ownership are shared at module scope so multiple
 * components (SoftphoneDock, ClickToCallButton, TaskCallBanner, etc.) can read
 * and switch the active line without creating competing leases or tearing down
 * the active SIP registration when individual buttons mount or unmount.
 */
export default function useSoftphone() {
    const { props } = usePage();
    const isEnabled = props.featureFlags?.[FEATURE_FLAG] === true;
    const isAdmin = (props.auth?.user?.roles ?? []).some(
        (role: { name?: string }) => role?.name === "admin",
    );
    const softphonePermission = props.auth?.permissions?.make_softphone_calls;
    const canMakeCalls =
        isAdmin ||
        ["all", "added", "owned", "both", 1, 4].includes(
            softphonePermission as string | number,
        );

    const shared = useSyncExternalStore(
        subscribeStore,
        getStoreSnapshot,
        getStoreSnapshot,
    );

    const state: SoftphoneState = useSyncExternalStore(
        (listener) => softphone.subscribe(listener),
        () => softphone.getState(),
        () => softphone.getState(),
    );

    useEffect(() => {
        if (!isEnabled) {
            return;
        }
        return retainSoftphoneRuntime();
    }, [isEnabled]);

    useEffect(() => {
        if (
            !isEnabled ||
            !canMakeCalls ||
            !shared.isActiveTab ||
            shared.activeDeviceId === null
        ) {
            return;
        }
        if (
            registeredDeviceId !== shared.activeDeviceId &&
            activatingDeviceId === null &&
            state.registration === "idle"
        ) {
            void activateDeviceInternal(shared.activeDeviceId);
        }
    }, [
        isEnabled,
        canMakeCalls,
        shared.isActiveTab,
        shared.activeDeviceId,
        state.registration,
    ]);

    const setActiveDevice = useCallback((id: number) => {
        void activateDeviceInternal(id);
    }, []);

    const activateDevice = useCallback(async (id: number): Promise<boolean> => {
        return activateDeviceInternal(id);
    }, []);

    const attachRemoteAudio = useCallback((el: HTMLAudioElement | null) => {
        softphone.attachRemoteAudio(el);
    }, []);

    // Passive tabs must never place/answer/reject — that is the owning tab's
    // job, otherwise two tabs fight over the same SIP session.
    const call = useCallback(
        async (
            target: string,
            context?: SoftphoneCallContext | null,
            deviceId?: number,
        ) => {
            if (!storeState.isActiveTab) {
                throw new Error(
                    "Calls are handled in another open tab for this account.",
                );
            }

            let devicesList = storeState.devices;
            if (devicesList.length === 0 && !devicesLoadedOnce) {
                devicesList = await ensureDevicesLoaded();
            }

            const targetDeviceId =
                typeof deviceId === "number"
                    ? deviceId
                    : (storeState.activeDeviceId ??
                      pickInitialDeviceId(devicesList, null));

            if (targetDeviceId !== null) {
                if (wouldInterruptLiveCall(targetDeviceId)) {
                    throw new Error(
                        "Finish the current call before switching lines.",
                    );
                }
                const ready = await activateDeviceInternal(targetDeviceId);
                if (!ready && softphone.getState().registration !== "registered") {
                    throw new Error(
                        softphone.getState().registrationError ||
                            "Softphone is not registered — pick a line in the dock.",
                    );
                }
            }

            await softphone.call(target, context ?? null);
        },
        [],
    );

    const clearCallFailure = useCallback(
        () => softphone.clearCallFailure(),
        [],
    );
    const answer = useCallback(async () => {
        if (!storeState.isActiveTab) return;
        await softphone.answer();
    }, []);
    const reject = useCallback(async () => {
        if (!storeState.isActiveTab) return;
        await softphone.reject();
    }, []);
    const hangup = useCallback(async () => {
        if (!storeState.isActiveTab) return;
        await softphone.hangup();
    }, []);
    const setMuted = useCallback(
        (muted: boolean) => softphone.setMuted(muted),
        [],
    );
    const setHold = useCallback((hold: boolean) => softphone.setHold(hold), []);

    const activeDevice = useMemo(
        () =>
            shared.devices.find((d) => d.id === shared.activeDeviceId) ?? null,
        [shared.devices, shared.activeDeviceId],
    );

    return {
        isEnabled,
        configLoaded: shared.configLoaded,
        devices: shared.devices,
        /**
         * False once the line list has loaded empty: the user is not assigned
         * to any line, so call buttons must fall back to a plain tel: link.
         * Treated as true while loading so buttons don't flicker.
         */
        hasLine: !shared.devicesLoaded || shared.devices.length > 0,
        activeDevice,
        activeDeviceId: shared.activeDeviceId,
        setActiveDevice,
        activateDevice,
        refreshDevices: refreshSoftphoneDevices,
        state: shared.isActiveTab
            ? state
            : { ...state, call: shared.mirroredCall },
        isActiveTab: shared.isActiveTab,
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
