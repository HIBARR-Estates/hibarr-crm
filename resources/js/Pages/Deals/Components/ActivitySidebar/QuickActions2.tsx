import { Deal } from "@/Types/api/deals";
import { Card, Button, Tooltip, Dropdown, App } from "antd";
import {
    PhoneOutlined,
    MessageOutlined,
    MailOutlined,
    InstagramOutlined,
    WhatsAppOutlined,
    PlusOutlined,
    CalendarOutlined,
    EllipsisOutlined,
} from "@ant-design/icons";
import type { MenuProps } from "antd";
import { useState } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import StartConversationDrawer from "./modals/StartConversationDrawer";
import ScheduleMeetingModal from "./modals/ScheduleMeetingModal";
import useTranslation from "@/Hooks/useTranslation";
import useClickToCall from "@/Hooks/useClickToCall";
import useSoftphone, { canMakeSoftphoneCalls } from "@/Hooks/useSoftphone";
import { resolveLeadPhoneDisplay } from "@/lib/utils";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function QuickActions2({ deal, permissions }: Props) {
    const { message: messageApi } = App.useApp();
    const { t } = useTranslation();
    const { props } = usePage();
    const { isEnabled: olEnabled, initiateCall } = useClickToCall();
    const {
        isEnabled: softphoneFeatureEnabled,
        devices,
        hasLine,
        activeDeviceId,
        call: softphoneCall,
    } = useSoftphone();
    const hasSoftphonePermission = canMakeSoftphoneCalls(
        props.auth?.user,
        props.auth?.permissions,
    );
    const useSoftphonePath =
        softphoneFeatureEnabled &&
        props.featureFlags?.["crm.softphone"] === true &&
        hasSoftphonePermission &&
        hasLine;
    // No assigned line (Call routing): skip softphone/OL and use a tel: link.
    const noLineFallback =
        softphoneFeatureEnabled &&
        props.featureFlags?.["crm.softphone"] === true &&
        hasSoftphonePermission &&
        !hasLine;

    const [conversationModalOpen, setConversationModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [selectedChannelType, setSelectedChannelType] = useState<string>("");

    const contactPhone =
        resolveLeadPhoneDisplay(
            deal.contact?.mobile,
            deal.contact?.mobile_with_phonecode,
        ) ||
        resolveLeadPhoneDisplay(deal.contact?.cell) ||
        "";

    const placeCall = (deviceId?: number) => {
        if (!contactPhone) {
            messageApi.warning(t("pages.deals.quick_actions.no_phone"));
            return;
        }
        if (useSoftphonePath) {
            const dialingPhone = contactPhone.replace(/\s/g, "");
            void softphoneCall(
                dialingPhone,
                deal.contact?.id
                    ? {
                          leadId: deal.contact.id,
                          leadName: deal.contact.client_name ?? null,
                      }
                    : null,
                deviceId,
            )
                .then(() => {
                    messageApi.info(
                        t("pages.telephony.calling_number", {
                            phone: contactPhone,
                        }),
                    );
                    void axios
                        .post(route("telephony.softphone.events.store"), {
                            phone: contactPhone,
                            entity_type: "deal",
                            entity_id: deal.id,
                            event: "call.started",
                        })
                        .catch(() => undefined);
                })
                .catch((error: unknown) => {
                    const detail =
                        error instanceof Error ? error.message?.trim() : "";
                    messageApi.error(
                        detail || t("pages.telephony.generic_error"),
                    );
                });
            return;
        }
        if (olEnabled && !noLineFallback) {
            void initiateCall(contactPhone, { type: "deal", id: deal.id });
            return;
        }
        window.open(`tel:${contactPhone.replace(/[^\d+]/g, "")}`, "_blank");
    };

    const handleQuickAction = (action: string) => {
        const contact = deal.contact;
        if (!contact) return;

        switch (action) {
            case "email":
                if (contact.client_email) {
                    setSelectedChannelType("email");
                    setConversationModalOpen(true);
                } else {
                    messageApi.warning("Contact has no email address");
                }
                break;
            case "whatsapp":
                if (contact.mobile) {
                    setSelectedChannelType("whatsapp");
                    setConversationModalOpen(true);
                } else {
                    messageApi.warning(t("pages.deals.quick_actions.no_phone"));
                }
                break;
            case "phone":
                placeCall();
                break;
            case "telegram":
                if (contact.client_telegram) {
                    setSelectedChannelType("telegram");
                    setConversationModalOpen(true);
                } else {
                    messageApi.warning("Contact has no Telegram username");
                }
                break;
            case "instagram":
                if (contact.client_instagram) {
                    setSelectedChannelType("instagram");
                    setConversationModalOpen(true);
                } else {
                    messageApi.warning("Contact has no Instagram username");
                }
                break;
            case "conversation":
                setSelectedChannelType("");
                setConversationModalOpen(true);
                break;
            case "meeting":
                setMeetingModalOpen(true);
                break;
        }
    };

    const hasLineChoice =
        Boolean(contactPhone) && useSoftphonePath && devices.length > 1;

    const lineMenuItems: MenuProps["items"] = [
        {
            key: "select-line-group",
            type: "group",
            label: t("pages.telephony.select_line"),
            children: devices.map((d) => ({
                key: String(d.id),
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
                onClick: () => placeCall(d.id),
            })),
        },
    ];

    // Primary actions (most commonly used)
    const primaryActions = [
        {
            key: "email",
            icon: <MailOutlined />,
            title: "Email",
            color: "#1890ff",
        },
        {
            key: "whatsapp",
            icon: <WhatsAppOutlined />,
            title: "WhatsApp",
            color: "#25D366",
        },
        {
            key: "phone",
            icon: <PhoneOutlined />,
            title: "Call",
            color: "#52c41a",
        },
        {
            key: "telegram",
            label: "Telegram",
            icon: <MessageOutlined />,
            color: "#0088cc",
        },
        {
            key: "instagram",
            label: "Instagram",
            icon: <InstagramOutlined />,
            color: "#E4405F",
            disabled: false,
        },
    ];

    // Secondary actions (less commonly used)
    const secondaryActions: MenuProps["items"] = [
        {
            key: "conversation",
            label: "New Conversation",
            icon: <PlusOutlined />,
            onClick: () => handleQuickAction("conversation"),
        },
        {
            key: "meeting",
            label: "Schedule Meeting",
            icon: <CalendarOutlined />,
            onClick: () => handleQuickAction("meeting"),
            disabled: false,
        },
    ];

    return (
        <>
            <Card
                title="Quick Actions"
                size="small"
                className="shadow-sm border-0 rounded-lg overflow-hidden"
                bodyStyle={{ padding: "12px" }}
                variant="outlined"
            >
                <div className="flex items-center justify-between gap-2">
                    {/* Primary Actions - Horizontal Layout */}
                    <div className="flex items-center gap-2 flex-1">
                        {primaryActions.map((action) => {
                            const btn = (
                                <Button
                                    type="text"
                                    shape="circle"
                                    icon={action.icon}
                                    size="small"
                                    className="flex items-center justify-center border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                                    style={{
                                        width: "36px",
                                        height: "36px",
                                        color: action?.disabled
                                            ? undefined
                                            : action.color,
                                    }}
                                    onClick={
                                        action.key === "phone" && hasLineChoice
                                            ? undefined
                                            : () =>
                                                  handleQuickAction(action.key)
                                    }
                                    disabled={action?.disabled}
                                />
                            );
                            if (action.key === "phone" && hasLineChoice) {
                                return (
                                    <Tooltip key={action.key} title={action.title}>
                                        <Dropdown
                                            menu={{ items: lineMenuItems }}
                                            trigger={["click"]}
                                        >
                                            {btn}
                                        </Dropdown>
                                    </Tooltip>
                                );
                            }
                            return (
                                <Tooltip key={action.key} title={action.title}>
                                    {btn}
                                </Tooltip>
                            );
                        })}
                    </div>

                    {/* More Actions Dropdown */}
                    <Dropdown
                        menu={{ items: secondaryActions }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            shape="circle"
                            icon={<EllipsisOutlined />}
                            size="small"
                            className="border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all duration-200"
                            style={{ width: "36px", height: "36px" }}
                        />
                    </Dropdown>
                </div>
            </Card>

            {/* Modals */}
            <StartConversationDrawer
                open={conversationModalOpen}
                onClose={() => {
                    setConversationModalOpen(false);
                    setSelectedChannelType("");
                }}
                deal={deal}
                channelType={selectedChannelType}
            />

            <ScheduleMeetingModal
                open={meetingModalOpen}
                onClose={() => setMeetingModalOpen(false)}
                deal={deal}
            />
        </>
    );
}
