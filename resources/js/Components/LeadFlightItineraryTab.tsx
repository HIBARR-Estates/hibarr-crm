import React, { useMemo, useState } from "react";
import {
    Button,
    Table,
    Modal,
    Segmented,
    message,
    Dropdown,
    Descriptions,
    Empty,
} from "antd";
import type { MenuProps, TableColumnsType } from "antd";
import {
    PlusOutlined,
    DeleteOutlined,
    EditOutlined,
    MoreOutlined,
    EyeOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    WarningOutlined,
    CaretDownOutlined,
    CaretUpOutlined,
} from "@ant-design/icons";
import { router, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import useTranslation from "@/Hooks/useTranslation";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import {
    formatCompanyDate,
    formatCompanyDateTime,
    formatCompanyTime,
    parseNaiveDateTime,
} from "@/lib/companyDateTime";
import ItineraryModal, {
    type ItineraryFormInput,
} from "@/Components/Redesign/modals/ItineraryModal";
import "@/Components/Redesign/redesign.css";

const FT = "pages.flight_itinerary";
const FLIGHT_ITINERARY_EXTRACTION_FLAG = "crm.flight-itinerary-extraction";

type FilterKey = "all" | "arrival" | "departure" | "transfer";

function parseFlightDate(value: string) {
    return parseNaiveDateTime(value);
}

function formatFlightDateParts(value: string) {
    const parsed = parseFlightDate(value);
    if (!parsed) return null;
    return {
        date: formatCompanyDate(parsed),
        time: formatCompanyTime(parsed),
    };
}

function formatFlightDateTime(value: string) {
    const parsed = parseFlightDate(value);
    return parsed ? formatCompanyDateTime(parsed) : null;
}

function countPluralSuffix(locale: string, count: number): string {
    if (count === 1) {
        return "";
    }

    switch (locale) {
        case "de":
            return "e";
        case "ru":
            return "ов";
        default:
            return "s";
    }
}

const STATUS_STYLES: Record<
    string,
    { dot: string; pill: string; label: string }
> = {
    "not arrived": {
        dot: "bg-blue-600",
        pill: "bg-blue-50 text-blue-700 border-blue-200",
        label: "status_not_arrived",
    },
    arrived: {
        dot: "bg-green-700",
        pill: "bg-green-50 text-green-700 border-green-200",
        label: "status_arrived",
    },
    "not departed": {
        dot: "bg-blue-600",
        pill: "bg-blue-50 text-blue-700 border-blue-200",
        label: "status_not_departed",
    },
    departed: {
        dot: "bg-gray-500",
        pill: "bg-gray-100 text-gray-600 border-gray-200",
        label: "status_departed",
    },
};

export interface LeadFlightItineraryPermissions {
    canAdd: boolean;
    canEdit: boolean;
    canDelete: boolean;
}

interface LeadFlightItineraryTabProps {
    itineraryLegs: ILeadFlightItinerary[];
    leadId?: number;
    dealId?: number;
    permissions?: LeadFlightItineraryPermissions;
}

function DirectionBadge({
    direction,
    label,
}: {
    direction: string;
    label: string;
}) {
    const isArrival = direction === FlightDirection.ARRIVAL;
    return (
        <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-md border whitespace-nowrap ${
                isArrival
                    ? "text-blue-700 bg-blue-50 border-blue-200"
                    : "text-green-700 bg-green-50 border-green-200"
            }`}
        >
            {isArrival ? (
                <ArrowDownOutlined className="text-[11px]" />
            ) : (
                <ArrowUpOutlined className="text-[11px]" />
            )}
            {label}
        </span>
    );
}

function StatusBadge({
    status,
    label,
}: {
    status: string;
    label: string;
}) {
    const style = STATUS_STYLES[status] ?? {
        dot: "bg-gray-400",
        pill: "bg-gray-100 text-gray-600 border-gray-200",
    };
    return (
        <span
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border whitespace-nowrap ${style.pill}`}
        >
            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${style.dot}`} />
            {label}
        </span>
    );
}

function TransferCell({
    required,
    requiredLabel,
}: {
    required: boolean;
    requiredLabel: string;
}) {
    if (required) {
        return (
            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-red-50 text-red-600 whitespace-nowrap">
                <WarningOutlined className="text-[10px]" />
                {requiredLabel}
            </span>
        );
    }
    return <span className="text-gray-400 font-medium">—</span>;
}

export default function LeadFlightItineraryTab({
    itineraryLegs = [],
    leadId,
    dealId,
    permissions = { canAdd: false, canEdit: false, canDelete: false },
}: LeadFlightItineraryTabProps) {
    const { canAdd, canEdit, canDelete } = permissions;
    const { t, locale } = useTranslation();
    const page = usePage();
    const featureFlags =
        (page.props.featureFlags as Record<string, boolean> | undefined) ?? {};
    const showOcrScanner = featureFlags[FLIGHT_ITINERARY_EXTRACTION_FLAG] === true;
    const ft = (key: string, options?: Record<string, unknown>) =>
        t(`${FT}.${key}`, options);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isSavingItinerary, setIsSavingItinerary] = useState(false);
    const [viewingLeg, setViewingLeg] = useState<ILeadFlightItinerary | null>(
        null,
    );
    const [editingLeg, setEditingLeg] = useState<ILeadFlightItinerary | null>(
        null,
    );
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [sortAsc, setSortAsc] = useState(false);

    const statusLabel = (status: string) => {
        const key = STATUS_STYLES[status]?.label;
        return key ? ft(key) : status;
    };

    const pendingFlightCounts = useMemo(() => {
        return {
            arrivals: itineraryLegs.filter(
                (leg) =>
                    leg.direction === FlightDirection.ARRIVAL &&
                    leg.status === "not arrived",
            ).length,
            departures: itineraryLegs.filter(
                (leg) =>
                    leg.direction === FlightDirection.DEPARTURE &&
                    leg.status === "not departed",
            ).length,
        };
    }, [itineraryLegs]);

    const filteredLegs = useMemo(() => {
        let items = [...itineraryLegs];

        if (activeFilter === "arrival") {
            items = items.filter(
                (i) => i.direction === FlightDirection.ARRIVAL,
            );
        } else if (activeFilter === "departure") {
            items = items.filter(
                (i) => i.direction === FlightDirection.DEPARTURE,
            );
        } else if (activeFilter === "transfer") {
            items = items.filter((i) => i.is_transfer_required);
        }

        items.sort((a, b) => {
            const da = a.flight_date ? dayjs(a.flight_date).valueOf() : 0;
            const db = b.flight_date ? dayjs(b.flight_date).valueOf() : 0;
            return sortAsc ? da - db : db - da;
        });

        return items;
    }, [itineraryLegs, activeFilter, sortAsc]);

    const filterOptions = useMemo(
        () => [
            { value: "all" as FilterKey, label: ft("filter_all") },
            { value: "arrival" as FilterKey, label: ft("filter_arrivals") },
            { value: "departure" as FilterKey, label: ft("filter_departures") },
            {
                value: "transfer" as FilterKey,
                label: ft("filter_transfer_needed"),
            },
        ],
        [t, locale],
    );

    const handleOpenModal = (leg?: ILeadFlightItinerary) => {
        if (leg ? !canEdit : !canAdd) {
            return;
        }

        setEditingLeg(leg ?? null);
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        if (isSavingItinerary) return;
        setIsModalVisible(false);
        setEditingLeg(null);
    };

    const handleItinerarySubmit = (payload: ItineraryFormInput) => {
        setIsSavingItinerary(true);
        const body = {
            ...payload,
            lead_id: leadId,
            deal_id: dealId,
            status:
                editingLeg?.status ??
                (payload.direction === FlightDirection.ARRIVAL
                    ? "not arrived"
                    : "not departed"),
        };

        const finish = (okMessage: string) => {
            message.success(okMessage);
            setIsSavingItinerary(false);
            setIsModalVisible(false);
            setEditingLeg(null);
        };

        if (editingLeg) {
            router.put(
                route("lead-flight-itineraries.update", editingLeg.id),
                body,
                {
                    onSuccess: () => finish(ft("messages.updated")),
                    onError: () => setIsSavingItinerary(false),
                    onFinish: () => setIsSavingItinerary(false),
                },
            );
        } else {
            router.post(route("lead-flight-itineraries.store"), body, {
                onSuccess: () => finish(ft("messages.added")),
                onError: () => setIsSavingItinerary(false),
                onFinish: () => setIsSavingItinerary(false),
            });
        }
    };

    const handleDelete = (id: number) => {
        Modal.confirm({
            title: ft("delete_flight"),
            content: ft("delete_confirm"),
            okText: t("app.delete"),
            okType: "danger",
            cancelText: t("app.cancel"),
            onOk: () =>
                router.delete(route("lead-flight-itineraries.destroy", id), {
                    onSuccess: () => {
                        message.success(ft("messages.deleted"));
                    },
                }),
        });
    };

    const getActionMenu = (
        record: ILeadFlightItinerary,
    ): MenuProps["items"] => {
        const items: NonNullable<MenuProps["items"]> = [];

        if (canEdit) {
            items.push({
                key: "edit",
                icon: <EditOutlined />,
                label: ft("edit_flight"),
                onClick: () => handleOpenModal(record),
            });
        }

        items.push({
            key: "view",
            icon: <EyeOutlined />,
            label: ft("view_details"),
            onClick: () => setViewingLeg(record),
        });

        if (canDelete) {
            if (canEdit) {
                items.push({ type: "divider" });
            }
            items.push({
                key: "delete",
                icon: <DeleteOutlined />,
                label: ft("delete_flight"),
                danger: true,
                onClick: () => record.id && handleDelete(record.id),
            });
        }

        return items;
    };

    const columns: TableColumnsType<ILeadFlightItinerary> = [
        {
            title: ft("direction"),
            dataIndex: "direction",
            key: "direction",
            width: 130,
            render: (text: string) => (
                <DirectionBadge
                    direction={text}
                    label={
                        text === FlightDirection.ARRIVAL
                            ? ft("arrival")
                            : ft("departure")
                    }
                />
            ),
        },
        {
            title: ft("flight"),
            key: "flight",
            width: 120,
            render: (_, record) => (
                <div className="max-w-[120px]">
                    <div className="font-semibold text-xs text-gray-900 truncate">
                        {record.airport_name || "—"}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 tabular-nums truncate">
                        {record.flight_number || "—"}
                    </div>
                </div>
            ),
        },
        {
            title: (
                <button
                    type="button"
                    className="inline-flex items-center gap-1 uppercase text-[11.5px] font-bold tracking-wide text-gray-400 hover:text-gray-600 bg-transparent border-0 p-0 cursor-pointer"
                    onClick={() => setSortAsc((v) => !v)}
                >
                    {ft("date_time")}
                    {sortAsc ? (
                        <CaretUpOutlined className="text-[10px] opacity-60" />
                    ) : (
                        <CaretDownOutlined className="text-[10px] opacity-60" />
                    )}
                </button>
            ),
            dataIndex: "flight_date",
            key: "flight_date",
            width: 140,
            render: (date: string) => {
                const formatted = date ? formatFlightDateParts(date) : null;
                return formatted ? (
                    <div>
                        <div className="font-semibold text-sm text-gray-900">
                            {formatted.date}
                        </div>
                        <div className="text-sm text-gray-500 tabular-nums">
                            {formatted.time}
                        </div>
                    </div>
                ) : (
                    <span className="text-gray-400">—</span>
                );
            },
        },
        {
            title: ft("status"),
            dataIndex: "status",
            key: "status",
            width: 140,
            render: (text: string) => (
                <StatusBadge status={text} label={statusLabel(text)} />
            ),
        },
        {
            title: ft("transfer"),
            dataIndex: "is_transfer_required",
            key: "is_transfer_required",
            width: 120,
            render: (val: boolean) => (
                <TransferCell
                    required={!!val}
                    requiredLabel={ft("transfer_required")}
                />
            ),
        },
        {
            title: "",
            key: "actions",
            width: 48,
            align: "right",
            render: (_, record) => (
                <Dropdown
                    menu={{ items: getActionMenu(record) }}
                    trigger={["click"]}
                    placement="bottomRight"
                >
                    <Button
                        type="text"
                        icon={<MoreOutlined />}
                        aria-label={ft("open_actions_menu")}
                        className="text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                    />
                </Dropdown>
            ),
        },
    ];

    const renderMobileCard = (record: ILeadFlightItinerary) => {
        const isArrival = record.direction === FlightDirection.ARRIVAL;
        const formattedDate = record.flight_date
            ? formatFlightDateParts(record.flight_date)
            : null;
        return (
            <div
                key={record.id}
                className="border-b border-gray-200 last:border-b-0 px-4 py-4"
            >
                <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className={`w-[26px] h-[26px] rounded-md flex items-center justify-center shrink-0 ${
                                isArrival ? "bg-blue-50" : "bg-green-50"
                            }`}
                        >
                            {isArrival ? (
                                <ArrowDownOutlined className="text-blue-600 text-[13px]" />
                            ) : (
                                <ArrowUpOutlined className="text-green-700 text-[13px]" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="font-bold text-sm truncate">
                                {record.airport_name || "—"}
                            </div>
                            <div className="text-xs text-gray-400 tabular-nums">
                                {record.flight_number || "—"}
                            </div>
                        </div>
                    </div>
                    <Dropdown
                        menu={{ items: getActionMenu(record) }}
                        trigger={["click"]}
                        placement="bottomRight"
                    >
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            aria-label={ft("open_actions_menu")}
                            className="bg-gray-100 text-gray-500 shrink-0"
                        />
                    </Dropdown>
                </div>
                <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-400">{ft("date_time")}</span>
                    <span className="font-semibold text-gray-900 text-right">
                        {formattedDate
                            ? `${formattedDate.date} · ${formattedDate.time}`
                            : "—"}
                    </span>
                </div>
                <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-400">{ft("status")}</span>
                    <StatusBadge
                        status={record.status}
                        label={statusLabel(record.status)}
                    />
                </div>
                <div className="flex items-center justify-between py-1.5 text-sm">
                    <span className="text-gray-400">{ft("transfer")}</span>
                    <TransferCell
                        required={!!record.is_transfer_required}
                        requiredLabel={ft("transfer_required")}
                    />
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200">
                <div className="flex items-center gap-3 flex-wrap">
                    <h2 className="text-base font-bold text-gray-900 m-0 tracking-tight">
                        {ft("flight")}
                    </h2>
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
                            <ArrowDownOutlined className="text-[11px]" />
                            {ft("pending_arrivals_count", {
                                count: pendingFlightCounts.arrivals,
                            })}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md border bg-green-50 text-green-700 border-green-200 whitespace-nowrap">
                            <ArrowUpOutlined className="text-[11px]" />
                            {ft("pending_departures_count", {
                                count: pendingFlightCounts.departures,
                            })}
                        </span>
                    </div>
                </div>
                {canAdd && (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => handleOpenModal()}
                    >
                        {ft("add_flight")}
                    </Button>
                )}
            </div>

            {itineraryLegs.length > 0 && (
                <div className="flex items-center justify-between gap-4 px-6 py-3.5 border-b border-gray-200 flex-wrap">
                    <Segmented
                        options={filterOptions}
                        value={activeFilter}
                        onChange={(value) =>
                            setActiveFilter(value as FilterKey)
                        }
                    />
                    <span className="text-xs text-gray-400 flex items-center gap-1.5 shrink-0">
                        {ft("sorted_by_date")}
                        {sortAsc ? (
                            <CaretUpOutlined className="text-[10px]" />
                        ) : (
                            <CaretDownOutlined className="text-[10px]" />
                        )}
                    </span>
                </div>
            )}

            {filteredLegs.length === 0 ? (
                <div className="py-16">
                    <Empty description={ft("empty")} />
                </div>
            ) : (
                <>
                    <div className="hidden md:block">
                        <Table
                            dataSource={filteredLegs}
                            columns={columns}
                            rowKey="id"
                            pagination={false}
                            size="middle"
                            className="[&_.ant-table-thead>tr>th]:!text-[11.5px] [&_.ant-table-thead>tr>th]:!font-bold [&_.ant-table-thead>tr>th]:!uppercase [&_.ant-table-thead>tr>th]:!tracking-wide [&_.ant-table-thead>tr>th]:!text-gray-400 [&_.ant-table-thead>tr>th]:!bg-[#fafbfc] [&_.ant-table-tbody>tr:hover>td]:!bg-[#fafbfc]"
                            rowClassName={(_, index) =>
                                index % 2 === 1 ? "bg-[#fcfcfd]" : ""
                            }
                        />
                    </div>
                    <div className="md:hidden">
                        {filteredLegs.map(renderMobileCard)}
                    </div>
                </>
            )}

            {filteredLegs.length > 0 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 text-xs text-gray-400">
                    <span>
                        {ft("flights_count", {
                            count: filteredLegs.length,
                            count_plural: countPluralSuffix(
                                locale,
                                filteredLegs.length,
                            ),
                        })}
                    </span>
                </div>
            )}

            <ItineraryModal
                open={isModalVisible}
                onClose={handleCloseModal}
                leg={editingLeg}
                saving={isSavingItinerary}
                onSubmit={handleItinerarySubmit}
                showOcrScanner={showOcrScanner}
                labels={{
                    addTitle: ft("add_flight"),
                    editTitle: ft("edit_flight"),
                    cancel: t("app.cancel"),
                    save: t("app.update"),
                    addSubmit: ft("add_flight"),
                    arrival: ft("arrival"),
                    departure: ft("departure"),
                    direction: ft("direction"),
                    flightNumber: ft("flight_number"),
                    flightNumberPlaceholder: ft("flight_number"),
                    airportName: ft("airport_name"),
                    selectAirport: ft("airport_name"),
                    date: t("app.date"),
                    time: t("app.time"),
                    transferQuestion: ft("airport_transfer_required_question"),
                    yes: t("app.yes"),
                    no: t("app.no"),
                    flightPlanImage: ft("flight_plan_image"),
                    uploadFlightPlan: ft("upload_flight_plan"),
                    removeFlightPlan: ft("remove_flight_plan"),
                    uploadingFlightPlan: ft("uploading_flight_plan"),
                }}
            />

            <Modal
                title={ft("view_details")}
                open={!!viewingLeg}
                onCancel={() => setViewingLeg(null)}
                footer={[
                    ...(canEdit
                        ? [
                              <Button
                                  key="edit"
                                  type="primary"
                                  onClick={() => {
                                      if (viewingLeg) {
                                          setViewingLeg(null);
                                          handleOpenModal(viewingLeg);
                                      }
                                  }}
                              >
                                  {ft("edit_flight")}
                              </Button>,
                          ]
                        : []),
                    <Button key="close" onClick={() => setViewingLeg(null)}>
                        {t("app.close")}
                    </Button>,
                ]}
                width={480}
            >
                {viewingLeg && (
                    <Descriptions column={1} bordered size="small">
                        <Descriptions.Item label={ft("direction")}>
                            {viewingLeg.direction === FlightDirection.ARRIVAL
                                ? ft("arrival")
                                : ft("departure")}
                        </Descriptions.Item>
                        <Descriptions.Item label={ft("airport_name")}>
                            {viewingLeg.airport_name || "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label={ft("flight_number")}>
                            {viewingLeg.flight_number || "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label={ft("date_time")}>
                            {viewingLeg.flight_date
                                ? (formatFlightDateTime(
                                      viewingLeg.flight_date,
                                  ) ?? "—")
                                : "—"}
                        </Descriptions.Item>
                        <Descriptions.Item label={ft("status")}>
                            {statusLabel(viewingLeg.status)}
                        </Descriptions.Item>
                        <Descriptions.Item
                            label={ft("airport_transfer_required")}
                        >
                            {viewingLeg.is_transfer_required
                                ? ft("transfer_required")
                                : "—"}
                        </Descriptions.Item>
                        {viewingLeg.ticket_image_url && (
                            <Descriptions.Item label={ft("flight_plan_image")}>
                                <a
                                    href={viewingLeg.ticket_image_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-block"
                                >
                                    <img
                                        src={viewingLeg.ticket_image_url}
                                        alt={ft("flight_plan_image")}
                                        className="max-h-32 rounded-md border border-gray-200 object-contain"
                                    />
                                </a>
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                )}
            </Modal>
        </div>
    );
}
