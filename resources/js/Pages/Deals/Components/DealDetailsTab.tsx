import React from "react";
import { Deal, HibarrDealFields } from "@/Types/api/deals";
import { Descriptions, Tag, Empty } from "antd";
import {
    CheckCircleOutlined,
    CloseCircleOutlined,
    CalendarOutlined,
    FileTextOutlined,
    DollarOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

interface Props {
    deal: Deal;
}

const DealDetailsTab: React.FC<Props> = ({ deal }) => {
    const fields = deal.hibarr_fields;

    if (!fields) {
        return (
            <div className="p-8 text-center">
                <Empty description="No additional details available for this deal" />
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
            <Descriptions
                column={{ xxl: 2, xl: 2, lg: 2, md: 1, sm: 1, xs: 1 }}
                bordered
                size="middle"
            >
                <Descriptions.Item label="Interested In">
                    {fields.interested_in || "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Budget Range">
                    {fields.budget_range || "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Purchase Timeline">
                    {fields.purchase_timeline || "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Motivation">
                    {fields.motivation || "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Strategy Meeting Booked">
                    {renderBoolean(fields.strategy_meeting_booked)}
                </Descriptions.Item>

                <Descriptions.Item label="Downpayment Paid">
                    {renderBoolean(fields.downpayment_paid)}
                </Descriptions.Item>

                <Descriptions.Item label="Inspection Trip Date">
                    {fields.inspection_trip_date
                        ? dayjs(fields.inspection_trip_date).format(
                              "MMM DD, YYYY"
                          )
                        : "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Deposit Confirmation">
                    {fields.deposit_confirmation || "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Reservation Agreement">
                    {fields.reservation_agreement || "--"}
                </Descriptions.Item>

                <Descriptions.Item label="Sales Contract">
                    {fields.sales_contract || "--"}
                </Descriptions.Item>
                <Descriptions.Item label="Message">
                    {fields?.message || "--"}
                </Descriptions.Item>
            </Descriptions>
        </div>
    );
};

export default DealDetailsTab;
