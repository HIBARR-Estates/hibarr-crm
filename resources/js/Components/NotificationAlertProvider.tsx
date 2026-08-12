import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type FocusEvent,
    type MouseEvent,
    type MutableRefObject,
    type ReactNode,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    getNotchDurationMs,
    getNotchPosition,
    type NotchPosition,
} from "@/lib/notificationAlerts";
import { useNotificationMutations } from "@/Hooks/useNotifications";
import { isSafeHttpUrl } from "@/lib/mapNotificationToAlert";
import {
    REDESIGN_TOKENS as T,
    REDESIGN_FONT_STACK,
} from "@/Components/Redesign/tokens";

export type NotchSeverity =
    | "blue"
    | "green"
    | "amber"
    | "red"
    | "teal"
    | "navy"
    | "gray";

export interface NotificationAlertAction {
    label: string;
    primary?: boolean;
    href?: string | null;
    /** Open join/external meeting links without leaving the current page. */
    openInNewTab?: boolean;
}

export interface NotificationAlertPayload {
    id?: string;
    title: string;
    /** Compact one-line context under the title. */
    meta: string;
    /** Longer detail, revealed on hover. Falls back to `meta` when omitted. */
    body?: string;
    /** Destination breadcrumb (e.g. "Deals · #2841"), revealed on hover. */
    dest?: string;
    link?: string | null;
    severity?: NotchSeverity;
    timeAgo?: string;
    actions?: NotificationAlertAction[];
}

interface NotificationAlertContextValue {
    push: (notification: NotificationAlertPayload) => void;
    dismiss: () => void;
}

const NotificationAlertContext =
    createContext<NotificationAlertContextValue | null>(null);

export function useNotificationAlert(): NotificationAlertContextValue {
    const ctx = useContext(NotificationAlertContext);
    if (!ctx) {
        throw new Error(
            "useNotificationAlert must be used within NotificationAlertProvider",
        );
    }
    return ctx;
}

const ACCENT_BY_SEVERITY: Record<NotchSeverity, string> = {
    blue: T.BLUE_MID,
    green: T.GREEN_MID,
    amber: T.AMBER_MID,
    red: T.RED_MID,
    teal: T.TEAL_MID,
    navy: T.NAVY_MID,
    gray: T.GRAY_MID,
};

function accentTintBackground(accent: string): string {
    if (accent.startsWith("rgba(") || accent.startsWith("rgb(")) {
        const match = accent.match(/rgba?\(([^)]+)\)/);
        if (match) {
            const parts = match[1].split(",").map((part) => part.trim());
            if (parts.length >= 3) {
                return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, 0.15)`;
            }
        }
        return "rgba(255,255,255,0.1)";
    }
    if (accent.startsWith("#") && accent.length === 7) {
        return `${accent}26`;
    }
    return "rgba(255,255,255,0.1)";
}

const REST_W = 132;
const REST_H = 26;
const COMPACT_W = 356;
const COMPACT_H = 60;
const EXPANDED_W = 404;

function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(
        () =>
            typeof window !== "undefined" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );

    useEffect(() => {
        if (typeof window === "undefined") return;
        const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
        const onChange = () => setReduced(mq.matches);
        mq.addEventListener("change", onChange);
        return () => mq.removeEventListener("change", onChange);
    }, []);

    return reduced;
}

function wrapperStyle(position: NotchPosition): CSSProperties {
    const isTop = position.indexOf("top") === 0;
    const hAlign =
        position.indexOf("left") > 0
            ? "flex-start"
            : position.indexOf("right") > 0
              ? "flex-end"
              : "center";

    return {
        position: "fixed",
        inset: 0,
        display: "flex",
        justifyContent: hAlign,
        alignItems: isTop ? "flex-start" : "flex-end",
        padding: 20,
        pointerEvents: "none",
        zIndex: 10000,
    };
}

/**
 * App-wide transient notification surface — always the floating "island"
 * treatment (fully rounded navy card, offset from the edge), regardless of
 * anchor. See the Notch Notifications design handoff for the source spec.
 */
export default function NotificationAlertProvider({
    children,
}: {
    children: ReactNode;
}) {
    const [current, setCurrent] = useState<NotificationAlertPayload | null>(
        null,
    );
    const [open, setOpen] = useState(false);
    const [hover, setHover] = useState(false);
    const [pulse, setPulse] = useState(false);
    const reducedMotion = usePrefersReducedMotion();
    const { markAsRead, markAsReadQuiet } = useNotificationMutations();

    const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const enterTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pulseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const hoverRef = useRef(false);
    const currentRef = useRef<NotificationAlertPayload | null>(null);

    const clearTimer = (ref: MutableRefObject<ReturnType<typeof setTimeout> | null>) => {
        if (ref.current) {
            clearTimeout(ref.current);
            ref.current = null;
        }
    };

    useEffect(
        () => () => {
            clearTimer(dismissTimer);
            clearTimer(enterTimer);
            clearTimer(pulseTimer);
            clearTimer(exitTimer);
        },
        [],
    );

    const armDismiss = useCallback(() => {
        clearTimer(dismissTimer);
        if (hoverRef.current) return;
        dismissTimer.current = setTimeout(() => {
            setOpen(false);
            setHover(false);
            clearTimer(exitTimer);
            exitTimer.current = setTimeout(() => {
                currentRef.current = null;
                setCurrent(null);
            }, 440);
        }, getNotchDurationMs());
    }, []);

    const push = useCallback(
        (notification: NotificationAlertPayload) => {
            clearTimer(exitTimer);
            clearTimer(enterTimer);
            clearTimer(dismissTimer);

            const hadPrevious = currentRef.current !== null;
            currentRef.current = notification;
            setCurrent(notification);

            if (hadPrevious) {
                setPulse(true);
                clearTimer(pulseTimer);
                pulseTimer.current = setTimeout(() => setPulse(false), 280);
            } else {
                enterTimer.current = setTimeout(() => setOpen(true), 20);
            }

            armDismiss();
        },
        [armDismiss],
    );

    const dismiss = useCallback(() => {
        clearTimer(dismissTimer);
        clearTimer(enterTimer);
        setOpen(false);
        setHover(false);
        clearTimer(exitTimer);
        exitTimer.current = setTimeout(() => {
            currentRef.current = null;
            setCurrent(null);
        }, 440);
    }, []);

    const onEnter = useCallback(() => {
        if (!current) return;
        hoverRef.current = true;
        clearTimer(dismissTimer);
        setHover(true);
    }, [current]);

    const onLeave = useCallback(() => {
        hoverRef.current = false;
        setHover(false);
        if (current) armDismiss();
    }, [current, armDismiss]);

    const onBlur = useCallback(
        (e: FocusEvent<HTMLDivElement>) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                onLeave();
            }
        },
        [onLeave],
    );

    const handleOpenClick = useCallback(
        (e: MouseEvent) => {
            e.stopPropagation();
            if (current?.id) markAsRead({ id: current.id });
            if (current?.link) window.location.href = current.link;
            dismiss();
        },
        [current, dismiss, markAsRead],
    );

    const handleActionClick = useCallback(
        (action: NotificationAlertAction) => (e: MouseEvent) => {
            e.stopPropagation();
            if (current?.id) markAsReadQuiet(current.id);
            const href =
                action.href && isSafeHttpUrl(action.href)
                    ? action.href
                    : current?.link && isSafeHttpUrl(current.link)
                      ? current.link
                      : null;
            if (href) {
                if (action.openInNewTab) {
                    window.open(href, "_blank", "noopener,noreferrer");
                } else {
                    window.location.href = href;
                }
            }
            dismiss();
        },
        [current, dismiss, markAsReadQuiet],
    );

    const handleDismissClick = useCallback(
        (e: MouseEvent) => {
            e.preventDefault();
            e.stopPropagation();
            const id = current?.id;
            dismiss();
            if (id) markAsReadQuiet(id);
        },
        [current, dismiss, markAsReadQuiet],
    );

    const position = getNotchPosition();

    const hasDetail = !!current && (!!current.body || !!current.dest);
    const expanded =
        open &&
        hover &&
        !!current &&
        (hasDetail || (current.actions?.length ?? 0) > 0);

    const actions = current?.actions ?? [];

    const expandedHeight = useMemo(() => {
        const detailH = hasDetail
            ? 10 + // divider padding-top
              (current?.body ? 38 : 0) +
              (current?.dest ? (current?.body ? 22 : 18) : 0)
            : 0;
        const base = COMPACT_H + detailH;
        const actionRow = actions.length > 0 || current?.link ? 58 : 0;
        return base + actionRow;
    }, [current, hasDetail, actions.length]);

    const width = open ? (expanded ? EXPANDED_W : COMPACT_W) : REST_W;
    const height = open ? (expanded ? expandedHeight : COMPACT_H) : REST_H;
    const radius = open ? "14px" : "999px";

    const accent = current
        ? ACCENT_BY_SEVERITY[current.severity ?? "gray"]
        : "rgba(255,255,255,0.28)";

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") dismiss();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, dismiss]);

    const springTransition = reducedMotion
        ? { duration: 0.12, ease: "easeInOut" as const }
        : { type: "spring" as const, stiffness: 380, damping: 30 };

    const contextValue = useMemo(
        () => ({ push, dismiss }),
        [push, dismiss],
    );

    if (!current) {
        return (
            <NotificationAlertContext.Provider value={contextValue}>
                {children}
            </NotificationAlertContext.Provider>
        );
    }

    return (
        <NotificationAlertContext.Provider value={contextValue}>
            {children}
            <div style={wrapperStyle(position)}>
                <div style={{ position: "relative", pointerEvents: "auto" }}>
                    <motion.div
                        role="status"
                        aria-live={
                            current?.severity === "red" ? "assertive" : "polite"
                        }
                        onMouseEnter={onEnter}
                        onMouseLeave={onLeave}
                        onFocus={onEnter}
                        onBlur={onBlur}
                        tabIndex={0}
                        animate={{
                            width,
                            height,
                            scale: pulse && !reducedMotion ? 1.035 : 1,
                        }}
                        transition={springTransition}
                        style={{
                            background: T.NAVY,
                            color: T.WHITE,
                            borderRadius: radius,
                            overflow: "hidden",
                            position: "relative",
                            transformOrigin: "top center",
                            boxShadow: "0 18px 44px rgba(22,41,77,0.26)",
                            cursor: "default",
                            fontFamily: REDESIGN_FONT_STACK,
                        }}
                    >
                        <AnimatePresence mode="popLayout" initial={false}>
                            {current && open && (
                                <motion.div
                                    key={current.id ?? current.title}
                                    initial={{
                                        opacity: 0,
                                        y: reducedMotion ? 0 : -8,
                                    }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{
                                        opacity: 0,
                                        y: reducedMotion ? 0 : -8,
                                    }}
                                    transition={{
                                        duration: reducedMotion ? 0.12 : 0.2,
                                        delay: reducedMotion ? 0 : 0.06,
                                    }}
                                    style={{ padding: "0 14px" }}
                                >
                                    <div
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 11,
                                            height: 60,
                                        }}
                                    >
                                        <span
                                            style={{
                                                width: 30,
                                                height: 30,
                                                borderRadius: 8,
                                                background: accentTintBackground(accent),
                                                display: "inline-flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                            }}
                                        >
                                            <svg
                                                aria-hidden="true"
                                                width={14}
                                                height={14}
                                                viewBox="0 0 24 24"
                                                fill="none"
                                                stroke={accent}
                                                strokeWidth={2}
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                            >
                                                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                                                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                            </svg>
                                        </span>
                                        <span style={{ minWidth: 0, flex: 1 }}>
                                            <span
                                                style={{
                                                    display: "block",
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {current.title}
                                            </span>
                                            <span
                                                style={{
                                                    display: "block",
                                                    fontSize: 12,
                                                    color: "rgba(255,255,255,0.6)",
                                                    marginTop: 1,
                                                    whiteSpace: "nowrap",
                                                    overflow: "hidden",
                                                    textOverflow: "ellipsis",
                                                }}
                                            >
                                                {current.meta}
                                            </span>
                                        </span>
                                        <span
                                            style={{
                                                fontFamily:
                                                    "'IBM Plex Mono', monospace",
                                                fontSize: 11,
                                                color: "rgba(255,255,255,0.4)",
                                                flexShrink: 0,
                                            }}
                                        >
                                            {current.timeAgo ?? "now"}
                                        </span>
                                    </div>

                                    <div
                                        style={{
                                            opacity: expanded ? 1 : 0,
                                            transition: `opacity 200ms ease ${expanded ? "120ms" : "0ms"}`,
                                        }}
                                    >
                                        {hasDetail && (
                                            <div
                                                style={{
                                                    borderTop:
                                                        "1px solid rgba(255,255,255,0.1)",
                                                    paddingTop: 10,
                                                }}
                                            >
                                                {current.body && (
                                                    <div
                                                        style={{
                                                            fontSize: 12.5,
                                                            lineHeight: 1.45,
                                                            color: "rgba(255,255,255,0.66)",
                                                            display:
                                                                "-webkit-box",
                                                            WebkitLineClamp: 2,
                                                            WebkitBoxOrient:
                                                                "vertical",
                                                            overflow: "hidden",
                                                        }}
                                                    >
                                                        {current.body}
                                                    </div>
                                                )}
                                                {current.dest && (
                                                    <div
                                                        style={{
                                                            fontFamily:
                                                                "'IBM Plex Mono', monospace",
                                                            fontSize: 11,
                                                            color: "rgba(255,255,255,0.42)",
                                                            marginTop:
                                                                current.body
                                                                    ? 4
                                                                    : 0,
                                                        }}
                                                    >
                                                        → {current.dest}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                        {(actions.length > 0 || expanded) && (
                                            <div
                                                aria-hidden={!expanded}
                                                style={{
                                                    opacity: expanded ? 1 : 0,
                                                    transition: `opacity 200ms ease ${expanded ? "120ms" : "0ms"}`,
                                                    display: "flex",
                                                    gap: 8,
                                                    alignItems: "center",
                                                    marginTop: 10,
                                                    paddingBottom: 14,
                                                }}
                                            >
                                                {actions.map((action) => (
                                                    <button
                                                        key={action.label}
                                                        type="button"
                                                        tabIndex={
                                                            expanded ? 0 : -1
                                                        }
                                                        onClick={handleActionClick(
                                                            action,
                                                        )}
                                                        style={{
                                                            appearance: "none",
                                                            fontFamily: "inherit",
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            whiteSpace: "nowrap",
                                                            color: action.primary
                                                                ? T.NAVY
                                                                : T.WHITE,
                                                            background: action.primary
                                                                ? T.WHITE
                                                                : "rgba(255,255,255,0.14)",
                                                            border: "none",
                                                            borderRadius: 8,
                                                            padding: "0 16px",
                                                            height: 34,
                                                            cursor: "pointer",
                                                            flexShrink: 0,
                                                        }}
                                                    >
                                                        {action.label}
                                                    </button>
                                                ))}
                                                {actions.length === 0 &&
                                                    current.link && (
                                                        <button
                                                            type="button"
                                                            tabIndex={
                                                                expanded ? 0 : -1
                                                            }
                                                            onClick={
                                                                handleOpenClick
                                                            }
                                                            style={{
                                                                appearance:
                                                                    "none",
                                                                fontFamily:
                                                                    "inherit",
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                whiteSpace:
                                                                    "nowrap",
                                                                color: T.NAVY,
                                                                background:
                                                                    T.WHITE,
                                                                border: "none",
                                                                borderRadius: 8,
                                                                padding:
                                                                    "0 16px",
                                                                height: 34,
                                                                cursor: "pointer",
                                                            }}
                                                        >
                                                            Open
                                                        </button>
                                                    )}
                                                <button
                                                    type="button"
                                                    tabIndex={
                                                        expanded ? 0 : -1
                                                    }
                                                    onClick={handleDismissClick}
                                                    style={{
                                                        appearance: "none",
                                                        fontFamily: "inherit",
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        whiteSpace: "nowrap",
                                                        flexShrink: 0,
                                                        marginLeft: "auto",
                                                        color: T.TEXT_MUTED,
                                                        background: T.WHITE,
                                                        border: `1px solid ${T.BORDER}`,
                                                        borderRadius: 8,
                                                        padding: "9px 16px",
                                                        minHeight: 32,
                                                        cursor: "pointer",
                                                    }}
                                                >
                                                    Dismiss
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </NotificationAlertContext.Provider>
    );
}
