import { Deal } from "@/Types/api/deals";
import {
    Card,
    Timeline,
    Button,
    Avatar,
    Tooltip,
    Divider,
    Typography,
    Space,
    Empty,
} from "antd";
import {
    PhoneOutlined,
    MessageOutlined,
    MailOutlined,
    InstagramOutlined,
    WhatsAppOutlined,
    PlusOutlined,
    UserOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

const { Text, Paragraph } = Typography;

interface Props {
    deal: Deal;
    activities: any[];
    permissions: Record<string, string>;
}

export default function ActivitySidebar({
    deal,
    activities,
    permissions,
}: Props) {
    const handleQuickAction = (action: string) => {
        const contact = deal.contact;
        if (!contact) return;

        switch (action) {
            case "email":
                if (contact.client_email) {
                    window.open(`mailto:${contact.client_email}`, "_blank");
                }
                break;
            case "whatsapp":
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
                    const cleanMobile = mobile.replace(/[^\d+]/g, "");
                    window.open(`https://wa.me/${cleanMobile}`, "_blank");
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
                }
                break;
            case "telegram":
                // Handle telegram action
                console.log("Telegram action");
                break;
            case "instagram":
                // Handle instagram action
                console.log("Instagram action");
                break;
            case "conversation":
                // Handle new conversation
                console.log("Start new conversation");
                break;
        }
    };

    const getActivityIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case "email":
                return <MailOutlined className="text-blue-500" />;
            case "call":
            case "phone":
                return <PhoneOutlined className="text-green-500" />;
            case "whatsapp":
                return <WhatsAppOutlined className="text-green-500" />;
            case "message":
            case "sms":
                return <MessageOutlined className="text-purple-500" />;
            case "instagram":
                return <InstagramOutlined className="text-pink-500" />;
            default:
                return <MessageOutlined className="text-gray-500" />;
        }
    };

    const formatActivityDate = (timestamp: string) => {
        const date = dayjs(timestamp);
        const now = dayjs();

        if (date.isSame(now, "day")) {
            return `Today, ${date.format("h:mm A")}`;
        } else if (date.isSame(now.subtract(1, "day"), "day")) {
            return `Yesterday, ${date.format("h:mm A")}`;
        } else {
            return date.format("MMM DD, h:mm A");
        }
    };

    return (
        <div className="space-y-6">
            {/* Quick Actions Card */}
            <Card
                title={
                    <div className="flex items-center space-x-2">
                        <span className="text-lg font-semibold">
                            Quick Actions
                        </span>
                    </div>
                }
                className="shadow-sm border-0 rounded-lg overflow-hidden"
            >
                <div className="grid grid-cols-3 gap-2 sm:gap-3 quick-actions">
                    <Tooltip title="Send Email">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<MailOutlined />}
                            size="large"
                            className="w-full aspect-square"
                            onClick={() => handleQuickAction("email")}
                            disabled={!deal.contact?.client_email}
                        />
                    </Tooltip>

                    <Tooltip title="WhatsApp">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<WhatsAppOutlined />}
                            size="large"
                            className="w-full aspect-square"
                            style={{ backgroundColor: "#25D366" }}
                            onClick={() => handleQuickAction("whatsapp")}
                            disabled={!deal.contact?.mobile}
                        />
                    </Tooltip>

                    <Tooltip title="Phone Call">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<PhoneOutlined />}
                            size="large"
                            className="w-full aspect-square"
                            style={{ backgroundColor: "#52c41a" }}
                            onClick={() => handleQuickAction("phone")}
                            disabled={!deal.contact?.mobile}
                        />
                    </Tooltip>

                    <Tooltip title="Telegram">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<MessageOutlined />}
                            size="large"
                            className="w-full aspect-square"
                            style={{ backgroundColor: "#0088cc" }}
                            onClick={() => handleQuickAction("telegram")}
                        />
                    </Tooltip>

                    <Tooltip title="Instagram">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<InstagramOutlined />}
                            size="large"
                            className="w-full aspect-square"
                            style={{ backgroundColor: "#E4405F" }}
                            onClick={() => handleQuickAction("instagram")}
                        />
                    </Tooltip>

                    <Tooltip title="New Conversation">
                        <Button
                            type="primary"
                            shape="circle"
                            icon={<PlusOutlined />}
                            size="large"
                            className="w-full aspect-square"
                            onClick={() => handleQuickAction("conversation")}
                        />
                    </Tooltip>
                </div>
            </Card>

            {/* Contact Details Card */}
            {deal.contact && (
                <Card
                    title="Contact Details"
                    className="shadow-sm border-0 rounded-lg overflow-hidden"
                >
                    <Space
                        direction="vertical"
                        size="middle"
                        className="w-full"
                    >
                        <div className="flex items-center space-x-3">
                            <Avatar
                                size="large"
                                icon={<UserOutlined />}
                                className="flex-shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 truncate">
                                    {deal.contact.client_name_salutation ||
                                        deal.contact.client_name}
                                </h3>
                                {deal.contact.company_name && (
                                    <p className="text-sm text-gray-600 truncate">
                                        {deal.contact.company_name}
                                    </p>
                                )}
                            </div>
                        </div>

                        <Divider className="my-3" />

                        {deal.contact.client_email && (
                            <div className="flex items-center space-x-3">
                                <MailOutlined className="text-gray-400" />
                                <a
                                    href={`mailto:${deal.contact.client_email}`}
                                    className="text-blue-600 hover:text-blue-800 text-sm truncate"
                                >
                                    {deal.contact.client_email}
                                </a>
                            </div>
                        )}

                        {deal.contact.mobile && (
                            <div className="flex items-center space-x-3">
                                <PhoneOutlined className="text-gray-400" />
                                <span className="text-sm text-gray-600">
                                    {(() => {
                                        let mobile = deal.contact.mobile;
                                        if (
                                            typeof mobile === "string" &&
                                            mobile.trim().startsWith("{")
                                        ) {
                                            try {
                                                const mobileData = JSON.parse(
                                                    mobile.trim()
                                                );
                                                mobile =
                                                    mobileData?.phone || mobile;
                                            } catch (e) {
                                                // Use original mobile
                                            }
                                        }
                                        return mobile;
                                    })()}
                                </span>
                            </div>
                        )}
                    </Space>
                </Card>
            )}

            {/* Communication Timeline */}
            <Card
                title="Recent Communications"
                className="shadow-sm border-0 rounded-lg overflow-hidden"
            >
                {activities.length > 0 ? (
                    <Timeline
                        mode="left"
                        className="communication-timeline"
                        items={activities
                            .slice(0, 10)
                            .map((activity, index) => ({
                                dot: getActivityIcon(
                                    activity.type || "message"
                                ),
                                children: (
                                    <div key={index} className="pb-4">
                                        <div className="flex items-start justify-between mb-2">
                                            <span className="font-medium text-sm text-gray-900 capitalize">
                                                {activity.type ||
                                                    "Communication"}
                                            </span>
                                            <span className="text-xs text-gray-500">
                                                {formatActivityDate(
                                                    activity.timestamp
                                                )}
                                            </span>
                                        </div>
                                        {activity.subject && (
                                            <div className="text-sm font-medium text-gray-700 mb-1">
                                                {activity.subject}
                                            </div>
                                        )}
                                        {activity.message && (
                                            <Paragraph
                                                ellipsis={{
                                                    rows: 2,
                                                    expandable: false,
                                                }}
                                                className="text-sm text-gray-600 mb-0"
                                            >
                                                {activity.message}
                                            </Paragraph>
                                        )}
                                        {activity.duration && (
                                            <div className="flex items-center space-x-1 mt-1">
                                                <ClockCircleOutlined className="text-xs text-gray-400" />
                                                <span className="text-xs text-gray-500">
                                                    Duration:{" "}
                                                    {activity.duration}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ),
                            }))}
                    />
                ) : (
                    <Empty
                        description="No communications found"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                )}
            </Card>
        </div>
    );
}
