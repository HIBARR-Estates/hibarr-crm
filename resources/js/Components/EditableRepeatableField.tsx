import React, { useState, useEffect } from "react";
import { Modal, Form, Button, Spin } from "antd";
import { EditOutlined } from "@ant-design/icons";
import RepeatableFieldRenderer from "@/Components/RepeatableFieldRenderer";
import type { RepeatableItemSchema } from "@/Types";

interface RepeatableFieldDef {
    id: number;
    label: string;
    linked_field_id?: number | null;
    values?: string | RepeatableItemSchema[] | null;
}

interface EditableRepeatableFieldProps {
    field: RepeatableFieldDef;
    value: any; // array of objects, or JSON string, or null
    fieldKey: string;
    customFieldsData: Record<string, any>;
    onSave: (fieldKey: string, value: Record<string, any>[]) => Promise<void>;
    loading?: boolean;
    editable?: boolean;
    /** Display node for view mode (formatted list) */
    displayValue: React.ReactNode;
}

function parseRepeatableValue(value: any): Record<string, any>[] {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : parsed && typeof parsed === "object" ? [parsed] : [];
        } catch {
            return [];
        }
    }
    if (value && typeof value === "object" && !Array.isArray(value)) return [value];
    return [];
}

export default function EditableRepeatableField({
    field,
    value,
    fieldKey,
    customFieldsData,
    onSave,
    loading = false,
    editable = true,
    displayValue,
}: EditableRepeatableFieldProps) {
    const [modalOpen, setModalOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm();

    const linkedId = field.linked_field_id;
    const linkedKey = linkedId ? `field_${linkedId}` : null;
    let schema: RepeatableItemSchema[] = [];
    if (Array.isArray(field.values)) schema = field.values;
    else if (typeof field.values === "string" && field.values.trim()) {
        try {
            const parsed = JSON.parse(field.values) as RepeatableItemSchema[];
            schema = Array.isArray(parsed) ? parsed : [];
        } catch {
            schema = [];
        }
    }
    const canEditRepeatable = !!linkedKey && schema.length > 0;
    const N = linkedKey
        ? Math.max(0, parseInt(String(customFieldsData[linkedKey] ?? 0), 10) || 0)
        : 0;

    // When modal opens, set form values so RepeatableFieldRenderer has linked count + repeatable data
    useEffect(() => {
        if (!modalOpen || !form) return;
        const initial: Record<string, any> = { ...customFieldsData };
        initial[fieldKey] = parseRepeatableValue(value);
        if (linkedKey !== null) initial[linkedKey] = customFieldsData[linkedKey] ?? N;
        form.setFieldsValue({ custom_fields_data: initial });
    }, [modalOpen]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleOpenModal = () => {
        if (!editable || loading) return;
        setModalOpen(true);
    };

    const handleModalOk = async () => {
        try {
            await form.validateFields();
            const formData = form.getFieldValue("custom_fields_data") || {};
            const newValue = formData[fieldKey];
            const arr = Array.isArray(newValue) ? newValue : [];
            setSaving(true);
            await onSave(fieldKey, arr);
            setModalOpen(false);
        } catch (e) {
            // Validation or save error – leave modal open
        } finally {
            setSaving(false);
        }
    };

    const handleModalCancel = () => {
        setModalOpen(false);
    };

    if (!editable || !canEditRepeatable) {
        return <>{displayValue}</>;
    }

    return (
        <>
            <div className="flex items-start gap-2 flex-wrap">
                <div className="flex-1 min-w-0">{displayValue}</div>
                {!loading && (
                    <Button
                        type="link"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={handleOpenModal}
                        className="flex-shrink-0"
                    >
                        Edit
                    </Button>
                )}
                {loading && <Spin size="small" className="flex-shrink-0" />}
            </div>
            <Modal
                title={`Edit ${field.label}`}
                open={modalOpen}
                onOk={handleModalOk}
                onCancel={handleModalCancel}
                destroyOnClose
                width={640}
                footer={[
                    <Button key="cancel" onClick={handleModalCancel}>
                        Cancel
                    </Button>,
                    <Button key="submit" type="primary" onClick={handleModalOk} loading={saving}>
                        Save
                    </Button>,
                ]}
            >
                <Form form={form} layout="vertical" initialValues={{ custom_fields_data: customFieldsData }}>
                    <RepeatableFieldRenderer
                        field={{
                            id: field.id,
                            label: field.label,
                            linked_field_id: field.linked_field_id,
                            values: field.values,
                        }}
                        form={form}
                        namePrefix="custom_fields_data"
                        errors={{}}
                        isFieldVisible={() => true}
                        currentCustomFieldsData={customFieldsData}
                    />
                </Form>
            </Modal>
        </>
    );
}
