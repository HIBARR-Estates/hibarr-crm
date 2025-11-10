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
import StartConversationDrawer from "./modals/StartConversationDrawer";
import AddFollowup from "../Tabs/followups/AddFollowup";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function QuickActions({ deal, permissions }: Props) {
    const { message: messageApi } = App.useApp();
    const [conversationModalOpen, setConversationModalOpen] = useState(false);
    const [meetingModalOpen, setMeetingModalOpen] = useState(false);
    const [selectedChannelType, setSelectedChannelType] = useState<string>("");
    const [selectedAction, setSelectedAction] = useState<string | number>("");

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
            value: "email",
            icon: <MailOutlined style={{ color: "#aaa" }} />,
            label: "Email",
        },
        {
            value: "whatsapp",
            icon: <WhatsAppOutlined style={{ color: "#25D366" }} />,
            label: "WhatsApp",
        },
        {
            value: "phone",
            icon: <PhoneOutlined style={{ color: "#52c41a" }} />,
            label: "Call",
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
        })
    );

    const handleSegmentChange = (value: string | number) => {
        setSelectedAction(value);
        handleQuickAction(value as string);
        // Reset selection after a short delay to avoid visual feedback issues
        setTimeout(() => setSelectedAction(""), 100);
    };

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
                        // type="text"
                        shape="circle"
                        icon={<EllipsisOutlined />}
                        size="small"
                        className="border border-gray-200 hover:border-blue-400 hover:shadow-sm transition-all duration-200"
                        // style={{ width: 40, height: 40 }}
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
                open={meetingModalOpen}
                onClose={() => setMeetingModalOpen(false)}
                deal={deal}
            />
        </>
    );
}
