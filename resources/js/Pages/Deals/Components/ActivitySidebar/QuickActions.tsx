import { Deal } from "@/Types/api/deals";
import { Button, Tooltip, Dropdown, App } from "antd";
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
import StartConversationModal from "./modals/StartConversationModal";
import ScheduleMeetingModal from "./modals/ScheduleMeetingModal";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function QuickActions({ deal, permissions }: Props) {
    const { message: messageApi } = App.useApp();
    const [conversationModalOpen, setConversationModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [selectedChannelType, setSelectedChannelType] = useState<string>("");

    const handleQuickAction = (action: string) => {
        const contact = deal.contact;
        if (!contact) return;

        switch (action) {
            case "email":
                if (contact.client_email) {
                    setSelectedChannelType("email");
                    setConversationModalOpen(true);
                } else messageApi.warning("Contact has no email address");
                break;
            case "whatsapp":
                if (contact.mobile) {
                    setSelectedChannelType("whatsapp");
                    setConversationModalOpen(true);
                } else messageApi.warning("Contact has no phone number");
                break;
            case "phone":
                if (contact.mobile) {
                    let mobile = contact.mobile;
                    if (
                        typeof mobile === "string" &&
                        mobile.trim().startsWith("{")
                    ) {
                        try {
                            const mobileData = JSON.parse(mobile.trim());
                            mobile = mobileData?.phone || mobile;
                        } catch {}
                    }
                    window.open(
                        `tel:${mobile.replace(/[^\d+]/g, "")}`,
                        "_blank"
                    );
                } else messageApi.warning("Contact has no phone number");
                break;
            case "telegram":
                if (contact.client_telegram) {
                    setSelectedChannelType("telegram");
                    setConversationModalOpen(true);
                } else messageApi.warning("Contact has no Telegram username");
                break;
            case "instagram":
                if (contact.client_instagram) {
                    setSelectedChannelType("instagram");
                    setConversationModalOpen(true);
                } else messageApi.warning("Contact has no Instagram username");
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

    const primaryActions = [
        {
            key: "email",
            icon: <MailOutlined />,
            color: "#1890ff",
            title: "Email",
        },
        {
            key: "whatsapp",
            icon: <WhatsAppOutlined />,
            color: "#25D366",
            title: "WhatsApp",
        },
        {
            key: "phone",
            icon: <PhoneOutlined />,
            color: "#52c41a",
            title: "Call",
        },
        {
            key: "telegram",
            icon: <MessageOutlined />,
            color: "#0088cc",
            title: "Telegram",
        },
        {
            key: "instagram",
            icon: <InstagramOutlined />,
            color: "#E4405F",
            title: "Instagram",
        },
    ];

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
        },
    ];

    return (
        <>
            <div className="flex items-center justify-between gap-2 py-1">
                {/* Primary quick action buttons */}
                <div className="flex items-center gap-1.5 flex-1">
                    {primaryActions.map((action) => (
                        <Tooltip key={action.key} title={action.title}>
                            <Button
                                type="text"
                                shape="circle"
                                icon={action.icon}
                                size="large"
                                className="flex items-center justify-center border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all duration-200"
                                // style={{
                                //     width: 34,
                                //     height: 34,
                                //     color: action.color,
                                // }}
                                onClick={() => handleQuickAction(action.key)}
                            />
                        </Tooltip>
                    ))}
                </div>

                {/* Dropdown for secondary actions */}
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
                        className="border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all duration-200"
                        style={{ width: 34, height: 34 }}
                    />
                </Dropdown>
            </div>

            {/* Modals */}
            <StartConversationModal
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
