import { type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { PhoneOutlined } from "@ant-design/icons";
import { Dropdown, type MenuProps, message, Tooltip } from "antd";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import useClickToCall from "@/Hooks/useClickToCall";
import useTranslation from "@/Hooks/useTranslation";
import useSoftphone from "@/Hooks/useSoftphone";
import axios from "axios";
import type { TelephonyCallEntity } from "@/Types/api/telephony";

interface ClickToCallButtonProps {
    phone: string;
    entity: TelephonyCallEntity;
    className?: string;
    /** Inline icon-only (DetailField) vs full-width label (Deal surfaces). */
    variant?: "icon" | "link";
    label?: string;
    title?: string;
    ariaLabel?: string;
    dataAction?: string;
    children?: ReactNode;
}

/**
 * Beside a phone number: originate a call. When the in-browser softphone is
 * on it dials via sipgate (audio in the tab); otherwise it falls back to the
 * OL click-to-call bridge. When multiple softphone lines are configured,
 * clicking opens a line selector and switches/registers the chosen line
 * before dialing.
 */
export default function ClickToCallButton({
    phone,
    entity,
    className = "",
    variant = "icon",
    label,
    title,
    ariaLabel,
    dataAction,
    children,
}: ClickToCallButtonProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const { isEnabled: olEnabled, initiateCall, isCalling } = useClickToCall();
    const {
        isEnabled: softphoneFeatureEnabled,
        devices,
        hasLine,
        activeDeviceId,
        call: softphoneCall,
        isReady: softphoneIsReady,
    } = useSoftphone();
    const softphoneEnabled =
        softphoneFeatureEnabled &&
        props.featureFlags?.["crm.softphone"] === true;
    const permissionValue = props.auth?.permissions?.make_softphone_calls;
    const hasCallPermission =
        permissionValue === "all" || permissionValue === "added";
    const [dialing, setDialing] = useState(false);
    const [cooling, setCooling] = useState(false);
    const [coolingRemaining, setCoolingRemaining] = useState(0);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        if (!cooling) {
            setCoolingRemaining(0);
            return;
        }
        let remaining = 5;
        setCoolingRemaining(remaining);
        const id = window.setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                setCooling(false);
                window.clearInterval(id);
            } else {
                setCoolingRemaining(remaining);
            }
        }, 1000);
        return () => {
            window.clearInterval(id);
        };
    }, [cooling]);

    const registration = useSyncExternalStore(
        (listener) => softphone.subscribe(listener),
        () => softphone.getState().registration,
        () => softphone.getState().registration,
    );
    const softphoneReady = registration === "registered" || softphoneIsReady;

    const trimmedPhone = phone.trim();
    // The softphone is the path that needs make_softphone_calls; the 3CX/OL
    // path is gated by its own flag, so requiring the permission here locked
    // agents without it out of both.
    // Users with no assigned line (Call routing) cannot dial through the
    // softphone, so the button falls back to a plain tel: link for them.
    const useSoftphonePath = softphoneEnabled && hasCallPermission && hasLine;
    const useTelFallback = softphoneEnabled && hasCallPermission && !hasLine;

    if ((!useSoftphonePath && !olEnabled && !useTelFallback) || !trimmedPhone) {
        return null;
    }

    const loading = useSoftphonePath
        ? dialing
        : isCalling(trimmedPhone, entity);
    const cooldownSuffix = cooling ? ` (${coolingRemaining}s)` : "";

    const makeCallWithDevice = (deviceId?: number) => {
        if (loading || cooling) {
            return;
        }
        setMenuOpen(false);

        if (useSoftphonePath) {
            if (
                typeof navigator === "undefined" ||
                !navigator.mediaDevices ||
                !window.isSecureContext
            ) {
                message.error(t("pages.telephony.insecure_context"));
                return;
            }
            if (
                devices.length === 0 &&
                typeof deviceId !== "number" &&
                !softphoneReady
            ) {
                message.warning(
                    t("pages.telephony.softphone_not_registered"),
                );
                return;
            }
            setDialing(true);
            void softphoneCall(
                trimmedPhone,
                entity.type === "lead" ? { leadId: entity.id } : null,
                deviceId,
            )
                .then(() => {
                    message.info(
                        t("pages.telephony.calling_number", {
                            phone: trimmedPhone,
                        }),
                    );
                    void axios
                        .post(route("telephony.softphone.events.store"), {
                            phone: trimmedPhone,
                            entity_type: entity.type,
                            entity_id: entity.id,
                            event: "call.started",
                        })
                        .catch(() => {
                            // Timeline logging is best-effort only.
                        });
                })
                .catch((error: unknown) => {
                    const detail =
                        error instanceof Error ? error.message?.trim() : "";
                    message.error(detail || t("pages.telephony.generic_error"));
                    if (
                        detail &&
                        (detail.includes("603") ||
                            detail.toLowerCase().includes("decline"))
                    ) {
                        setCooling(true);
                    }
                })
                .finally(() => setDialing(false));
            return;
        }

        if (useTelFallback) {
            window.location.href = `tel:${trimmedPhone.replace(/[^\d+]/g, "")}`;
            return;
        }

        void initiateCall(trimmedPhone, entity);
    };

    const handleClick = () => makeCallWithDevice();

    const lineMenuItems: MenuProps["items"] = [
        {
            key: "select-line-group",
            type: "group",
            label: t("pages.telephony.select_line"),
            children: devices.map((d) => ({
                key: String(d.id),
                disabled: loading || cooling,
                label: (
                    <span className="flex items-center justify-between gap-3">
                        <span>{d.label}</span>
                        {activeDeviceId === d.id && (
                            <span className="text-[11px] text-emerald-600">
                                {t("pages.telephony.active_line_badge")}
                            </span>
                        )}
                    </span>
                ),
                onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    makeCallWithDevice(d.id);
                },
            })),
        },
    ];

    if (variant === "link") {
        const defaultContent = (
            <>
                <PhoneOutlined className="mr-1" />
                {cooling
                    ? `${label ?? t("pages.telephony.call")}${cooldownSuffix}`
                    : (label ?? t("pages.telephony.call"))}
            </>
        );
        const buttonContent = children ? (
            <>
                {children}
                {cooling ? cooldownSuffix : ""}
            </>
        ) : (
            defaultContent
        );

        if (useSoftphonePath && devices.length > 1) {
            return (
                <Dropdown
                    menu={{ items: lineMenuItems }}
                    trigger={["click"]}
                    disabled={loading || cooling}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                >
                    <button
                        type="button"
                        disabled={loading || cooling}
                        className={className}
                        title={title}
                        aria-label={ariaLabel ?? title}
                        data-action={dataAction}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {buttonContent}
                    </button>
                </Dropdown>
            );
        }
        return (
            <button
                type="button"
                onClick={handleClick}
                disabled={loading || cooling}
                className={className}
                title={title}
                aria-label={ariaLabel ?? title}
                data-action={dataAction}
            >
                {buttonContent}
            </button>
        );
    }

    if (useSoftphonePath && devices.length > 1) {
        return (
            <Tooltip title={title ?? t("pages.telephony.call")}>
                <Dropdown
                    menu={{ items: lineMenuItems }}
                    trigger={["click"]}
                    disabled={loading || cooling}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                >
                    <PhoneOutlined
                        role="button"
                        aria-label={ariaLabel ?? title ?? t("pages.telephony.call")}
                        data-action={dataAction}
                        onClick={(e) => e.stopPropagation()}
                        className={`mt-1 flex-shrink-0 cursor-pointer text-[11px] text-green-600 transition-opacity hover:text-green-700 group-hover:opacity-100 ${
                            menuOpen ? "opacity-100" : "opacity-0"
                        } ${
                            loading ? "pointer-events-none opacity-50" : ""
                        } ${className}`}
                    />
                </Dropdown>
            </Tooltip>
        );
    }

    return (
        <Tooltip title={title ?? t("pages.telephony.call")}>
            <PhoneOutlined
                role="button"
                aria-label={ariaLabel ?? title ?? t("pages.telephony.call")}
                data-action={dataAction}
                className={`mt-1 flex-shrink-0 cursor-pointer text-[11px] text-green-600 opacity-0 transition-opacity hover:text-green-700 group-hover:opacity-100 ${
                    loading ? "pointer-events-none opacity-50" : ""
                } ${className}`}
                onClick={handleClick}
            />
        </Tooltip>
    );
}
