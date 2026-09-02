import { Link, router, usePage } from "@inertiajs/react";
import { Button, Dropdown, MenuProps, Select, Tag, message } from "antd";
import { ColumnsType } from "antd/lib/table";
import { MoreOutlined, MailOutlined, PhoneOutlined, PlusOutlined } from "@ant-design/icons";
import { useEffect, useState, type CSSProperties } from "react";
import dayjs from "dayjs";
import axios from "axios";
import { Lead } from "@/Types/api/leads";
import {
    formatCompanyDate,
    formatCompanyTime,
} from "@/lib/companyDateTime";
import UserIndicator from "@/Components/UserIndicator";
import PageDataSorter from "@/Components/PageDataSorter";
import { formatMobileForDisplay } from "@/lib/utils";
import { identityTd, type TdFn } from "@/lib/dynamicTranslation";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

/** Soft-fill triplets — same recipe as the Next Action urgency pills. */
const LEAD_TEMPERATURE_STYLE: Record<string, { bg: string; fg: string; bd: string }> = {
    cold: { bg: T.BLUE_LIGHT, fg: T.BLUE_DARK, bd: T.BLUE_MID },
    warm: { bg: T.AMBER_BG, fg: T.AMBER_TEXT, bd: T.AMBER_BORDER },
    hot: { bg: T.RED_SOFT, fg: T.RED, bd: T.RED_MID },
};

/**
 * Header cell recipe shared by every column — design doc "1a".
 *
 * Background/color/size/weight are also enforced via leadsTable.css: the
 * shared DataTable stylesheet sets those `!important`, which beats inline
 * `style` — the class carries the real override, this is belt-and-braces.
 */
function headerCell(
    overrides?: CSSProperties,
    className?: string,
): { style: CSSProperties; className?: string } {
    return {
        className,
        style: {
            padding: "9px 14px",
            background: T.SURFACE_2,
            borderBottom: `1px solid ${T.BORDER}`,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: T.TEXT_MUTED,
            textAlign: "left",
            ...overrides,
        },
    };
}

function bodyCell(overrides?: CSSProperties): { style: CSSProperties } {
    return {
        style: {
            padding: "12px 14px",
            borderBottom: `1px solid ${T.BORDER_SOFT}`,
            verticalAlign: "middle",
            ...overrides,
        },
    };
}

type Urgency = "overdue" | "today" | "urgent" | "soon" | "later";

/**
 * Urgency is derived from the date, never stored — the same boundaries
 * LeadService::applyNextActionFilter() buckets by, so the filter and the
 * label always agree. "urgent" (< 2 days) is a display-only slice of the
 * server's week bucket — it colours the pill, it does not filter.
 */
export function nextActionUrgency(dueAt: string): Urgency {
    const due = dayjs(dueAt);
    const now = dayjs();

    if (due.isBefore(now)) return "overdue";
    if (due.isSame(now, "day")) return "today";
    if (due.isBefore(now.add(2, "day"))) return "urgent";
    if (due.isBefore(now.add(7, "day"))) return "soon";
    return "later";
}

const NEXT_ACTION_TYPE = {
    meeting: { bg: T.BLUE_LIGHT, fg: T.BLUE_DARK, bd: T.BLUE_MID, icon: "calendar" as const, label: "Meeting" },
    task: { bg: T.TEAL_SOFT, fg: T.TEAL, bd: T.TEAL_MID, icon: "check-square" as const, label: "Task" },
};

const NEXT_ACTION_DUE: Record<Urgency, { bg: string; fg: string; bd: string }> = {
    overdue: { bg: T.RED_SOFT, fg: T.RED, bd: T.RED_MID },
    today: { bg: T.AMBER_BANNER, fg: T.AMBER, bd: T.AMBER_MID },
    urgent: { bg: T.AMBER_SOFT, fg: T.AMBER_TEXT, bd: T.AMBER_MID },
    soon: { bg: T.BLUE_LIGHT, fg: T.BLUE_DARK, bd: T.BLUE_MID },
    later: { bg: T.SURFACE_2, fg: T.TEXT_MUTED, bd: T.BORDER },
};

/** "3 days overdue · 12 Aug" / "Today · 17:00" / "Tomorrow · 10:00" / "18 Aug · 11:00" */
function dueLabel(dueAt: string, urgency: Urgency): string {
    const due = dayjs(dueAt);
    const now = dayjs();
    const time = formatCompanyTime(dueAt);
    const date = formatCompanyDate(dueAt, { omitCurrentYear: true });

    if (urgency === "overdue") {
        const days = now.startOf("day").diff(due.startOf("day"), "day");
        return days >= 1
            ? `${days} day${days === 1 ? "" : "s"} overdue · ${date}`
            : `Overdue · ${time}`;
    }
    if (urgency === "today") return `Today · ${time}`;
    if (due.isSame(now.add(1, "day"), "day")) return `Tomorrow · ${time}`;
    return `${date} · ${time}`;
}

function NextActionCell({
    lead,
    td,
    onScheduleNextStep,
    onOpenNextAction,
}: {
    lead: Lead;
    td: TdFn;
    onScheduleNextStep?: (lead: Lead) => void;
    onOpenNextAction?: (action: { type: "task" | "meeting"; id: number }) => void;
}) {
    const action = lead.next_action;

    if (!action?.due_at) {
        return (
            <button
                type="button"
                onClick={() => onScheduleNextStep?.(lead)}
                disabled={!onScheduleNextStep}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold cursor-pointer disabled:cursor-default"
                style={{
                    border: `1px dashed ${T.NAVY_MID}`,
                    background: T.WHITE,
                    color: T.BLUE,
                }}
            >
                <PlusOutlined style={{ fontSize: 12 }} />
                {td("Schedule next step", { source: "en" })}
            </button>
        );
    }

    const urgency = nextActionUrgency(action.due_at);
    const type = NEXT_ACTION_TYPE[action.type];
    const due = NEXT_ACTION_DUE[urgency];

    return (
        <button
            type="button"
            onClick={() => onOpenNextAction?.({ type: action.type, id: action.id })}
            disabled={!onOpenNextAction}
            className="leads-next-action-btn flex w-full items-start gap-2.5 min-w-0 text-left bg-transparent border-none p-0 cursor-pointer disabled:cursor-default"
        >
            <span
                className="flex-none inline-flex items-center justify-center rounded-md"
                style={{ width: 28, height: 28, background: type.bg, border: `1px solid ${type.bd}`, color: type.fg }}
            >
                <Icon name={type.icon} size={15} />
            </span>
            <div className="min-w-0 flex-1" style={{ maxWidth: 260 }}>
                <div
                    className="leads-next-action-title line-clamp-2"
                    style={{ fontSize: 14, fontWeight: 600, color: T.TEXT, lineHeight: 1.3 }}
                >
                    {action.title}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1">
                    <span
                        className="inline-flex items-center rounded-full whitespace-nowrap"
                        style={{
                            padding: "3px 9px",
                            fontSize: 12,
                            fontWeight: 600,
                            background: due.bg,
                            color: due.fg,
                            border: `1px solid ${due.bd}`,
                        }}
                    >
                        {td(dueLabel(action.due_at, urgency), { source: "en" })}
                    </span>
                    {action.meta && (
                        <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                            {td(action.meta, { source: "en" })}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

interface LeadLifecycleStatusOption {
    id: number;
    label: string;
    label_color?: string;
}

/** Inline-editable lifecycle status cell for the Leads table. */
function LeadLifecycleStatusCell({ record }: { record: Lead }) {
    const { props } = usePage();
    const statuses =
        (
            props as {
                leadLifecycleStatuses?: LeadLifecycleStatusOption[];
            }
        ).leadLifecycleStatuses ?? [];
    const [value, setValue] = useState<number | undefined>(
        record.lead_lifecycle_status_id ?? undefined,
    );
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setValue(record.lead_lifecycle_status_id ?? undefined);
    }, [record.lead_lifecycle_status_id]);

    const handleChange = async (nextValue: number) => {
        const previous = value;
        setValue(nextValue);
        setSaving(true);
        try {
            await axios.patch(route("lead-contact.patch", record.id), {
                lead_lifecycle_status_id: nextValue,
            });
            router.reload({ only: ["leads"] });
        } catch {
            setValue(previous);
            message.error("Failed to update lifecycle status");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Select
            size="small"
            value={value}
            onChange={handleChange}
            loading={saving}
            disabled={saving}
            variant="borderless"
            className="w-full"
            popupMatchSelectWidth={false}
            placeholder={<span style={{ color: T.TEXT_HINT }}>—</span>}
            options={statuses.map((status) => ({
                value: status.id,
                label: (
                    <Tag color={status.label_color} className="!mr-0">
                        {status.label}
                    </Tag>
                ),
            }))}
        />
    );
}

interface LeadColumnOptions {
    actionItems?: (item: Lead) => MenuProps["items"];
    t?: (key: string) => string;
    td?: TdFn;
    onScheduleNextStep?: (lead: Lead) => void;
    onOpenNextAction?: (action: { type: "task" | "meeting"; id: number }) => void;
}

export const LEAD_TABLE_COLUMNS = (
    options: LeadColumnOptions | ((item: Lead) => MenuProps["items"]) = {},
    t: (key: string) => string = (key) => key,
    td: TdFn = identityTd,
): ColumnsType<Lead> => {
    const resolved =
        typeof options === "function"
            ? {
                  actionItems: options,
                  t,
                  td,
                  onScheduleNextStep: undefined,
                  onOpenNextAction: undefined,
              }
            : {
                  actionItems: options.actionItems,
                  t: options.t ?? t,
                  td: options.td ?? td,
                  onScheduleNextStep: options.onScheduleNextStep,
                  onOpenNextAction: options.onOpenNextAction,
              };

    const {
        actionItems,
        t: translate,
        td: translateDynamic,
        onScheduleNextStep,
        onOpenNextAction,
    } = resolved;

    return [
        {
            title: (
                <span className="flex items-center">
                    {translateDynamic("Lead", { source: "en" })}
                    <PageDataSorter
                        field="client_name"
                        routeName="lead-contact.index"
                    />
                </span>
            ),
            dataIndex: "name",
            key: "name",
            width: 260,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => {
                const email = record.client_email;
                const mobile = formatMobileForDisplay(record.mobile);

                return (
                    <Link
                        href={route("lead-contact.show", record.id)}
                        className="leads-lead-link block min-w-0"
                    >
                        <div
                            className="leads-lead-name truncate font-semibold"
                            style={{ fontSize: 14, color: T.NAVY, marginBottom: 4 }}
                        >
                            {record.client_name}
                        </div>
                        {email && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                <MailOutlined style={{ fontSize: 12, color: T.TEXT_MUTED, flex: "none" }} />
                                <span
                                    className="truncate"
                                    style={{ fontSize: 12, color: T.TEXT_MUTED }}
                                >
                                    {email}
                                </span>
                            </div>
                        )}
                        {mobile && (
                            <div className="flex items-center gap-1.5 mt-0.5 min-w-0">
                                <PhoneOutlined style={{ fontSize: 12, color: T.TEXT_MUTED, flex: "none" }} />
                                <span
                                    className="truncate"
                                    style={{ fontSize: 12, color: T.TEXT_MUTED }}
                                >
                                    {mobile}
                                </span>
                            </div>
                        )}
                        {!email && !mobile && (
                            <span style={{ fontSize: 12, color: T.TEXT_HINT }}>—</span>
                        )}
                    </Link>
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    {translateDynamic("Next Action", { source: "en" })}
                    <PageDataSorter
                        field="next_action"
                        routeName="lead-contact.index"
                    />
                </span>
            ),
            dataIndex: "next_action",
            key: "next_action",
            width: 320,
            onHeaderCell: () =>
                headerCell(
                    {
                        color: T.NAVY,
                        borderLeft: `1px solid ${T.BORDER}`,
                        borderRight: `1px solid ${T.BORDER}`,
                    },
                    "leads-th-next-action",
                ),
            onCell: () =>
                bodyCell({
                    borderLeft: `1px solid ${T.BORDER_SOFT}`,
                    borderRight: `1px solid ${T.BORDER_SOFT}`,
                    background: T.SURFACE_2,
                }),
            render: (_, record) => (
                <NextActionCell
                    lead={record}
                    td={translateDynamic}
                    onScheduleNextStep={onScheduleNextStep}
                    onOpenNextAction={onOpenNextAction}
                />
            ),
        },
        {
            title: translateDynamic("Category", { source: "en" }),
            dataIndex: "category",
            key: "category",
            width: 150,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => {
                const names =
                    Array.isArray(record.categories) && record.categories.length
                        ? record.categories.map((c) => c.category_name).filter(Boolean)
                        : record.category?.category_name
                          ? [record.category.category_name]
                          : [];
                const categoryText = names.map((n) => translateDynamic(n)).join(", ");

                if (!categoryText) {
                    return <span style={{ color: T.TEXT_HINT }}>—</span>;
                }

                return (
                    <div
                        className="line-clamp-2 min-w-0"
                        style={{ fontSize: 14, color: T.TEXT, overflowWrap: "break-word", wordBreak: "break-word" }}
                    >
                        {categoryText}
                    </div>
                );
            },
        },
        {
            title: translateDynamic("Source", { source: "en" }),
            dataIndex: "lead_source",
            key: "lead_source",
            width: 130,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => {
                const sourceText = record.lead_source
                    ? translateDynamic(record.lead_source.type)
                    : null;

                if (!sourceText) {
                    return <span style={{ color: T.TEXT_HINT }}>—</span>;
                }

                return (
                    <span
                        className="line-clamp-2 min-w-0"
                        style={{ fontSize: 14, color: T.TEXT, overflowWrap: "break-word", wordBreak: "break-word" }}
                    >
                        {sourceText}
                    </span>
                );
            },
        },
        {
            title: translateDynamic("Status", { source: "en" }),
            dataIndex: "lead_lifecycle_status",
            key: "lead_lifecycle_status",
            width: 150,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => <LeadLifecycleStatusCell record={record} />,
        },
        {
            title: translateDynamic("Temp.", { source: "en" }),
            dataIndex: "temperature",
            key: "temperature",
            width: 110,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => {
                const temperature = record.temperature as string | undefined;
                if (!temperature) return <span style={{ color: T.TEXT_HINT }}>—</span>;
                const style = LEAD_TEMPERATURE_STYLE[temperature];

                return (
                    <span
                        className="inline-flex items-center gap-1.5 rounded-full"
                        style={{
                            padding: "4px 11px",
                            fontSize: 12,
                            fontWeight: 600,
                            background: style.bg,
                            color: style.fg,
                            border: `1px solid ${style.bd}`,
                        }}
                    >
                        <span className="rounded-full" style={{ width: 6, height: 6, background: style.fg }} />
                        {temperature.charAt(0).toUpperCase() + temperature.slice(1)}
                    </span>
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    {translate("pages.leads.contacts_table.columns.lead_owner")}
                    <PageDataSorter
                        field="lead_owner"
                        routeName="lead-contact.index"
                    />
                </span>
            ),
            dataIndex: "lead_owner",
            key: "lead_owner",
            width: 160,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => {
                if (!record.lead_owner)
                    return <span style={{ color: T.TEXT_HINT }}>—</span>;

                return (
                    <UserIndicator
                        data={{
                            image_url: record.lead_owner.image_url,
                            name: record.lead_owner.name,
                        }}
                        size="sm"
                        maxNameLength={15}
                    />
                );
            },
        },
        {
            title: (
                <span className="flex items-center">
                    {translate("pages.leads.contacts_table.columns.created")}
                    <PageDataSorter
                        field="created_at"
                        routeName="lead-contact.index"
                    />
                </span>
            ),
            key: "created_at",
            width: 120,
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell(),
            render: (_, record) => {
                if (!record.created_at)
                    return <span style={{ color: T.TEXT_HINT }}>—</span>;

                return (
                    <div>
                        <div style={{ fontSize: 14, color: T.TEXT }}>
                            {formatCompanyDate(record.created_at)}
                        </div>
                        <div style={{ fontSize: 12, color: T.TEXT_MUTED, marginTop: 2 }}>
                            {formatCompanyTime(record.created_at)}
                        </div>
                    </div>
                );
            },
        },
        {
            title: translate("pages.leads.contacts_table.columns.actions"),
            key: "actions",
            width: 56,
            fixed: "right",
            onHeaderCell: () => headerCell(),
            onCell: () => bodyCell({ textAlign: "center" }),
            render: (_, record) => (
                <Dropdown
                    menu={{ items: actionItems?.(record) }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <Button type="text" icon={<MoreOutlined style={{ color: T.TEXT_MUTED }} />} />
                </Dropdown>
            ),
        },
    ];
};
