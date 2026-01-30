import React, { useEffect } from "react";
import {
    Form,
    Input,
    InputNumber,
    DatePicker,
    Row,
    Col,
    Card,
    Select,
    Checkbox,
    Upload,
    Button,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import type { RepeatableItemSchema } from "@/Types";
import type { PageProps } from "@/Components/DashboardLayout";
import CurrencyInput from "./CurrencyInput";

interface RepeatableFieldRendererProps {
    field: {
        id: number;
        label: string;
        linked_field_id?: number | null;
        /** Item schema: array of {key, type, label} or JSON string (parsed inside). */
        values?: string | RepeatableItemSchema[] | null;
        required?: string;
    };
    form: any;
    namePrefix?: string;
    errors?: Record<string, string>;
    isFieldVisible: (id: number) => boolean;
    /** Optional; if not provided, uses Form.useWatch(namePrefix, form) internally. */
    currentCustomFieldsData?: Record<string, any>;
}

function defaultForType(type: RepeatableItemSchema["type"]): string | boolean | any[] {
    if (type === "checkbox") return false;
    if (type === "file") return [];
    return "";
}

/**
 * Renders a repeatable custom field: N blocks (from linked field), each collecting an object per schema.
 */
const RepeatableFieldRenderer: React.FC<RepeatableFieldRendererProps> = ({
    field,
    form,
    namePrefix = "custom_fields_data",
    errors = {},
    isFieldVisible,
    currentCustomFieldsData: providedData,
}) => {
    const { props } = usePage<PageProps>();
    const countries = props?.countries ?? [];
    const watched = Form.useWatch(namePrefix, form);
    const currentCustomFieldsData = providedData ?? watched ?? {};

    const linkedId = field.linked_field_id;
    let schema: RepeatableItemSchema[] = [];
    if (Array.isArray(field.values)) {
        schema = field.values;
    } else if (typeof field.values === "string" && field.values.trim()) {
        try {
            const parsed = JSON.parse(field.values) as RepeatableItemSchema[];
            schema = Array.isArray(parsed) ? parsed : [];
        } catch {
            schema = [];
        }
    }
    const fieldKey = `field_${field.id}`;
    const linkedKey = linkedId ? `field_${linkedId}` : null;

    const N = linkedKey
        ? Math.max(0, parseInt(String(currentCustomFieldsData[linkedKey] ?? 0), 10) || 0)
        : 0;

    useEffect(() => {
        if (!form || !linkedKey) return;
        const path = [namePrefix, fieldKey];
        const current = form.getFieldValue(path);
        const arr = Array.isArray(current) ? current : [];
        if (arr.length === N) return;
        let next: Record<string, any>[];
        if (arr.length > N) {
            next = arr.slice(0, N);
        } else {
            next = [...arr];
            while (next.length < N) {
                const row: Record<string, any> = {};
                for (const s of schema) {
                    const v = defaultForType(s.type);
                    row[s.key] = Array.isArray(v) ? [...v] : v;
                }
                next.push(row);
            }
        }
        form.setFieldValue(path, next);
    }, [N, form, namePrefix, fieldKey, linkedKey, schema.length]);

    if (!linkedKey || schema.length === 0) {
        return (
            <Form.Item label={field.label} name={[namePrefix, fieldKey]} hidden>
                <Input type="hidden" />
            </Form.Item>
        );
    }

    const err = errors[`custom_fields_data.field_${field.id}`] ?? errors[`${namePrefix}.field_${field.id}`];

    const renderSchemaField = (s: RepeatableItemSchema, index: number) => {
        const namePath = [namePrefix, fieldKey, index, s.key];

        if (s.type === "number") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <InputNumber placeholder={s.label} style={{ width: "100%" }} />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "date") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <DatePicker placeholder={s.label} style={{ width: "100%" }} />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "textarea") {
            return (
                <Col span={24} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <Input.TextArea rows={2} placeholder={s.label} />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "password") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <Input.Password placeholder={s.label} />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "phone") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <Input placeholder={s.label} />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "country") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <Select
                            placeholder={s.label}
                            allowClear
                            showSearch
                            filterOption={(input, option) => {
                                const searchText = input.toLowerCase();
                                const countryValue = option?.value as string;
                                const country = countries?.find((c: any) => c.nicename === countryValue);
                                if (!country) return false;
                                return (
                                    country.nicename?.toLowerCase().includes(searchText) ||
                                    country.name?.toLowerCase().includes(searchText) ||
                                    country.iso?.toLowerCase().includes(searchText) ||
                                    country.iso3?.toLowerCase().includes(searchText) ||
                                    country.nationality?.toLowerCase().includes(searchText)
                                );
                            }}
                            options={countries.map((c: any) => ({
                                value: c.nicename,
                                label: c.nicename,
                            }))}
                        />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "checkbox") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label} valuePropName="checked">
                        <Checkbox>{s.label}</Checkbox>
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "currency") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item name={namePath} label={s.label}>
                        <CurrencyInput placeholder={s.label} />
                    </Form.Item>
                </Col>
            );
        }
        if (s.type === "file") {
            return (
                <Col span={12} key={s.key}>
                    <Form.Item
                        name={namePath}
                        label={s.label}
                        valuePropName="fileList"
                        getValueFromEvent={(e: any) => (Array.isArray(e) ? e : e?.fileList)}
                    >
                        <Upload beforeUpload={() => false} maxCount={1}>
                            <Button icon={<UploadOutlined />}>Select file</Button>
                        </Upload>
                    </Form.Item>
                </Col>
            );
        }
        /* select, radio, text: no options in schema, render as text */
        return (
            <Col span={12} key={s.key}>
                <Form.Item name={namePath} label={s.label}>
                    <Input placeholder={s.label} />
                </Form.Item>
            </Col>
        );
    };

    return (
        <div className="repeatable-field">
            <div className="mb-2 font-medium">{field.label}</div>
            {err && <div className="text-red-500 text-sm mb-2">{err}</div>}
            <div className="space-y-4">
                {Array.from({ length: N }, (_, index) => (
                    <Card size="small" key={index} title={`${field.label} (${index + 1})`}>
                        <Row gutter={16}>
                            {schema.map((s) => renderSchemaField(s, index))}
                        </Row>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default RepeatableFieldRenderer;
