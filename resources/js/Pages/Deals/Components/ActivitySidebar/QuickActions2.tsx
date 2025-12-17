import { Deal } from "@/Types/api/deals";
import { Card, Button, Tooltip, Dropdown, message, Modal, App } from "antd";
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
import StartConversationDrawer from "./modals/StartConversationDrawer";
import ScheduleMeetingModal from "./modals/ScheduleMeetingModal";

interface Props {
    deal: Deal;
    permissions: Record<string, string>;
}

export default function QuickActions2({ deal, permissions }: Props) {
    const { message: messageApi, modal } = App.useApp();
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
                } else {
                    messageApi.warning("Contact has no email address");
                }
                break;
            case "whatsapp":
                if (contact.mobile) {
                    setSelectedChannelType("whatsapp");
                    setConversationModalOpen(true);
                } else {
                    messageApi.warning("Contact has no phone number");
                }
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
                        } catch (e) {
                            // Use original mobile
                        }
                    }
                    window.open(
                        `tel:${mobile.replace(/[^\d+]/g, "")}`,
                        "_blank"
                    );
                } else {
                    messageApi.warning("Contact has no phone number");
                }
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

    // Primary actions (most commonly used)
    const primaryActions = [
        {
            key: "email",
            icon: <MailOutlined />,
            title: "Email",
            color: "#1890ff",
            // disabled: !deal.contact?.client_email,
        },
        {
            key: "whatsapp",
            icon: <WhatsAppOutlined />,
            title: "WhatsApp",
            color: "#25D366",
            // disabled: !deal.contact?.mobile,
        },
        {
            key: "phone",
            icon: <PhoneOutlined />,
            title: "Call",
            color: "#52c41a",
            // disabled: !deal.contact?.mobile,
        },
        {
            key: "telegram",
            label: "Telegram",
            icon: <MessageOutlined />,
            color: "#0088cc",
            // disabled: !deal.contact?.client_telegram,
        },
        {
            key: "instagram",
            label: "Instagram",
            icon: <InstagramOutlined />,
            color: "#E4405F",
            // disabled: !deal.contact?.client_instagram,
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
                        {primaryActions.map((action) => (
                            <Tooltip key={action.key} title={action.title}>
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
                                    onClick={() =>
                                        handleQuickAction(action.key)
                                    }
                                    disabled={action?.disabled}
                                />
                            </Tooltip>
                        ))}
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
