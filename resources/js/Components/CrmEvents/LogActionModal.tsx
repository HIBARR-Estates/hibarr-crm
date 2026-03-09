import React, { useMemo } from "react";
import {
    Modal,
    Form,
    Select,
    Input,
    DatePicker,
    Divider,
    Typography,
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

    /* ---- Fetch event types ------------------------------------------------ */
    const { data: typesResponse, status: typesStatus } =
        useApiQuery<CrmEventTypesResponse>({
            path: "/api/v1/crm-event-types",
            options: { enabled: open },
        });

    const eventTypes: CrmEventType[] = typesResponse?.data ?? [];

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

            const payload: CrmEventStorePayload = {
                event_type_slug: values.event_type_slug,
                model_type: modelType,
                model_id: modelId,
                user_id: userId,
                generation_type: "user_generated",
                metadata: values.comment
                    ? { comment: values.comment }
                    : undefined,
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
                    />
                </Form.Item>

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
