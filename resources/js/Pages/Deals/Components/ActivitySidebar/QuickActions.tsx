import { Deal } from "@/Types/api/deals";
import { Button, Dropdown, App, Segmented } from "antd";
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
import type { MenuProps, SegmentedProps } from "antd";
import { useState } from "react";
import { usePage } from "@inertiajs/react";
import axios from "axios";
import StartConversationDrawer from "./modals/StartConversationDrawer";
import AddFollowup from "../Tabs/followups/AddFollowup";
import useTranslation from "@/Hooks/useTranslation";
import useClickToCall from "@/Hooks/useClickToCall";
import useSoftphone, { canMakeSoftphoneCalls } from "@/Hooks/useSoftphone";
import { resolveLeadPhoneDisplay } from "@/lib/utils";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function QuickActions({ deal, permissions }: Props) {
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
    const [selectedAction, setSelectedAction] = useState<string | number>("");

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
                } else
                    messageApi.warning(t("pages.deals.quick_actions.no_email"));
                break;
            case "whatsapp":
                if (contact.mobile) {
                    setSelectedChannelType("whatsapp");
                    setConversationModalOpen(true);
                } else
                    messageApi.warning(t("pages.deals.quick_actions.no_phone"));
                break;
            case "phone":
                placeCall();
                break;
            case "telegram":
                if (contact.client_telegram) {
                    setSelectedChannelType("telegram");
                    setConversationModalOpen(true);
                } else
                    messageApi.warning(
                        t("pages.deals.quick_actions.no_telegram"),
                    );
                break;
            case "instagram":
                if (contact.client_instagram) {
                    setSelectedChannelType("instagram");
                    setConversationModalOpen(true);
                } else
                    messageApi.warning(
                        t("pages.deals.quick_actions.no_instagram"),
                    );
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
                onClick: ({ domEvent }) => {
                    domEvent.stopPropagation();
                    placeCall(d.id);
                },
            })),
        },
    ];

    const primaryActions = [
        {
            value: "email",
            icon: <MailOutlined style={{ color: "#aaa" }} />,
            label: t("pages.deals.quick_actions.email_label"),
        },
        {
            value: "whatsapp",
            icon: <WhatsAppOutlined style={{ color: "#25D366" }} />,
            label: "WhatsApp",
        },
        {
            value: "phone",
            icon: hasLineChoice ? (
                <Dropdown menu={{ items: lineMenuItems }} trigger={["click"]}>
                    <span
                        onClick={(e) => {
                            // Keep the icon click from also selecting the
                            // segment (native label activation) and dialing.
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        className="inline-flex items-center justify-center"
                    >
                        <PhoneOutlined style={{ color: "#52c41a" }} />
                    </span>
                </Dropdown>
            ) : (
                <PhoneOutlined style={{ color: "#52c41a" }} />
            ),
            label: t("pages.deals.quick_actions.call_label"),
        },
        {
            value: "telegram",
            icon: <MessageOutlined style={{ color: "#0088cc" }} />,
            label: "Telegram",
        },
        {
            value: "instagram",
            icon: <InstagramOutlined style={{ color: "#E4405F" }} />,
            label: "Instagram",
        },
    ];

    const segmentedOptions: SegmentedProps["options"] = primaryActions.map(
        (action) => ({
            value: action.value,
            icon: action.icon,
            title: action.label,
        }),
    );

    const handleSegmentChange = (value: string | number) => {
        setSelectedAction(value);
        // Selecting Call — by clicking its label or with the keyboard — dials
        // on the active line, also when several lines exist; the icon
        // dropdown stays the way to pick a specific line. Without this the
        // option was a dead end for keyboard users and label clicks.
        handleQuickAction(value as string);
        // Reset selection after a short delay to avoid visual feedback issues
        setTimeout(() => setSelectedAction(""), 100);
    };

    const secondaryActions: MenuProps["items"] = [
        {
            key: "conversation",
            label: t("pages.deals.quick_actions.new_conversation"),
            icon: <PlusOutlined />,
            onClick: () => handleQuickAction("conversation"),
        },
        {
            key: "meeting",
            label: t("app.deals.actions.schedule_meeting"),
            icon: <CalendarOutlined />,
            onClick: () => handleQuickAction("meeting"),
        },
    ];

    return (
        <>
            <div className="flex items-center justify-between gap-3 ">
                {/* Primary actions using Segmented */}
                <div className="flex-1">
                    <Segmented
                        options={segmentedOptions}
                        value={selectedAction}
                        onChange={handleSegmentChange}
                        size="large"
                        className="w-full"
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: "8px",
                            border: "1px solid #d9d9d9",
                        }}
                    />
                </div>

                {/* Dropdown for secondary actions */}
                <Dropdown
                    menu={{ items: secondaryActions }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <Button
                        shape="circle"
                        icon={<EllipsisOutlined />}
                        size="small"
                        className="border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all duration-200"
                    />
                </Dropdown>
            </div>

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

            <AddFollowup
                context="deal"
                open={meetingModalOpen}
                onClose={() => setMeetingModalOpen(false)}
                deal={deal}
            />
        </>
    );
}
