import React from "react";
import { FloatButton, Popover, List } from "antd";
import {
    QuestionCircleOutlined,
    BugOutlined,
    BulbOutlined,
} from "@ant-design/icons";

const SupportWidget: React.FC = () => {
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
        <Popover
            content={content}
            title="Support & Feedback"
            trigger="click"
            placement="topRight"
        >
            <FloatButton
                icon={<QuestionCircleOutlined />}
                type="primary"
                style={{ right: 24, bottom: 24 }}
                tooltip="Support"
            />
        </Popover>
    );
};

export default SupportWidget;
