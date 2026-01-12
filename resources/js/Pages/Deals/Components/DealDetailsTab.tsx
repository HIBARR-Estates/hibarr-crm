import React from "react";
import { Deal, HibarrDealFields } from "@/Types/api/deals";
import { Descriptions, Tag } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import EditableField from "@/Components/EditableField";

interface Props {
    deal: Deal;
    onUpdate?: (field: string, value: any) => Promise<void>;
    editable?: boolean;
    loading?: boolean;
}

const DealDetailsTab: React.FC<Props> = ({
    deal,
    onUpdate,
    editable = false,
    loading = false,
}) => {
    // Cast to Partial to allow working with potentially undefined properties
    // when hibarr_fields is null/undefined (e.g. for new deals or data gaps)
    const fields: Partial<HibarrDealFields> = deal.hibarr_fields || {};

    const handleSave = async (field: string, value: any) => {
        if (onUpdate) {
            await onUpdate(field, value);
        }
    };

    const renderBoolean = (value: boolean | undefined) => {
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
                    <EditableField
                        value={fields.interested_in}
                        fieldName="interested_in"
                        fieldType="text"
                        onSave={(value) => handleSave("interested_in", value)}
                        disabled={!editable}
                        loading={loading}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Budget Range">
                    <EditableField
                        value={fields.budget_range}
                        fieldName="budget_range"
                        fieldType="text"
                        onSave={(value) => handleSave("budget_range", value)}
                        disabled={!editable}
                        loading={loading}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Purchase Timeline">
                    <EditableField
                        value={fields.purchase_timeline}
                        fieldName="purchase_timeline"
                        fieldType="text"
                        onSave={(value) =>
                            handleSave("purchase_timeline", value)
                        }
                        disabled={!editable}
                        loading={loading}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Motivation">
                    <EditableField
                        value={fields.motivation}
                        fieldName="motivation"
                        fieldType="textarea"
                        onSave={(value) => handleSave("motivation", value)}
                        disabled={!editable}
                        loading={loading}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Strategy Meeting Booked">
                    <EditableField
                        value={fields.strategy_meeting_booked ? 1 : 0}
                        fieldName="strategy_meeting_booked"
                        fieldType="boolean"
                        onSave={(value) =>
                            handleSave("strategy_meeting_booked", value)
                        }
                        displayValue={renderBoolean(
                            fields.strategy_meeting_booked
                        )}
                        disabled={!editable}
                        loading={loading}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Downpayment Paid">
                    <EditableField
                        value={fields.downpayment_paid ? 1 : 0}
                        fieldName="downpayment_paid"
                        fieldType="boolean"
                        onSave={(value) =>
                            handleSave("downpayment_paid", value)
                        }
                        displayValue={renderBoolean(fields.downpayment_paid)}
                        disabled={!editable}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Inspection Trip Date">
                    <EditableField
                        value={fields.inspection_trip_date}
                        fieldName="inspection_trip_date"
                        fieldType="date"
                        onSave={(value) =>
                            handleSave("inspection_trip_date", value)
                        }
                        disabled={!editable}
                        formatValue={(val) =>
                            val ? dayjs(val).format("MMM DD, YYYY") : "--"
                        }
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Deposit Confirmation">
                    <EditableField
                        value={fields.deposit_confirmation}
                        fieldName="deposit_confirmation"
                        fieldType="text"
                        onSave={(value) =>
                            handleSave("deposit_confirmation", value)
                        }
                        disabled={!editable}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Reservation Agreement">
                    <EditableField
                        value={fields.reservation_agreement}
                        fieldName="reservation_agreement"
                        fieldType="text"
                        onSave={(value) =>
                            handleSave("reservation_agreement", value)
                        }
                        disabled={!editable}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Sales Contract">
                    <EditableField
                        value={fields.sales_contract}
                        fieldName="sales_contract"
                        fieldType="text"
                        onSave={(value) => handleSave("sales_contract", value)}
                        disabled={!editable}
                    />
                </Descriptions.Item>
                <Descriptions.Item label="Message">
                    <EditableField
                        value={fields.message}
                        fieldName="message"
                        fieldType="textarea"
                        onSave={(value) => handleSave("message", value)}
                        disabled={!editable}
                    />
                </Descriptions.Item>
            </Descriptions>
        </div>
    );
};

export default DealDetailsTab;
