import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@inertiajs/core";
import axios from "axios";
import type { NotchPosition } from "@/lib/notificationAlerts";
import {
    NOTCH_DURATIONS_MS,
    setNotchDurationMs as persistNotchDurationMsLocally,
    setNotchPosition as persistNotchPositionLocally,
    syncAlertsMutedFromServer,
} from "@/lib/notificationAlerts";

export interface NotificationAlertSettingsState {
    notch_position: NotchPosition;
    notch_duration_ms: number;
    alerts_muted: boolean;
}

const DEFAULTS: NotificationAlertSettingsState = {
    notch_position: "top-center",
    notch_duration_ms: 4200,
    alerts_muted: false,
};

interface NotificationAlertSettingsContextValue {
    settings: NotificationAlertSettingsState;
    setNotchPosition: (position: NotchPosition) => void;
    setNotchDurationMs: (durationMs: number) => void;
    setAlertsMuted: (muted: boolean) => void;
}

const NotificationAlertSettingsContext =
    createContext<NotificationAlertSettingsContextValue | null>(null);

function normalizeSettings(
    raw: Partial<NotificationAlertSettingsState> | null | undefined,
): NotificationAlertSettingsState {
    const position = raw?.notch_position ?? DEFAULTS.notch_position;
    const duration = raw?.notch_duration_ms ?? DEFAULTS.notch_duration_ms;

    return {
        notch_position: (
            [
                "top-left",
                "top-center",
                "top-right",
                "bottom-left",
                "bottom-center",
                "bottom-right",
            ] as const
        ).includes(position as NotchPosition)
            ? (position as NotchPosition)
            : DEFAULTS.notch_position,
        notch_duration_ms: (NOTCH_DURATIONS_MS as readonly number[]).includes(
            duration,
        )
            ? duration
            : DEFAULTS.notch_duration_ms,
        alerts_muted: raw?.alerts_muted ?? DEFAULTS.alerts_muted,
    };
}

async function persistSettings(
    payload: Partial<NotificationAlertSettingsState>,
): Promise<void> {
    await axios.put(route("notifications.api.alert_settings.update"), payload);
}

export function NotificationAlertSettingsProvider({
    children,
}: {
    children: ReactNode;
}) {
    const { props } = usePage<PageProps>();
    const [settings, setSettings] = useState<NotificationAlertSettingsState>(() =>
        normalizeSettings(props.notificationAlertSettings ?? undefined),
    );

    // The toast renderer (NotificationAlertProvider) reads position/duration/mute
    // synchronously from localStorage, not from this context — mirror every
    // server-backed change into localStorage so it takes effect immediately
    // and survives a page reload before this context re-hydrates.
    useEffect(() => {
        syncAlertsMutedFromServer(settings.alerts_muted);
    }, [settings.alerts_muted]);

    useEffect(() => {
        persistNotchPositionLocally(settings.notch_position);
    }, [settings.notch_position]);

    useEffect(() => {
        persistNotchDurationMsLocally(settings.notch_duration_ms);
    }, [settings.notch_duration_ms]);

    const patchSettings = useCallback(
        (partial: Partial<NotificationAlertSettingsState>) => {
            setSettings((prev) => {
                const next = normalizeSettings({ ...prev, ...partial });
                void persistSettings(partial).catch(() => {
                    // Re-sync from server on the next navigation if save fails.
                });
                return next;
            });
        },
        [],
    );

    const setNotchPosition = useCallback(
        (position: NotchPosition) => patchSettings({ notch_position: position }),
        [patchSettings],
    );

    const setNotchDurationMs = useCallback(
        (durationMs: number) =>
            patchSettings({ notch_duration_ms: durationMs }),
        [patchSettings],
    );

    const setAlertsMuted = useCallback(
        (muted: boolean) => patchSettings({ alerts_muted: muted }),
        [patchSettings],
    );

    const value = useMemo(
        () => ({
            settings,
            setNotchPosition,
            setNotchDurationMs,
            setAlertsMuted,
        }),
        [settings, setNotchPosition, setNotchDurationMs, setAlertsMuted],
    );

    return (
        <NotificationAlertSettingsContext.Provider value={value}>
            {children}
        </NotificationAlertSettingsContext.Provider>
    );
}

export function useNotificationAlertSettings(): NotificationAlertSettingsContextValue {
    const ctx = useContext(NotificationAlertSettingsContext);
    if (!ctx) {
        return {
            settings: DEFAULTS,
            setNotchPosition: () => {},
            setNotchDurationMs: () => {},
            setAlertsMuted: () => {},
        };
    }
    return ctx;
}
