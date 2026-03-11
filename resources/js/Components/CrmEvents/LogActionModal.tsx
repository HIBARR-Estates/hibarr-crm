import React, { useMemo, useState } from "react";
import {
    Modal,
    Form,
    Select,
    Input,
    InputNumber,
    DatePicker,
    Switch,
    Divider,
    Typography,
    Alert,
} from "antd";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { isLoading as _isLoading } from "@/lib/utils";
import type {
    CrmEventTypesResponse,
    CrmEventType,
    CrmEventStorePayload,
    CrmEvent,
    MetadataFieldSchema,
} from "@/Types/api/crm-event";
import type { ApiSuccessResponse } from "@/lib/api/types";

dayjs.extend(utc);

const { TextArea } = Input;
const { Text } = Typography;

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modelType: string;
    modelId: number;
    userId?: number;
}

export default function LogActionModal({
    open,
    onClose,
    onSuccess,
    modelType,
    modelId,
    userId,
}: Props) {
    const [form] = Form.useForm();
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

    /* ---- Fetch event types ------------------------------------------------ */
    const { data: typesResponse, status: typesStatus } =
        useApiQuery<CrmEventTypesResponse>({
            path: "/api/v1/crm-event-types",
            options: { enabled: open },
        });

    const eventTypes: CrmEventType[] = typesResponse?.data ?? [];

    /** The currently selected event type (for reading its metadata_schema). */
    const selectedEventType = useMemo(
        () => eventTypes.find((et) => et.slug === selectedSlug) ?? null,
        [eventTypes, selectedSlug],
    );

    const metadataSchema = selectedEventType?.metadata_schema ?? null;

    /** Group event types by category for the Select dropdown. */
    const groupedOptions = useMemo(() => {
        const groups: Record<
            string,
            {
                label: string;
                options: {
                    label: string;
                    value: string;
                    description?: string;
                }[];
            }
        > = {};

        eventTypes.forEach((et) => {
            // Skip system-only event types — agents cannot log them
            if (et.is_system) return;

            const catName = et.category?.name ?? "Other";
            if (!groups[catName]) {
                groups[catName] = { label: catName, options: [] };
            }
            groups[catName].options.push({
                label: et.name,
                value: et.slug,
                description: et.description ?? undefined,
            });
        });

        return Object.values(groups);
    }, [eventTypes]);

    /* ---- Mutation --------------------------------------------------------- */
    const mutation = useApiMutate<
        CrmEventStorePayload,
        CrmEvent,
        ApiSuccessResponse<CrmEvent>
    >("/api/v1/crm-events", "POST", () => {
        form.resetFields();
        onSuccess();
        onClose();
    });

    /* ---- Submit handler --------------------------------------------------- */
    const handleOk = async () => {
        try {
            const values = await form.validateFields();

            // Collect metadata from comment + dynamic schema fields
            const metadata: Record<string, any> = {};
            if (values.comment) {
                metadata.comment = values.comment;
            }
            if (metadataSchema) {
                for (const key of Object.keys(metadataSchema)) {
                    const fieldVal = values[`meta_${key}`];
                    if (
                        fieldVal !== undefined &&
                        fieldVal !== null &&
                        fieldVal !== ""
                    ) {
                        metadata[key] = fieldVal;
                    }
                }
            }

            const payload: CrmEventStorePayload = {
                event_type_slug: values.event_type_slug,
                model_type: modelType,
                model_id: modelId,
                user_id: userId,
                generation_type: "user_generated",
                metadata:
                    Object.keys(metadata).length > 0 ? metadata : undefined,
                occurred_at: values.occurred_at
                    ? dayjs(values.occurred_at).utc().toISOString()
                    : dayjs().utc().toISOString(),
            };

            mutation.mutate(payload);
        } catch {
            // validation error — form will show inline messages
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setSelectedSlug(null);
        onClose();
    };

    return (
        <Modal
            title="Log Action"
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            okText="Save Event"
            okButtonProps={{ loading: mutation.isPending }}
            destroyOnClose
            width={520}
        >
            <Divider className="mt-0 mb-4" />

            <Form form={form} layout="vertical" requiredMark="optional">
                <Form.Item
                    name="event_type_slug"
                    label="Event Type"
                    rules={[
                        {
                            required: true,
                            message: "Please select an event type",
                        },
                    ]}
                >
                    <Select
                        placeholder="Select event type…"
                        showSearch
                        loading={_isLoading({ status: typesStatus })}
                        optionFilterProp="label"
                        options={groupedOptions}
                        onChange={(val) => setSelectedSlug(val ?? null)}
                    />
                </Form.Item>

                {/* ── Dynamic metadata fields from the selected event type ── */}
                {metadataSchema && Object.keys(metadataSchema).length > 0 && (
                    <>
                        <Alert
                            message="Additional information"
                            description="This event type expects extra details. Please fill in the fields below."
                            type="info"
                            showIcon
                            className="mb-4"
                        />
                        {Object.entries(metadataSchema).map(([key, field]) =>
                            renderMetadataField(key, field),
                        )}
                    </>
                )}

                <Form.Item name="comment" label="Comment">
                    <TextArea
                        rows={3}
                        placeholder="Add a note about this action…"
                        maxLength={2000}
                        showCount
                    />
                </Form.Item>

                <Form.Item
                    name="occurred_at"
                    label="Date & Time"
                    tooltip="Defaults to now if left blank"
                >
                    <DatePicker
                        showTime
                        className="w-full"
                        placeholder="Select date & time (or leave blank for now)"
                        format="YYYY-MM-DD HH:mm:ss"
                    />
                </Form.Item>
            </Form>

            <Text type="secondary" className="text-xs">
                This will log a user-generated event against the current record.
            </Text>
        </Modal>
    );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Helper: render a single dynamic form field based on MetadataFieldSchema.
 * ──────────────────────────────────────────────────────────────────────────── */
function renderMetadataField(key: string, field: MetadataFieldSchema) {
    const fieldName = `meta_${key}`;
    const label =
        field.label ??
        key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const rules = field.required
        ? [{ required: true, message: `${label} is required` }]
        : [];

    switch (field.type) {
        case "number":
            return (
                <Form.Item
                    key={fieldName}
                    name={fieldName}
                    label={label}
                    rules={rules}
                    initialValue={field.default}
                >
                    <InputNumber
                        className="w-full"
                        placeholder={
                            field.placeholder ?? `Enter ${label.toLowerCase()}`
                        }
                    />
                </Form.Item>
            );

        case "boolean":
            return (
                <Form.Item
                    key={fieldName}
                    name={fieldName}
                    label={label}
                    valuePropName="checked"
                    initialValue={field.default ?? false}
                    rules={rules}
                >
                    <Switch />
                </Form.Item>
            );

        case "date":
            return (
                <Form.Item
                    key={fieldName}
                    name={fieldName}
                    label={label}
                    rules={rules}
                >
                    <DatePicker
                        className="w-full"
                        showTime
                        placeholder={
                            field.placeholder ?? `Select ${label.toLowerCase()}`
                        }
                        format="YYYY-MM-DD HH:mm:ss"
                    />
                </Form.Item>
            );

        case "select":
            return (
                <Form.Item
                    key={fieldName}
                    name={fieldName}
                    label={label}
                    rules={rules}
                    initialValue={field.default}
                >
                    <Select
                        placeholder={
                            field.placeholder ?? `Select ${label.toLowerCase()}`
                        }
                        options={field.options ?? []}
                    />
                </Form.Item>
            );

        case "textarea":
            return (
                <Form.Item
                    key={fieldName}
                    name={fieldName}
                    label={label}
                    rules={rules}
                    initialValue={field.default}
                >
                    <Input.TextArea
                        rows={3}
                        placeholder={
                            field.placeholder ?? `Enter ${label.toLowerCase()}`
                        }
                        maxLength={2000}
                        showCount
                    />
                </Form.Item>
            );

        case "string":
        default:
            return (
                <Form.Item
                    key={fieldName}
                    name={fieldName}
                    label={label}
                    rules={rules}
                    initialValue={field.default}
                >
                    <Input
                        placeholder={
                            field.placeholder ?? `Enter ${label.toLowerCase()}`
                        }
                    />
                </Form.Item>
            );
    }
}
