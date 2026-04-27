import React from "react";
import useTranslation from "@/Hooks/useTranslation";
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
    const { t } = useTranslation();
    const marketing = lead.marketing;

    if (!marketing) {
        return (
            <div className="p-8 text-center">
                <Empty description={t("pages.leads.marketing.empty")} />
            </div>
        );
    }

    const renderBoolean = (value: boolean) => {
        return value ? (
            <Tag color="success" icon={<CheckCircleOutlined />}>
                {t("pages.leads.marketing.yes")}
            </Tag>
        ) : (
            <Tag color="default" icon={<CloseCircleOutlined />}>
                {t("pages.leads.marketing.no")}
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
                            {t("pages.leads.marketing.utm_section")}
                        </span>
                    }
                    size="small"
                    variant="outlined"
                >
                    <Descriptions
                        column={{ xxl: 3, xl: 3, lg: 2, md: 2, sm: 1, xs: 1 }}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label={t("pages.leads.marketing.utm_source")}>
                            {marketing.utm_source || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.utm_medium")}>
                            {marketing.utm_medium || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.utm_campaign")}>
                            {marketing.utm_campaign || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.utm_content")}>
                            {marketing.utm_content || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.utm_term")}>
                            {marketing.utm_term || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.utm_audience")}>
                            {marketing.utm_audience || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.traffic_source_id")}>
                            {marketing.traffic_source_id || "--"}
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* Social Media Tracking */}
                <Card
                    title={
                        <span>
                            <FacebookOutlined className="mr-2" />
                            {t("pages.leads.marketing.social_section")}
                        </span>
                    }
                    className="shadow-sm"
                    size="small"
                    variant="outlined"
                >
                    <Descriptions
                        column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label={t("pages.leads.marketing.facebook_click_id")}>
                            {marketing.facebook_click_id || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.facebook_lead_id")}>
                            {marketing.facebook_lead_id || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.facebook_browser_id")}>
                            {marketing.facebook_browser_id || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.ip_address")}>
                            {marketing.ip_address || "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.user_agent")} span={2}>
                            <span
                                title={marketing.user_agent || undefined}
                                className="break-all text-xs"
                            >
                                {marketing.user_agent || "--"}
                            </span>
                        </Descriptions.Item>
                    </Descriptions>
                </Card>

                {/* Engagement & Scoring */}
                <Card
                    title={
                        <span>
                            <TrophyOutlined className="mr-2" />
                            {t("pages.leads.marketing.engagement_section")}
                        </span>
                    }
                    className="shadow-sm"
                    size="small"
                    variant="outlined"
                >
                    <Descriptions
                        column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                        bordered
                        size="small"
                    >
                        <Descriptions.Item label={t("pages.leads.marketing.contact_score")}>
                            <Tag color="blue" className="text-base px-3 py-1">
                                {marketing.contact_score || 0}
                            </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.last_webinar_date")}>
                            {marketing.last_webinar_date
                                ? dayjs(marketing.last_webinar_date).format(
                                      "MMM DD, YYYY"
                                  )
                                : "--"}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.registered_for_webinar")}>
                            {renderBoolean(
                                marketing.has_registered_for_the_webinar
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.attended_webinar")}>
                            {renderBoolean(marketing.has_attended_the_webinar)}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.joined_facebook_group")}>
                            {renderBoolean(
                                marketing.has_joined_the_facebook_group
                            )}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.downloaded_ebook")}>
                            {renderBoolean(marketing.has_downloaded_the_ebook)}
                        </Descriptions.Item>
                        <Descriptions.Item label={t("pages.leads.marketing.registered_for_zoom")}>
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
