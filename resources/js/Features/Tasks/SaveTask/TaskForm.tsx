import React from "react";
import {
    Form,
    Input,
    Select,
    DatePicker,
    Row,
    Col,
    Space,
    Typography,
    Button,
} from "antd";
import {
    SaveOutlined,
    UserOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { usePage } from "@inertiajs/react";
import {
    taskDateTimeToDayjs,
    companyTimeDayjsFormat,
    companyDateDayjsFormat,
} from "@/lib/taskDateTime";
import { identityTd, type TdFn } from "@/lib/dynamicTranslation";

const { TextArea } = Input;
const { Text } = Typography;

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface User {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface Deal {
    id: number;
    name: string;
}

interface Lead {
    id: number;
    client_name: string;
    company_name?: string;
}

interface Property {
    id?: number;
    name?: string;
    title?: string;
}

interface TaskFormProps {
    data?: any;
    visible: boolean;
    onCancel: () => void;
    onSubmit: (values: any) => void;
    submitText: string;
    cancelText: string;
    /** Kept for SaveTaskModal API compatibility; errors are rendered by the parent. */
    errors?: string[];
    setErrors?: (errors: any) => void;
    onErrorsClear?: () => void;
    loading: boolean;
    /** Kept for SaveTaskModal API compatibility; not rendered in this form. */
    categories?: unknown[];
    labels?: unknown[];
    columns: TaskboardColumn[];
    users: User[];
    projects?: unknown[];
    deals?: Deal[];
    leads?: Lead[];
    properties?: Property[];
    relatedEntity?: {
        type: "deal" | "lead" | "property";
        id?: number;
    };
    td?: TdFn;
    formId?: string;
    hideFooter?: boolean;
}

// ─── Section divider ──────────────────────────────────────────────────────────

function SectionDivider({ label }: { label: string }) {
    return (
        <div className="flex items-center gap-3 py-1 col-span-2">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300 whitespace-nowrap">
                {label}
            </span>
            <div className="flex-1 h-px bg-gray-100" />
        </div>
    );
}

// ─── Priority chip selector ────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
    urgent:  { color: "#dc2626", bg: "#fef2f2", border: "#dc262640", label: "Urgent Priority"  },
    highest: { color: "#ef4444", bg: "#fef2f2", border: "#ef444440", label: "Highest Priority" },
    high:    { color: "#ef4444", bg: "#fef2f2", border: "#ef444440", label: "High Priority"    },
    medium:  { color: "#f59e0b", bg: "#fffbeb", border: "#f59e0b40", label: "Medium Priority"  },
    low:     { color: "#94a3b8", bg: "#f8fafc", border: "#94a3b840", label: "Low Priority"     },
} as const;

function PriorityChips({
    value,
    onChange,
    disabled,
    td = identityTd,
}: {
    value?: "low" | "medium" | "high" | "highest" | "urgent";
    onChange?: (v: "low" | "medium" | "high" | "highest" | "urgent") => void;
    disabled?: boolean;
    td?: TdFn;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            {(["urgent", "highest", "high", "medium", "low"] as const).map((pr) => {
                const cfg = PRIORITY_CONFIG[pr];
                const active = value === pr;
                return (
                    <button
                        key={pr}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange?.(pr)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            active ? "shadow-sm" : "border-gray-200 text-gray-500 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                        style={active ? { color: cfg.color, backgroundColor: cfg.bg, borderColor: cfg.border } : {}}
                    >
                        <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: active ? cfg.color : "#cbd5e1" }}
                        />
                        <span className="flex-1">{td(cfg.label, { source: "en" })}</span>
                        {active && (
                            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Status chip selector ──────────────────────────────────────────────────────

function StatusChips({
    value,
    onChange,
    disabled,
    columns,
    td = identityTd,
}: {
    value?: number;
    onChange?: (v: number) => void;
    disabled?: boolean;
    columns: TaskboardColumn[];
    td?: TdFn;
}) {
    return (
        <div className="flex flex-col gap-1.5">
            {columns.map((col) => {
                const active = value === col.id;
                return (
                    <button
                        key={col.id}
                        type="button"
                        disabled={disabled}
                        onClick={() => onChange?.(col.id)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[13px] font-medium transition-all text-left disabled:opacity-50 disabled:cursor-not-allowed ${
                            active
                                ? "border-blue-300 bg-blue-50 text-blue-700 shadow-sm"
                                : "border-gray-200 text-gray-500 bg-white hover:border-gray-300 hover:bg-gray-50"
                        }`}
                    >
                        <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: col.label_color || (active ? "#3b82f6" : "#cbd5e1") }}
                        />
                        <span className="flex-1">{td(col.column_name, { source: "en" })}</span>
                        {active && (
                            <svg className="w-3.5 h-3.5 shrink-0 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                        )}
                    </button>
                );
            })}
        </div>
    );
}

// ─── Main form ─────────────────────────────────────────────────────────────────

const TaskForm: React.FC<TaskFormProps> = ({
    data,
    visible,
    onCancel,
    onSubmit,
    submitText,
    cancelText,
    // errors / setErrors / onErrorsClear: owned by SaveTaskModal (rendered above the form)
    loading,
    columns,
    users,
    deals = [],
    leads = [],
    properties = [],
    relatedEntity,
    td = identityTd,
    formId,
    hideFooter = false,
}) => {
    const [form] = Form.useForm();
    const { props } = usePage();
    const permissions = props.permissions as Partial<{
        add_tasks: string;
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string;
    }>;

    const isAdmin = !permissions || permissions?.view_tasks === "all";

    const getPropertyLabel = (property: Property) =>
        property.name ?? property.title ?? `Property #${property.id}`;

    const getLeadLabel = (lead: Lead) => {
        const company = lead.company_name ? `(${lead.company_name})` : "";
        return `${lead.client_name ?? ""} ${company}`.trim();
    };

    const getDealLabel = (deal: Deal) => deal.name;

    const filterLeadOption = (input: string, option?: { value?: number }) => {
        const lead = leads.find((l) => l.id === option?.value);
        return (lead ? getLeadLabel(lead) : "").toLowerCase().includes(input.toLowerCase());
    };

    const filterDealOption = (input: string, option?: { value?: number }) => {
        const deal = deals.find((d) => d.id === option?.value);
        return (deal ? getDealLabel(deal) : "").toLowerCase().includes(input.toLowerCase());
    };

    const filterPropertyOption = (input: string, option?: { value?: number }) => {
        const property = properties.find((p) => p.id === option?.value);
        return (property ? getPropertyLabel(property) : "").toLowerCase().includes(input.toLowerCase());
    };

    // `columns`/`relatedEntity` are read from refs (not effect deps) below on
    // purpose. Callers often pass `relatedEntity={{ type: "lead", id }}` as a
    // fresh inline object literal on every render, so its reference changes
    // whenever the parent re-renders for any unrelated reason (e.g. another
    // part of the page doing a partial Inertia reload). If those were real
    // deps, this effect would re-run and call form.setFieldsValue(...) again
    // mid-edit, silently wiping whatever the user had already typed. Reading
    // the latest values via ref keeps the effect scoped to real state
    // changes — the modal opening/closing or switching which task is loaded.
    const columnsRef = React.useRef(columns);
    columnsRef.current = columns;
    const relatedEntityRef = React.useRef(relatedEntity);
    relatedEntityRef.current = relatedEntity;

    React.useEffect(() => {
        if (data && visible) {
            form.setFieldsValue({
                ...data,
                start_date: data.start_date
                    ? taskDateTimeToDayjs(data.start_date) ?? dayjs()
                    : dayjs(),
                due_date: data.due_date
                    ? taskDateTimeToDayjs(data.due_date) ?? undefined
                    : undefined,
            });
        } else if (!data && visible) {
            form.resetFields();
            const initialValues: any = {
                start_date: dayjs(),
                priority:   "medium",
                board_column_id: columnsRef.current.find((col) => col.slug === "to_do")?.id,
            };
            const currentRelatedEntity = relatedEntityRef.current;
            if (currentRelatedEntity) {
                if (currentRelatedEntity.type === "deal")     initialValues.deal_id     = currentRelatedEntity.id;
                else if (currentRelatedEntity.type === "lead") initialValues.lead_id     = currentRelatedEntity.id;
                else if (currentRelatedEntity.type === "property") initialValues.property_id = currentRelatedEntity.id;
            }
            form.setFieldsValue(initialValues);
        }
    }, [data, visible, form]);

    const hasRelatedFields =
        (relatedEntity?.type !== "deal" && deals.length > 0) ||
        (relatedEntity?.type !== "lead" && leads.length > 0) ||
        (relatedEntity?.type !== "property" && properties.length > 0);

    return (
        <Form
            id={formId}
            form={form}
            layout="vertical"
            onFinish={(vals) => {
                const taskableInfo: any = {};
                if (vals.deal_id) {
                    taskableInfo.taskable_type = "deal";
                    taskableInfo.taskable_id   = vals.deal_id;
                } else if (vals.lead_id) {
                    taskableInfo.taskable_type = "lead";
                    taskableInfo.taskable_id   = vals.lead_id;
                } else if (vals.property_id) {
                    taskableInfo.taskable_type = "property";
                    taskableInfo.taskable_id   = vals.property_id;
                }
                onSubmit({
                    ...vals,
                    ...taskableInfo,
                    priority:        vals.priority || "medium",
                    without_duedate: !vals.due_date,
                    user_ids:        isAdmin
                        ? vals?.user_ids
                        : [props?.auth?.user?.id].filter(Boolean),
                });
            }}
            preserve={false}
            style={{ marginTop: 16 }}
        >
            {/* ── Title ── */}
            <Form.Item
                name="heading"
                label={td("Task Title", { source: "en" })}
                rules={[
                    { required: true, message: td("Please enter task title", { source: "en" }) },
                    { min: 3, message: td("Title must be at least 3 characters", { source: "en" }) },
                ]}
            >
                <Input placeholder={td("Enter task title...", { source: "en" })} size="large" />
            </Form.Item>

            {/* ── Description ── */}
            <Form.Item
                name="description"
                label={td("Description", { source: "en" })}
                extra={td("Provide a detailed description of the task", { source: "en" })}
            >
                <TextArea
                    rows={3}
                    placeholder={td("Enter task description...", { source: "en" })}
                    showCount
                    maxLength={1000}
                />
            </Form.Item>

            {/* ── Scheduling ── */}
            <SectionDivider label={td("Scheduling", { source: "en" })} />

            <Row gutter={16}>
                <Col xs={24} sm={12}>
                    <Form.Item name="start_date" label={td("Start Date", { source: "en" })}>
                        <DatePicker
                            style={{ width: "100%" }}
                            format={`${companyDateDayjsFormat()} ${companyTimeDayjsFormat()}`}
                            showTime={{ format: companyTimeDayjsFormat() }}
                            placeholder={td("Select start date", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                    <Form.Item
                        name="due_date"
                        label={td("Due Date", { source: "en" })}
                        extra={td("Leave empty if no due date", { source: "en" })}
                    >
                        <DatePicker
                            style={{ width: "100%" }}
                            format={`${companyDateDayjsFormat()} ${companyTimeDayjsFormat()}`}
                            showTime={{ format: companyTimeDayjsFormat() }}
                            placeholder={td("Select due date", { source: "en" })}
                        />
                    </Form.Item>
                </Col>
            </Row>

            {/* ── Classification ── */}
            <SectionDivider label={td("Classification", { source: "en" })} />

            <Row gutter={16}>
                <Col xs={24} sm={12}>
                    <Form.Item name="priority" label={td("Priority", { source: "en" })}>
                        <PriorityChips disabled={loading} td={td} />
                    </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                    <Form.Item name="board_column_id" label={td("Initial Status", { source: "en" })} extra={td("Starting status for this task", { source: "en" })}>
                        <StatusChips columns={columns} disabled={loading} td={td} />
                    </Form.Item>
                </Col>
            </Row>

            {/* ── People ── */}
            <SectionDivider label={td("People", { source: "en" })} />

            {isAdmin && (
                <Form.Item
                    name="user_ids"
                    label={td("Assignees", { source: "en" })}
                    extra={td("Select team members to assign this task", { source: "en" })}
                >
                    <Select
                        mode="multiple"
                        placeholder={td("Select assignees", { source: "en" })}
                        showSearch
                        filterOption={(input, option) => {
                            const user = users.find((u) => u.id === option?.value);
                            return (
                                user?.name?.toLowerCase().includes(input.toLowerCase()) ||
                                user?.designation_name?.toLowerCase().includes(input.toLowerCase()) ||
                                false
                            );
                        }}
                    >
                        {users.map((user) => (
                            <Select.Option key={user.id} value={user.id}>
                                <Space>
                                    <UserOutlined />
                                    {user.name}
                                    {user.designation_name && (
                                        <Text type="secondary" style={{ fontSize: 12 }}>
                                            ({user.designation_name})
                                        </Text>
                                    )}
                                </Space>
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            )}

            {/* ── Related to ── */}
            {hasRelatedFields && <SectionDivider label={td("Related to", { source: "en" })} />}

            {relatedEntity?.type !== "deal" && deals.length > 0 && (
                <Form.Item name="deal_id" label={td("Related Deal", { source: "en" })}>
                    <Select
                        placeholder={td("Select a deal", { source: "en" })}
                        showSearch
                        allowClear
                        filterOption={filterDealOption}
                    >
                        {deals.map((deal) => (
                            <Select.Option key={deal.id} value={deal.id}>
                                {deal.name}
                            </Select.Option>
                        ))}
                    </Select>
                </Form.Item>
            )}

            <Row gutter={16}>
                {relatedEntity?.type !== "lead" && leads.length > 0 && (
                    <Col xs={24} sm={12}>
                        <Form.Item name="lead_id" label={td("Related Lead", { source: "en" })}>
                            <Select
                                placeholder={td("Select a lead", { source: "en" })}
                                showSearch
                                allowClear
                                filterOption={filterLeadOption}
                            >
                                {leads.map((lead) => (
                                    <Select.Option key={lead.id} value={lead.id}>
                                        {getLeadLabel(lead)}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                )}
                {relatedEntity?.type !== "property" && properties.length > 0 && (
                    <Col xs={24} sm={12}>
                        <Form.Item name="property_id" label={td("Related Property", { source: "en" })}>
                            <Select
                                placeholder={td("Select a property", { source: "en" })}
                                showSearch
                                allowClear
                                filterOption={filterPropertyOption}
                            >
                                {properties.map((property) => (
                                    <Select.Option key={property.id} value={property.id}>
                                        {getPropertyLabel(property)}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                )}
            </Row>

            {/* Footer (hidden when managed externally) */}
            {!hideFooter && (
                <div className="flex items-center justify-end space-x-3 mt-8 pt-4 border-t border-gray-200">
                    <Button onClick={onCancel} disabled={loading}>
                        {cancelText}
                    </Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        icon={<SaveOutlined />}
                    >
                        {submitText}
                    </Button>
                </div>
            )}
        </Form>
    );
};

export default TaskForm;
