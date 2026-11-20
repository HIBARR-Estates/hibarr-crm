import {
    type KeyboardEvent,
    type MouseEvent,
    type ReactNode,
    useEffect,
    useState,
    useSyncExternalStore,
} from "react";
import { PhoneOutlined } from "@ant-design/icons";
import { App, Dropdown, type MenuProps, message, Tooltip } from "antd";
import { usePage } from "@inertiajs/react";
import { softphone } from "@/lib/softphone/SoftphoneClient";
import useClickToCall from "@/Hooks/useClickToCall";
import useTranslation from "@/Hooks/useTranslation";
import useSoftphone, { canPlaceCrmCall } from "@/Hooks/useSoftphone";
import axios from "axios";
import type { TelephonyCallEntity } from "@/Types/api/telephony";
import type { LeadCallPhone } from "@/lib/leadCallPhones";

interface ClickToCallButtonProps {
    phone: string;
    /**
     * When a lead has more than one number, the click opens this list instead
     * of dialling `phone`. A single entry behaves like `phone` alone.
     */
    phones?: LeadCallPhone[];
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
 * before dialing. When `phones` lists more than one number, the click
 * opens that list first.
 */
export default function ClickToCallButton({
    phone,
    phones,
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
    const { message: appMessage } = App.useApp();
    const toast = appMessage ?? message;
    const { isEnabled: olEnabled, initiateCall, isCalling } = useClickToCall();
    const {
        isEnabled: softphoneFeatureEnabled,
        devices,
        activeDeviceId,
        call: softphoneCall,
        isReady: softphoneIsReady,
    } = useSoftphone();
    const softphoneEnabled =
        softphoneFeatureEnabled &&
        props.featureFlags?.["crm.softphone"] === true;
    const canDial = canPlaceCrmCall({
        softphoneEnabled,
        user: props.auth?.user,
        permissions: props.auth?.permissions,
        deviceCount: devices.length,
        clickToCallEnabled: olEnabled,
    });
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
    const numberChoices = (phones ?? [])
        .map((item) => ({ labelKey: item.labelKey, phone: item.phone.trim() }))
        .filter((item) => item.phone);
    if (numberChoices.length === 0 && trimmedPhone) {
        numberChoices.push({ labelKey: "", phone: trimmedPhone });
    }
    // Softphone when this user has a line; otherwise the 3CX bridge.
    // Anyone else sees nothing — no tel: fallback.
    const useSoftphonePath =
        canDial && softphoneEnabled && devices.length > 0;
    const multipleLines = useSoftphonePath && devices.length > 1;

    if (!canDial || numberChoices.length === 0) {
        return null;
    }

    const dialTarget = numberChoices[0].phone;

    const loading = useSoftphonePath
        ? dialing
        : numberChoices.some((choice) => isCalling(choice.phone, entity));
    const cooldownSuffix = cooling ? ` (${coolingRemaining}s)` : "";

    const makeCall = (targetPhone: string, deviceId?: number) => {
        const normalizedTarget = targetPhone.trim();
        if (loading || cooling || !normalizedTarget) {
            return;
        }
        setMenuOpen(false);

        if (useSoftphonePath) {
            if (
                typeof navigator === "undefined" ||
                !navigator.mediaDevices ||
                !window.isSecureContext
            ) {
                toast.error(t("pages.telephony.insecure_context"));
                return;
            }
            if (
                devices.length === 0 &&
                typeof deviceId !== "number" &&
                !softphoneReady
            ) {
                toast.warning(
                    t("pages.telephony.softphone_not_registered"),
                );
                return;
            }
            const normalizedPhone = normalizedTarget
                .replace(/[^\d+]/g, "")
                .replace(/(?!^)\+/g, "");
            setDialing(true);
            void softphoneCall(
                normalizedPhone,
                entity.type === "lead" ? { leadId: entity.id } : null,
                deviceId,
            )
                .then(() => {
                    toast.info(
                        t("pages.telephony.calling_number", {
                            phone: normalizedPhone,
                        }),
                    );
                    void axios
                        .post(route("telephony.softphone.events.store"), {
                            phone: normalizedPhone,
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
                    toast.error(detail || t("pages.telephony.generic_error"));
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

        void initiateCall(normalizedTarget, entity);
    };

    const handleClick = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        makeCall(dialTarget);
    };

    const lineChoices = (targetPhone: string) =>
        devices.map((d) => ({
            key: `${targetPhone}-${d.id}`,
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
            onClick: ({ domEvent }: { domEvent: MouseEvent | KeyboardEvent }) => {
                domEvent.stopPropagation();
                makeCall(targetPhone, d.id);
            },
        }));

    const numberLabel = (choice: { labelKey: string; phone: string }) => (
        <span className="flex min-w-[180px] flex-col leading-tight">
            {choice.labelKey ? (
                <span className="text-[13px] font-medium">{t(choice.labelKey)}</span>
            ) : null}
            <span className="text-[12px] opacity-70">{choice.phone}</span>
        </span>
    );

    const menuItems: MenuProps["items"] =
        numberChoices.length > 1
            ? [
                  {
                      key: "select-number-group",
                      type: "group",
                      label: t("pages.telephony.select_number"),
                      children: numberChoices.map((choice) =>
                          multipleLines
                              ? {
                                    key: choice.phone,
                                    label: numberLabel(choice),
                                    children: lineChoices(choice.phone),
                                }
                              : {
                                    key: choice.phone,
                                    disabled: loading || cooling,
                                    label: numberLabel(choice),
                                    onClick: ({ domEvent }) => {
                                        domEvent.stopPropagation();
                                        makeCall(choice.phone);
                                    },
                                },
                      ),
                  },
              ]
            : [
                  {
                      key: "select-line-group",
                      type: "group",
                      label: t("pages.telephony.select_line"),
                      children: lineChoices(dialTarget),
                  },
              ];

    const showMenu = numberChoices.length > 1 || multipleLines;

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

        if (showMenu) {
            return (
                <Dropdown
                    menu={{ items: menuItems }}
                    trigger={["click"]}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    disabled={loading || cooling}
                >
                    <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        disabled={loading || cooling}
                        className={className}
                        title={title}
                        aria-label={ariaLabel ?? title}
                        data-action={dataAction}
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

    if (showMenu) {
        return (
            <Tooltip title={title ?? t("pages.telephony.call")}>
                <Dropdown
                    menu={{ items: menuItems }}
                    trigger={["click"]}
                    open={menuOpen}
                    onOpenChange={setMenuOpen}
                    disabled={loading || cooling}
                >
                    <PhoneOutlined
                        role="button"
                        aria-label={ariaLabel ?? title ?? t("pages.telephony.call")}
                        data-action={dataAction}
                        onClick={(e) => e.stopPropagation()}
                        className={`mt-1 flex-shrink-0 cursor-pointer text-[11px] text-green-600 opacity-0 transition-opacity hover:text-green-700 group-hover:opacity-100 ${
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
