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
    loading?: boolean; // Deprecated: use loadingField instead
    loadingField?: string | null; // The specific field currently being updated
    onChange?: (fieldName: string, value: any) => void; // For tracking changes in edit mode
    globalLoading?: boolean; // When true, all fields are disabled (e.g., during save all)
    disabled?: boolean; // When true, fields cannot be edited (for permission control)
}

const DealDetailsTab: React.FC<Props> = ({
    deal,
    onUpdate,
    editable = false,
    loading = false,
    loadingField = null,
    onChange,
    globalLoading = false,
    disabled = false,
}) => {
    // Cast to Partial to allow working with potentially undefined properties
    // when hibarr_fields is null/undefined (e.g. for new deals or data gaps)
    const fields: Partial<HibarrDealFields> = deal.hibarr_fields || {};

    // Helper to check if a specific field is loading
    const isFieldLoading = (fieldName: string) =>
        globalLoading ||
        loadingField === fieldName ||
        (loading && !loadingField);

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
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("interested_in")}
                        disabled={disabled}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Budget Range">
                    <EditableField
                        value={fields.budget_range}
                        fieldName="budget_range"
                        fieldType="text"
                        onSave={(value) => handleSave("budget_range", value)}
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("budget_range")}
                        disabled={disabled}
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
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("purchase_timeline")}
                        disabled={disabled}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Motivation">
                    <EditableField
                        value={fields.motivation}
                        fieldName="motivation"
                        fieldType="textarea"
                        onSave={(value) => handleSave("motivation", value)}
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("motivation")}
                        disabled={disabled}
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
                            fields.strategy_meeting_booked,
                        )}
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("strategy_meeting_booked")}
                        disabled={disabled}
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
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("downpayment_paid")}
                        disabled={disabled}
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
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("inspection_trip_date")}
                        disabled={disabled}
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
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("deposit_confirmation")}
                        disabled={disabled}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Reservation Agreement">
                    <EditableField
                        value={fields.reservation_agreement}
                        fieldName="reservation_agreement"
                        fieldType="file"
                        onSave={(value) =>
                            handleSave("reservation_agreement", value)
                        }
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("reservation_agreement")}
                        disabled={disabled}
                    />
                </Descriptions.Item>

                <Descriptions.Item label="Sales Contract">
                    <EditableField
                        value={fields.sales_contract}
                        fieldName="sales_contract"
                        fieldType="file"
                        onSave={(value) => handleSave("sales_contract", value)}
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("sales_contract")}
                        disabled={disabled}
                    />
                </Descriptions.Item>
                <Descriptions.Item label="Message">
                    <EditableField
                        value={fields.message}
                        fieldName="message"
                        fieldType="textarea"
                        onSave={(value) => handleSave("message", value)}
                        alwaysEditing={editable}
                        onChange={onChange}
                        loading={isFieldLoading("message")}
                        disabled={disabled}
                    />
                </Descriptions.Item>
            </Descriptions>
        </div>
    );
};

export default DealDetailsTab;
