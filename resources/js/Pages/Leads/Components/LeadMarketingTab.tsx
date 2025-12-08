import React from "react";
import { Lead } from "@/Types/api/leads";
import { Descriptions, Tag, Card, Empty } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    FacebookOutlined,
    GlobalOutlined,
    TrophyOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

interface Props {
    lead: Lead;
}

const LeadMarketingTab: React.FC<Props> = ({ lead }) => {
    const marketing = lead.marketing;

    if (!marketing) {
        return (
            <div className="p-8 text-center">
                <Empty description="No marketing information available for this lead" />
            </div>
        );
    }

    const renderBoolean = (value: boolean) => {
        return value ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
                Yes
            </Tag>
        ) : (
            <Tag color="default" icon={<CloseCircleOutlined />}>
                No
            </Tag>
        );
    };

    return (
        <div className="p-6">
            <div className="grid grid-cols-1 gap-6">
                {/* UTM & Campaign Tracking */}
                <Card
                    title={
                        <span>
                            <GlobalOutlined className="mr-2" />
                            UTM & Campaign Tracking
                        </span>
                    }
                    className="shadow-sm"
                    size="small"
                >
                    <Descriptions
                        column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label="UTM Source">
                            {marketing.utm_source || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="UTM Medium">
                            {marketing.utm_medium || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="UTM Campaign">
                            {marketing.utm_campaign || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="UTM Content">
                            {marketing.utm_content || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="UTM Term">
                            {marketing.utm_term || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="UTM Audience">
                            {marketing.utm_audience || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Traffic Source ID">
                            {marketing.traffic_source_id || "--"}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* Social Media Tracking */}
                <Card
                    title={
                        <span>
                            <FacebookOutlined className="mr-2" />
                            Social Media Tracking
                        </span>
                    }
                    className="shadow-sm"
                    size="small"
                >
                    <Descriptions
                        column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label="Facebook Click ID">
                            {marketing.facebook_click_id || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Facebook Lead ID">
                            {marketing.facebook_lead_id || "--"}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* Engagement & Scoring */}
                <Card
                    title={
                        <span>
                            <TrophyOutlined className="mr-2" />
                            Engagement & Scoring
                        </span>
                    }
                    className="shadow-sm"
                    size="small"
                >
                    <Descriptions
                        column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label="Contact Score">
                            <Tag color="blue" className="text-base px-3 py-1">
                                {marketing.contact_score || 0}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="Last Webinar Date">
                            {marketing.last_webinar_date
                                ? dayjs(marketing.last_webinar_date).format(
                                      "MMM DD, YYYY"
                                  )
                                : "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label="Registered for Webinar">
                            {renderBoolean(
                                marketing.has_registered_for_the_webinar
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Attended Webinar">
                            {renderBoolean(marketing.has_attended_the_webinar)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Joined Facebook Group">
                            {renderBoolean(
                                marketing.has_joined_the_facebook_group
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label="Downloaded eBook">
                            {renderBoolean(marketing.has_downloaded_the_ebook)}
                        </Descriptions.Item>
                        <Descriptions.Item label="Registered for Zoom">
                            {renderBoolean(
                                marketing.registered_for_zoom_meeting
                            )}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>
            </div>
        </div>
    );
};

export default LeadMarketingTab;
