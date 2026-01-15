import React from "react";
import { Popover, List, Button } from "antd";
import {
    QuestionCircleOutlined,
    BugOutlined,
    BulbOutlined,
} from "@ant-design/icons";

interface SupportWidgetProps {
    collapsed?: boolean;
}

const SupportWidget: React.FC<SupportWidgetProps> = ({ collapsed = false }) => {
    const content = (
        <div className="w-64">
            <List
                size="small"
                split={false}
                dataSource={[
                    {
                        title: "Report Bugs",
                        icon: <BugOutlined />,
                        url: "https://hibarr-dev.atlassian.net/jira/software/form/04cb685a-c280-4a27-a1d4-b708de106630?from=directory",
                    },
                    {
                        title: "Request Features",
                        icon: <BulbOutlined />,
                        url: "https://hibarr-dev.atlassian.net/jira/software/form/474174e9-559d-46bb-a504-d7df04eef2af?from=directory",
                    },
                ]}
                renderItem={(item) => (
                    <List.Item className="!px-0">
                        <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-3 text-gray-700 hover:text-blue-600 w-full px-2 py-1 rounded hover:bg-gray-50 transition-colors"
                        >
                            {item.icon}
                            <span>{item.title}</span>
                        </a>
                    </List.Item>
                )}
            />
        </div>
    );

    return (
        <div
            style={{
                padding: 12,
                borderTop: "1px solid rgba(255,255,255,0.1)",
            }}
        >
            <Popover
                content={content}
                title="Support & Feedback"
                trigger="click"
                placement="topRight"
            >
                <Button
                    icon={<QuestionCircleOutlined style={{ fontSize: 16 }} />}
                    style={{
                        width: "100%",
                        height: 40,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: collapsed ? "center" : "flex-start",
                        backgroundColor: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "rgba(255,255,255,0.85)",
                    }}
                >
                    {!collapsed && (
                        <span style={{ marginLeft: 8 }}>Support</span>
                    )}
                </Button>
            </Popover>
        </div>
    );
};

export default SupportWidget;
