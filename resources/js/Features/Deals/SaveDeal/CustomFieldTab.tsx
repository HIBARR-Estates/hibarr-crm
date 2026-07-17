import React, { useEffect, useMemo } from "react";
import { Form, Button, Space, Card } from "antd";
import GeneralCustomFieldTab from "@/Components/Common/GeneralCustomFieldTab";
import { SaveOutlined } from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import { parsePropertyPrice } from "@/lib/utils";
import { DealFormProps } from "./DealForm";

interface CustomFieldTabProps
    extends Pick<
        DealFormProps,
        | "onCancel"
        | "loading"
        | "submitText"
        | "cancelText"
        | "data"
        | "onSubmit"
        | "setErrors"
        | "onErrorsClear"
    > {
    categoryId: number;
    categoryName: string;
    customFields?: any[];
    dealCustomFields?: any[];
}

const CustomFieldTab: React.FC<CustomFieldTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText = "Save Deal",
    cancelText = "Cancel",
    categoryId,
    categoryName,
    customFields: customFieldsOverride,
    dealCustomFields: dealCustomFieldsOverride,
}) => {
    const [form] = Form.useForm();
    const { props } = usePage<any>();
    const defaultCode = props?.default_currency_code || "TRY";
    const currencyFieldIds = useMemo(() => {
        const fields = (
            customFieldsOverride ??
            props?.customFields ??
            []
        ).concat(dealCustomFieldsOverride ?? props?.dealCustomFields ?? []);
        return fields
            .filter((f: any) => f.type === "currency" && f.custom_field_category_id === categoryId)
            .map((f: any) => f.id);
    }, [
        props?.customFields,
        props?.dealCustomFields,
        customFieldsOverride,
        dealCustomFieldsOverride,
        categoryId,
    ]);

    useEffect(() => {
        // Initialize form values when data changes; normalize currency fields from number/string to { amount, currency }
        if (data) {
            const raw = data.custom_fields_data || {};
            const normalized: Record<string, any> = { ...raw };
            currencyFieldIds.forEach((id: number) => {
                const key = `field_${id}`;
                if (key in normalized) {
                    const current = normalized[key];
                    if (current !== null && current !== undefined && current !== "") {
                        normalized[key] = parsePropertyPrice(current, defaultCode);
                    }
                }
            });
            form.setFieldsValue({ ...data, custom_fields_data: normalized });
        }
    }, [data, form, defaultCode, categoryId, currencyFieldIds]);

    const handleSubmit = (values: any) => {
        // Merge and normalize: backend stores currency custom fields as JSON string
        const custom = { ...(values.custom_fields_data || {}) };
        currencyFieldIds.forEach((id: number) => {
            const key = `field_${id}`;
            const v = custom[key];
            if (
                v != null &&
                typeof v === "object" &&
                ("amount" in v || "currency" in v)
            ) {
                custom[key] = JSON.stringify(v);
            }
        });
        const formData = {
            ...data,
            ...values,
            custom_fields_data: custom,
        };
        onSubmit(formData);
    };

    if (data === undefined) {
        return null;
    }

    return (
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Card
                title={`${categoryName} Custom Fields`}
                size="small"
                variant="outlined"
            >
                <GeneralCustomFieldTab
                    data={data}
                    setData={(key, value) => {
                        // Update form fields when GeneralCustomFieldTab changes data
                        // if (key === "custom_fields_data") {
                        //     form.setFieldsValue({ [key]: value });
                        // }
                    }}
                    errors={{}}
                    categoryId={categoryId}
                    categoryName={categoryName}
                    customFields={customFieldsOverride}
                    dealCustomFields={dealCustomFieldsOverride}
                />

                <div style={{ marginTop: 24 }}>
                    <Space>
                        <Button onClick={onCancel}>{cancelText}</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<SaveOutlined />}
                        >
                            {submitText}
                        </Button>
                    </Space>
                </div>
            </Card>
        </Form>
    );
};

export default CustomFieldTab;
