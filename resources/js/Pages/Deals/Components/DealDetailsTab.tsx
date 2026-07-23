import React from "react";
import { Deal, HibarrDealFields } from "@/Types/api/deals";
import { Tag } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import EditableField from "@/Components/EditableField";
import { DetailSection, DetailField } from "@/Components/DetailSection";

interface Props {
    deal: Deal;
    onUpdate?: (field: string, value: any) => Promise<void>;
    editable?: boolean;
    loading?: boolean;
    loadingField?: string | null;
    onChange?: (fieldName: string, value: any) => void;
    globalLoading?: boolean;
    disabled?: boolean;
    openSections?: Record<string, boolean>;
    onToggleSection?: (id: string) => void;
    isFieldVisible?: (fieldKey: string) => boolean;
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
    openSections = {},
    onToggleSection,
    isFieldVisible,
}) => {
    const fields: Partial<HibarrDealFields> = deal.hibarr_fields || {};

    const show = (fieldKey: string) => isFieldVisible?.(fieldKey) ?? true;

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

    const interestBudgetFields = [
        show("interested_in"),
        show("budget_range"),
        show("purchase_timeline"),
        show("motivation"),
    ].some(Boolean);

    const progressFields = [
        show("strategy_meeting_booked"),
        show("downpayment_paid"),
        show("inspection_trip_date"),
        show("deposit_confirmation"),
    ].some(Boolean);

    const documentationFields = [
        show("reservation_agreement"),
        show("sales_contract"),
    ].some(Boolean);

    const notesFields = [show("message")].some(Boolean);

    return (
        <div className="p-4 space-y-4">
            {interestBudgetFields && (
                <DetailSection
                    title="Interest & Budget"
                    accordion
                    sectionId="deal-interest-budget"
                    isOpen={openSections["deal-interest-budget"] ?? false}
                    onToggle={() => onToggleSection?.("deal-interest-budget")}
                >
                    {show("interested_in") && (
                        <DetailField label="Interested In">
                            <EditableField
                                value={fields.interested_in}
                                fieldName="interested_in"
                                fieldType="text"
                                onSave={(value) =>
                                    handleSave("interested_in", value)
                                }
                                alwaysEditing={editable}
                                onChange={onChange}
                                loading={isFieldLoading("interested_in")}
                                disabled={disabled}
                            />
                        </DetailField>
                    )}

                    {show("budget_range") && (
                        <DetailField label="Budget Range">
                            <EditableField
                                value={fields.budget_range}
                                fieldName="budget_range"
                                fieldType="text"
                                onSave={(value) =>
                                    handleSave("budget_range", value)
                                }
                                alwaysEditing={editable}
                                onChange={onChange}
                                loading={isFieldLoading("budget_range")}
                                disabled={disabled}
                            />
                        </DetailField>
                    )}

                    {show("purchase_timeline") && (
                        <DetailField label="Purchase Timeline">
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
                        </DetailField>
                    )}

                    {show("motivation") && (
                        <DetailField label="Motivation" span={2}>
                            <EditableField
                                value={fields.motivation}
                                fieldName="motivation"
                                fieldType="textarea"
                                onSave={(value) =>
                                    handleSave("motivation", value)
                                }
                                alwaysEditing={editable}
                                onChange={onChange}
                                loading={isFieldLoading("motivation")}
                                disabled={disabled}
                            />
                        </DetailField>
                    )}
                </DetailSection>
            )}

            {progressFields && (
                <DetailSection
                    title="Progress"
                    accordion
                    sectionId="deal-progress"
                    isOpen={openSections["deal-progress"] ?? false}
                    onToggle={() => onToggleSection?.("deal-progress")}
                >
                    {show("strategy_meeting_booked") && (
                        <DetailField label="Strategy Meeting Booked">
                            <EditableField
                                value={
                                    fields.strategy_meeting_booked ? 1 : 0
                                }
                                fieldName="strategy_meeting_booked"
                                fieldType="boolean"
                                onSave={(value) =>
                                    handleSave(
                                        "strategy_meeting_booked",
                                        value,
                                    )
                                }
                                displayValue={renderBoolean(
                                    fields.strategy_meeting_booked,
                                )}
                                alwaysEditing={editable}
                                onChange={onChange}
                                loading={isFieldLoading(
                                    "strategy_meeting_booked",
                                )}
                                disabled={disabled}
                            />
                        </DetailField>
                    )}

                    {show("downpayment_paid") && (
                        <DetailField label="Downpayment Paid">
                            <EditableField
                                value={fields.downpayment_paid ? 1 : 0}
                                fieldName="downpayment_paid"
                                fieldType="boolean"
                                onSave={(value) =>
                                    handleSave("downpayment_paid", value)
                                }
                                displayValue={renderBoolean(
                                    fields.downpayment_paid,
                                )}
                                alwaysEditing={editable}
                                onChange={onChange}
                                loading={isFieldLoading("downpayment_paid")}
                                disabled={disabled}
                            />
                        </DetailField>
                    )}

                    {show("inspection_trip_date") && (
                        <DetailField label="Inspection Trip Date">
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
                                    val
                                        ? dayjs(val).format("MMM DD, YYYY")
                                        : "--"
                                }
                            />
                        </DetailField>
                    )}

                    {show("deposit_confirmation") && (
                        <DetailField label="Deposit Confirmation">
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
                        </DetailField>
                    )}
                </DetailSection>
            )}

            {documentationFields && (
                <DetailSection
                    title="Documentation"
                    accordion
                    sectionId="deal-documentation"
                    isOpen={openSections["deal-documentation"] ?? false}
                    onToggle={() => onToggleSection?.("deal-documentation")}
                >
                    {show("reservation_agreement") && (
                        <DetailField label="Reservation Agreement">
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
                        </DetailField>
                    )}

                    {show("sales_contract") && (
                        <DetailField label="Sales Contract">
                            <EditableField
                                value={fields.sales_contract}
                                fieldName="sales_contract"
                                fieldType="file"
                                onSave={(value) =>
                                    handleSave("sales_contract", value)
                                }
                                alwaysEditing={editable}
                                onChange={onChange}
                                loading={isFieldLoading("sales_contract")}
                                disabled={disabled}
                            />
                        </DetailField>
                    )}
                </DetailSection>
            )}

            {notesFields && (
                <DetailSection
                    title="Notes"
                    gridClassName="grid grid-cols-1"
                    accordion
                    sectionId="deal-notes"
                    isOpen={openSections["deal-notes"] ?? false}
                    onToggle={() => onToggleSection?.("deal-notes")}
                >
                    {show("message") && (
                        <DetailField label="Message" span={2}>
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
                        </DetailField>
                    )}
                </DetailSection>
            )}
        </div>
    );
};

export default DealDetailsTab;
