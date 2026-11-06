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
    canMakeCalls: boolean;
}

/**
 * Shared predicate: only admins and users whose make_softphone_calls permission
 * is 'all' or 'added' may place calls or register softphone lines.
 */
export function canMakeSoftphoneCalls(
    user?: { roles?: Array<{ name?: string }> } | null,
    permissions?: Record<string, unknown> | null,
): boolean {
    const isAdmin = (user?.roles ?? []).some(
        (role: { name?: string }) => role?.name === "admin",
    );
    if (isAdmin) {
        return true;
    }
    const perm = permissions?.make_softphone_calls;
    return perm === "all" || perm === "added";
}

/**
 * Call managers (admins, or manage_calls = 'all') see every agent's calls and
 * may play every recording. Mirrors App\Support\CallAccess::canManageCalls.
 */
export function canManageCalls(
    user?: { roles?: Array<{ name?: string }> } | null,
    permissions?: Record<string, unknown> | null,
): boolean {
    const isAdmin = (user?.roles ?? []).some(
        (role: { name?: string }) => role?.name === "admin",
    );
    return isAdmin || permissions?.manage_calls === "all";
}

/**
 * Whether the viewer may play a recording made by `ownerId`: the agent on the
 * call (with call permission) or a call manager. The server enforces the same
 * rule (CallAccess::canPlayRecording); this only decides what to render.
 */
export function canPlayCallRecording(
    user?: { id?: number | string | null; roles?: Array<{ name?: string }> } | null,
    permissions?: Record<string, unknown> | null,
    ownerId?: number | string | null,
): boolean {
    if (canManageCalls(user, permissions)) {
        return true;
    }
    return (
        canMakeSoftphoneCalls(user, permissions) &&
        user?.id != null &&
        ownerId != null &&
        Number(user.id) === Number(ownerId)
    );
}

let storeState: SoftphoneStoreState = {
    devices: [],
    activeDeviceId: null,
    configLoaded: false,
    devicesLoaded: false,
    isActiveTab: true,
    mirroredCall: null,
    canMakeCalls: false,
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
    if (storeState.canMakeCalls === false) {
        return [];
    }
    if (devicesFetchPromise) {
        return devicesFetchPromise;
    }
    devicesFetchPromise = axios
        .get<SoftphoneDevicesResponse>(
            route("telephony.softphone.devices.index"),
        )
        .then((response) => {
            // Disabled lines get no credentials (the server answers 423), so
            // the dock and call buttons never offer or register them.
            const list = (response.data?.data?.devices ?? []).filter(
                (d) => d.is_active !== false,
            );
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
            // The registered line was disabled (or unassigned) since it was
            // registered: drop the registration so it stops ringing here,
            // unless a call is live on it right now.
            if (
                registeredDeviceId !== null &&
                !list.some((d) => d.id === registeredDeviceId) &&
                softphone.getState().call == null
            ) {
                registeredDeviceId = null;
                void softphone.stop();
            }
            if (
                storeState.isActiveTab &&
                storeState.canMakeCalls &&
                nextActiveId !== null &&
                registeredDeviceId !== nextActiveId
            ) {
                void activateDeviceInternal(nextActiveId);
            }
            return list;
        })
        .catch(() => storeState.devices)
        .finally(() => {
            devicesFetchPromise = null;
        });

    return devicesFetchPromise;
}

/**
 * Re-check the line list while the app is open (every few minutes and when
 * the window regains focus), so a line disabled in settings stops ringing in
 * browsers that registered it earlier. Installed once per page.
 */
let lineWatchInstalled = false;
const LINE_WATCH_INTERVAL_MS = 3 * 60 * 1000;
function installLineWatch(): void {
    if (lineWatchInstalled || typeof window === "undefined") {
        return;
    }
    lineWatchInstalled = true;
    const refresh = () => {
        if (devicesLoadedOnce && storeState.canMakeCalls !== false) {
            void refreshSoftphoneDevices();
        }
    };
    window.setInterval(refresh, LINE_WATCH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
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
    if (storeState.canMakeCalls === false) {
        return false;
    }

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
            } else if (!wasOwner && storeState.activeDeviceId !== null && storeState.canMakeCalls) {
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
                    storeState.activeDeviceId !== null &&
                    storeState.canMakeCalls
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
    const canMakeCalls = canMakeSoftphoneCalls(
        props.auth?.user,
        props.auth?.permissions,
    );

    if (storeState.canMakeCalls !== canMakeCalls) {
        storeState.canMakeCalls = canMakeCalls;
    }

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
        if (!isEnabled || !canMakeCalls) {
            return;
        }
        installLineWatch();
        return retainSoftphoneRuntime();
    }, [isEnabled, canMakeCalls]);

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
                            "Your phone line isn't connected — pick a line in the phone panel.",
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
