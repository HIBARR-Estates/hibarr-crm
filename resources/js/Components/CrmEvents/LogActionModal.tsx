import React, { useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
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
import { useQueryClient } from "@tanstack/react-query";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { isLoading as _isLoading } from "@/lib/utils";
import type {
    CrmEventTypesResponse,
    CrmEventType,
    CrmEventStorePayload,
    CrmEvent,
    MetadataFieldSchema,
    CrmEventStatus,
    CrmEventDirection,
} from "@/Types/api/crm-event";
import type { ApiSuccessResponse } from "@/lib/api/types";

dayjs.extend(utc);

const { TextArea } = Input;
const { Text } = Typography;

interface NextStepConfig {
    taskableType: "lead" | "deal";
    taskableId: number;
    /** Who the next-step task is assigned to. Defaults to the acting user. */
    defaultAssigneeUserId?: number;
}

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
    modelType: string;
    modelId: number;
    userId?: number;
    /**
     * When set, the modal also offers a "what happens next" task.
     *
     * Absent everywhere except the dashboard, so the deal and lead timelines
     * keep the modal they already have.
     */
    nextStep?: NextStepConfig;
}

interface CreateNextStepTaskRequest {
    heading: string;
    due_date: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
    taskable_type: "lead" | "deal";
    taskable_id: number;
    user_id: number[];
    is_next_step: true;
    estimate_hours: number;
    estimate_minutes: number;
}

export default function LogActionModal({
    open,
    onClose,
    onSuccess,
    modelType,
    modelId,
    userId,
    nextStep,
}: Props) {
    const [form] = Form.useForm();
    const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
    const [partialError, setPartialError] = useState<string | null>(null);
    const queryClient = useQueryClient();
    const { props: pageProps } = usePage();

    /**
     * The event is saved before the task. If the task then fails, a retry must
     * not log the activity twice — the user would be looking at a duplicate
     * they cannot see yet.
     */
    const eventSavedRef = useRef(false);

    const createTask = useApiMutate<
        CreateNextStepTaskRequest,
        unknown,
        ApiSuccessResponse<unknown>
    >(route("tasks.store"), "POST");

    /* ---- Fetch event types ------------------------------------------------ */
    const { data: typesResponse, status: typesStatus } =
        useApiQuery<CrmEventTypesResponse>({
            path: "/api/v1/crm-event-types",
            params: { model_type: modelType },
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
                status: values.status || "completed",
                direction: values.direction || undefined,
                metadata:
                    Object.keys(metadata).length > 0 ? metadata : undefined,
                occurred_at: values.occurred_at
                    ? dayjs(values.occurred_at).utc().toISOString()
                    : dayjs().utc().toISOString(),
            };

            const finish = () => {
                void queryClient.invalidateQueries({
                    queryKey: ["/api/v1/crm-events"],
                });
                reset();
                onSuccess();
                onClose();
            };

            const afterEvent = () => {
                eventSavedRef.current = true;

                if (!nextStep || !values.next_step_title) {
                    finish();
                    return;
                }

                createTask.mutate(
                    {
                        heading: values.next_step_title,
                        due_date: dayjs(values.next_step_due).format(
                            `${pageProps.company?.date_format || "d-m-Y"} ${pageProps.company?.time_format || "H:i"}`,
                        ),
                        priority: "medium",
                        taskable_type: nextStep.taskableType,
                        taskable_id: nextStep.taskableId,
                        user_id: [
                            nextStep.defaultAssigneeUserId ?? userId,
                        ].filter(Boolean) as number[],
                        is_next_step: true,
                        estimate_hours: 0,
                        estimate_minutes: 0,
                    },
                    {
                        onSuccess: finish,
                        onError: () =>
                            setPartialError(
                                "Activity logged. The next step was not saved — try again.",
                            ),
                    },
                );
            };

            // A retry after a failed task must not re-log the event.
            if (eventSavedRef.current) {
                afterEvent();
                return;
            }

            mutation.mutate(payload, {
                onSuccess: (response) => {
                    // 201 success or 202 accepted (async queue) both count.
                    const ok =
                        response?.status === "success" ||
                        response?.status === "accepted";
                    if (!ok) return;

                    afterEvent();
                },

                onError: (error) => {
                    console.error("Error logging event:", error);
                    // Keep the modal open so the user can retry / see the toast.
                },
            });
        } catch {
            // validation error — form will show inline messages
        }
    };

    const reset = () => {
        form.resetFields();
        setSelectedSlug(null);
        setPartialError(null);
        eventSavedRef.current = false;
    };

    const handleCancel = () => {
        reset();
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

                <Form.Item
                    name="status"
                    label="Status"
                    initialValue="completed"
                >
                    <Select
                        options={[
                            { label: "Completed", value: "completed" },
                            {
                                label: "Error Occurred",
                                value: "error_occurred",
                            },
                            { label: "Missed", value: "missed" },
                            { label: "Rejected", value: "rejected" },
                        ]}
                    />
                </Form.Item>

                <Form.Item
                    name="direction"
                    label="Direction"
                    tooltip="Leave blank if direction does not apply"
                >
                    <Select
                        placeholder="None"
                        allowClear
                        options={[
                            { label: "Inbound", value: "inbound" },
                            { label: "Outbound", value: "outbound" },
                        ]}
                    />
                </Form.Item>

                <Form.Item name="comment" label="Message">
                    <TextArea
                        rows={3}
                        placeholder="Add a message about this action…"
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

                {nextStep && (
                    <>
                        <Divider orientation="left" plain>
                            Next step
                        </Divider>

                        <Text type="secondary" className="mb-3 block text-xs">
                            Optional. Saved as a task on this record — a record
                            with no open next step is what puts it in your
                            queue.
                        </Text>

                        <Form.Item
                            name="next_step_title"
                            label="What happens next"
                            rules={[
                                {
                                    // Half a next step is not a next step: a
                                    // title with no date never becomes overdue,
                                    // and a date with no title says nothing.
                                    required: !!form.getFieldValue(
                                        "next_step_due",
                                    ),
                                    message:
                                        "Describe the next step, or clear the date",
                                },
                            ]}
                        >
                            <Input
                                maxLength={190}
                                placeholder="e.g. Book a viewing"
                            />
                        </Form.Item>

                        <Form.Item
                            name="next_step_due"
                            label="By when"
                            dependencies={["next_step_title"]}
                            rules={[
                                ({ getFieldValue }) => ({
                                    required: !!getFieldValue(
                                        "next_step_title",
                                    ),
                                    message:
                                        "Give the next step a date, or clear the title",
                                }),
                            ]}
                        >
                            <DatePicker
                                className="w-full"
                                format="YYYY-MM-DD"
                                disabledDate={(date) =>
                                    date && date < dayjs().startOf("day")
                                }
                            />
                        </Form.Item>
                    </>
                )}
            </Form>

            {partialError && (
                <Alert
                    type="warning"
                    showIcon
                    className="mb-3"
                    message={partialError}
                />
            )}

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
