import React, { useMemo, useState } from "react";
import {
    Button,
    Table,
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    Switch,
    Segmented,
    message,
    Dropdown,
    Descriptions,
    Empty,
    Upload,
    Progress,
} from "antd";
import type { MenuProps, TableColumnsType, FormInstance } from "antd";
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
    UploadOutlined,
    LoadingOutlined,
    CloseCircleOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import dayjs from "dayjs";
import useTranslation from "@/Hooks/useTranslation";
import { useFileUpload } from "@/Hooks/useFileUpload";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";

const { Option } = Select;

const FT = "pages.flight_itinerary";

type FilterKey = "all" | "arrival" | "departure" | "transfer";

function applyServerErrorsToForm(
    form: FormInstance,
    errors: Record<string, string | string[]>,
) {
    form.setFields(
        Object.entries(errors).map(([name, error]) => ({
            name,
            errors: Array.isArray(error) ? error : [error],
        })),
    );
}

function createFlightDateFormatters(locale: string) {
    const intlLocale = locale || "en";
    const dateFormatter = new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
    const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
        hour: "numeric",
        minute: "2-digit",
    });
    const dateTimeFormatter = new Intl.DateTimeFormat(intlLocale, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    const parseDate = (value: string) => {
        const normalized =
            value.includes(" ") && !value.includes("T")
                ? value.replace(" ", "T")
                : value;
        const parsed = new Date(normalized);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    return {
        formatDateParts: (value: string) => {
            const parsed = parseDate(value);
            if (!parsed) return null;
            return {
                date: dateFormatter.format(parsed),
                time: timeFormatter.format(parsed),
            };
        },
        formatDateTime: (value: string) => {
            const parsed = parseDate(value);
            return parsed ? dateTimeFormatter.format(parsed) : null;
        },
    };
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

function FlightPlanImageField({
    form,
    fieldName,
    label,
    uploadHint,
    removeLabel,
    uploadingLabel,
    isUploading,
    uploadProgress,
    onUpload,
    onRemove,
}: {
    form: FormInstance;
    fieldName: string;
    label: string;
    uploadHint: string;
    removeLabel: string;
    uploadingLabel: string;
    isUploading: boolean;
    uploadProgress: number;
    onUpload: (fieldName: string, file: File) => void;
    onRemove: (fieldName: string) => void;
}) {
    const imageUrl = Form.useWatch(fieldName, form);

    return (
        <>
            <Form.Item name={fieldName} hidden>
                <Input />
            </Form.Item>
            <Form.Item label={label} className="mb-0">
                {imageUrl ? (
                    <div className="flex flex-col gap-2">
                        <a
                            href={imageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-block"
                        >
                            <img
                                src={imageUrl}
                                alt={label}
                                className="max-h-40 rounded-md border border-gray-200 object-contain"
                            />
                        </a>
                        <Button
                            type="text"
                            danger
                            size="small"
                            icon={<CloseCircleOutlined />}
                            onClick={() => onRemove(fieldName)}
                            className="self-start px-0"
                        >
                            {removeLabel}
                        </Button>
                    </div>
                ) : (
                    <Upload.Dragger
                        accept="image/png,image/jpeg,image/webp"
                        showUploadList={false}
                        multiple={false}
                        beforeUpload={(file) => {
                            onUpload(fieldName, file);
                            return false;
                        }}
                        disabled={isUploading}
                        className="!p-4"
                    >
                        {isUploading ? (
                            <div className="text-center">
                                <LoadingOutlined className="text-2xl text-blue-500 mb-2" />
                                <p className="text-sm text-gray-500 mb-1">
                                    {uploadingLabel}
                                </p>
                                <Progress
                                    percent={uploadProgress}
                                    size="small"
                                    showInfo={false}
                                />
                            </div>
                        ) : (
                            <div className="text-center">
                                <UploadOutlined className="text-2xl text-gray-400 mb-2" />
                                <p className="text-sm text-gray-600">
                                    {uploadHint}
                                </p>
                            </div>
                        )}
                    </Upload.Dragger>
                )}
            </Form.Item>
        </>
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
    const ft = (key: string, options?: Record<string, unknown>) =>
        t(`${FT}.${key}`, options);
    const flightDateFormatters = useMemo(
        () => createFlightDateFormatters(locale),
        [locale],
    );
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [viewingLeg, setViewingLeg] = useState<ILeadFlightItinerary | null>(
        null,
    );
    const [editingLeg, setEditingLeg] = useState<ILeadFlightItinerary | null>(
        null,
    );
    const [form] = Form.useForm();
    const [isRoundtrip, setIsRoundtrip] = useState(false);
    const [direction, setDirection] = useState<FlightDirection>(
        FlightDirection.ARRIVAL,
    );
    const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
    const [sortAsc, setSortAsc] = useState(false);
    const [uploadingImageField, setUploadingImageField] = useState<
        string | null
    >(null);

    const {
        uploadSingle,
        aggregateProgress,
        reset: resetUpload,
    } = useFileUpload({
        maxFileSize: 5 * 1024 * 1024,
        allowedTypes: ["image/png", "image/jpeg", "image/webp"],
        targetFolder: "lead-flight-itineraries",
        onError: (error) => {
            message.error(error.message || ft("messages.upload_failed"));
        },
    });

    const isTransferRequired = Form.useWatch("is_transfer_required", form);

    const showArrivalSection =
        editingLeg != null
            ? editingLeg.direction === FlightDirection.ARRIVAL
            : isRoundtrip || direction === FlightDirection.ARRIVAL;

    const showDepartureSection =
        editingLeg != null
            ? editingLeg.direction === FlightDirection.DEPARTURE
            : isRoundtrip || direction === FlightDirection.DEPARTURE;

    const departureUsesReturnFields = isRoundtrip && !editingLeg;

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

        if (leg) {
            setEditingLeg(leg);
            setIsRoundtrip(false);
            setDirection(leg.direction);
            form.setFieldsValue({
                direction: leg.direction,
                airport_name: leg.airport_name,
                flight_number: leg.flight_number,
                flight_date: leg.flight_date
                    ? dayjs(leg.flight_date)
                    : undefined,
                status: leg.status,
                is_transfer_required: leg.is_transfer_required ?? false,
                is_roundtrip: false,
                ticket_image_url: leg.ticket_image_url || undefined,
            });
        } else {
            setEditingLeg(null);
            setIsRoundtrip(false);
            setDirection(FlightDirection.ARRIVAL);
            form.resetFields();
            form.setFieldsValue({
                direction: FlightDirection.ARRIVAL,
                is_roundtrip: false,
                is_transfer_required: false,
                status: "not arrived",
                return_status: "not departed",
            });
        }
        setIsModalVisible(true);
    };

    const handleCloseModal = () => {
        setIsModalVisible(false);
        setEditingLeg(null);
        form.resetFields();
        setIsRoundtrip(false);
        setDirection(FlightDirection.ARRIVAL);
        setUploadingImageField(null);
        resetUpload();
    };

    const handleFlightPlanUpload = async (fieldName: string, file: File) => {
        setUploadingImageField(fieldName);
        try {
            const result = await uploadSingle(file, "lead-flight-itineraries");
            form.setFieldValue(fieldName, result.downloadUrl);
        } catch {
            // handled by onError callback
        } finally {
            setUploadingImageField(null);
        }
    };

    const handleRemoveFlightPlan = (fieldName: string) => {
        form.setFieldValue(fieldName, undefined);
    };

    const handleSubmit = async () => {
        if (uploadingImageField) {
            message.warning(ft("uploading_flight_plan"));
            return;
        }

        try {
            const values = await form.validateFields();

            const payload = {
                ...values,
                lead_id: leadId,
                deal_id: dealId,
                direction: editingLeg
                    ? editingLeg.direction
                    : isRoundtrip
                      ? FlightDirection.ARRIVAL
                      : values.direction,
                flight_date: values.flight_date
                    ? values.flight_date.format("YYYY-MM-DD HH:mm:ss")
                    : null,
                return_flight_date: values.return_flight_date
                    ? values.return_flight_date.format("YYYY-MM-DD HH:mm:ss")
                    : null,
                ticket_image_url: values.ticket_image_url || null,
                return_ticket_image_url:
                    values.return_ticket_image_url || null,
            };

            if (editingLeg) {
                router.put(
                    route("lead-flight-itineraries.update", editingLeg.id),
                    payload,
                    {
                        onSuccess: () => {
                            message.success(ft("messages.updated"));
                            handleCloseModal();
                        },
                        onError: (errors) => {
                            applyServerErrorsToForm(form, errors);
                        },
                    },
                );
            } else {
                router.post(route("lead-flight-itineraries.store"), payload, {
                    onSuccess: () => {
                        message.success(ft("messages.added"));
                        handleCloseModal();
                    },
                    onError: (errors) => {
                        applyServerErrorsToForm(form, errors);
                    },
                });
            }
        } catch (error) {
            console.error("Validation Failed:", error);
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

    const renderFlightFields = (
        prefix: "" | "return_",
        isDeparture: boolean,
    ) => {
        const airportName = prefix ? "return_airport_name" : "airport_name";
        const flightNumber = prefix ? "return_flight_number" : "flight_number";
        const flightDate = prefix ? "return_flight_date" : "flight_date";
        const statusField = prefix ? "return_status" : "status";
        const ticketImageField = prefix
            ? "return_ticket_image_url"
            : "ticket_image_url";

        return (
            <>
                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name={airportName} label={ft("airport_name")}>
                        <Input className="h-[38px] rounded-[6px]" />
                    </Form.Item>
                    <Form.Item name={flightNumber} label={ft("flight_number")}>
                        <Input className="h-[38px] rounded-[6px]" />
                    </Form.Item>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name={flightDate} label={ft("date_time")}>
                        <DatePicker
                            showTime
                            className="w-full h-[38px]"
                            placeholder={ft("select_date")}
                        />
                    </Form.Item>
                    <Form.Item name={statusField} label={ft("status")}>
                        <Select
                            key={
                                isDeparture
                                    ? "departure-status"
                                    : "arrival-status"
                            }
                            className="h-[38px]"
                        >
                            {isDeparture ? (
                                <>
                                    <Option value="not departed">
                                        {ft("status_not_departed")}
                                    </Option>
                                    <Option value="departed">
                                        {ft("status_departed")}
                                    </Option>
                                </>
                            ) : (
                                <>
                                    <Option value="not arrived">
                                        {ft("status_not_arrived")}
                                    </Option>
                                    <Option value="arrived">
                                        {ft("status_arrived")}
                                    </Option>
                                </>
                            )}
                        </Select>
                    </Form.Item>
                </div>
                <FlightPlanImageField
                    form={form}
                    fieldName={ticketImageField}
                    label={ft("flight_plan_image")}
                    uploadHint={ft("upload_flight_plan")}
                    removeLabel={ft("remove_flight_plan")}
                    uploadingLabel={ft("uploading_flight_plan")}
                    isUploading={uploadingImageField === ticketImageField}
                    uploadProgress={aggregateProgress.overallProgress}
                    onUpload={handleFlightPlanUpload}
                    onRemove={handleRemoveFlightPlan}
                />
            </>
        );
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
                const formatted = date
                    ? flightDateFormatters.formatDateParts(date)
                    : null;
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
            ? flightDateFormatters.formatDateParts(record.flight_date)
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

            <Modal
                title={editingLeg ? ft("edit_flight") : ft("add_flight")}
                open={isModalVisible}
                onOk={handleSubmit}
                onCancel={handleCloseModal}
                okButtonProps={{ disabled: !!uploadingImageField }}
                width={520}
                destroyOnClose
            >
                <Form
                    form={form}
                    layout="vertical"
                    onValuesChange={(changedValues) => {
                        if (changedValues.is_roundtrip !== undefined) {
                            setIsRoundtrip(changedValues.is_roundtrip);
                        }
                        if (changedValues.direction !== undefined) {
                            const nextDirection =
                                changedValues.direction as FlightDirection;
                            setDirection(nextDirection);
                            form.setFieldsValue({
                                status:
                                    nextDirection === FlightDirection.DEPARTURE
                                        ? "not departed"
                                        : "not arrived",
                            });
                        }
                    }}
                >
                    {!editingLeg && (
                        <Form.Item
                            name="direction"
                            label={ft("direction")}
                            hidden={isRoundtrip}
                            className="mb-5"
                        >
                            <Select className="h-[40px]">
                                <Option value="arrival">{ft("arrival")}</Option>
                                <Option value="departure">
                                    {ft("departure")}
                                </Option>
                            </Select>
                        </Form.Item>
                    )}

                    <div className="mb-6 transition-all duration-300">
                        {showArrivalSection && (
                            <div>
                                <h4 className="font-semibold mb-5 text-sm text-gray-700">
                                    {ft("arrival_details")}
                                </h4>
                                {renderFlightFields("", false)}
                            </div>
                        )}

                        {showDepartureSection && (
                            <div
                                className={
                                    isRoundtrip
                                        ? "border-t border-dashed border-[#dcdfe6] pt-5 mt-5"
                                        : ""
                                }
                            >
                                <h4 className="font-semibold mb-5 text-sm text-gray-700">
                                    {ft("departure_details")}
                                </h4>
                                {departureUsesReturnFields
                                    ? renderFlightFields("return_", true)
                                    : renderFlightFields("", true)}
                            </div>
                        )}

                        {!editingLeg && (
                            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 mt-5">
                                <div className="flex items-center gap-3">
                                    <Form.Item
                                        name="is_transfer_required"
                                        valuePropName="checked"
                                        className="mb-0"
                                        hidden
                                    >
                                        <Switch />
                                    </Form.Item>
                                    <button
                                        type="button"
                                        className="flex items-center gap-3 bg-transparent border-0 p-0 cursor-pointer"
                                        onClick={() =>
                                            form.setFieldsValue({
                                                is_transfer_required:
                                                    !isTransferRequired,
                                            })
                                        }
                                    >
                                        <div
                                            className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${
                                                isTransferRequired
                                                    ? "bg-[#1a8cff]"
                                                    : "bg-[#bfc4cd]"
                                            }`}
                                        >
                                            <div
                                                className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                                                    isTransferRequired
                                                        ? "left-5"
                                                        : "left-0.5"
                                                }`}
                                            />
                                        </div>
                                        <span className="text-sm text-[#333]">
                                            {ft(
                                                "airport_transfer_required_question",
                                            )}
                                        </span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Form.Item
                                        name="is_roundtrip"
                                        valuePropName="checked"
                                        hidden
                                    >
                                        <Switch />
                                    </Form.Item>
                                    <button
                                        type="button"
                                        className="flex items-center gap-3 bg-transparent border-0 p-0 cursor-pointer"
                                        onClick={() => {
                                            const next = !isRoundtrip;
                                            setIsRoundtrip(next);

                                            if (next) {
                                                const values =
                                                    form.getFieldsValue();
                                                const wasDeparture =
                                                    values.direction ===
                                                    FlightDirection.DEPARTURE;

                                                if (wasDeparture) {
                                                    form.setFieldsValue({
                                                        is_roundtrip: next,
                                                        direction:
                                                            FlightDirection.ARRIVAL,
                                                        return_airport_name:
                                                            values.airport_name,
                                                        return_flight_number:
                                                            values.flight_number,
                                                        return_flight_date:
                                                            values.flight_date,
                                                        return_status:
                                                            values.status ||
                                                            "not departed",
                                                        return_ticket_image_url:
                                                            values.ticket_image_url,
                                                        airport_name: undefined,
                                                        flight_number:
                                                            undefined,
                                                        flight_date: undefined,
                                                        status: "not arrived",
                                                        ticket_image_url:
                                                            undefined,
                                                    });
                                                } else {
                                                    form.setFieldsValue({
                                                        is_roundtrip: next,
                                                        direction:
                                                            FlightDirection.ARRIVAL,
                                                        status:
                                                            values.status ||
                                                            "not arrived",
                                                        return_status:
                                                            "not departed",
                                                    });
                                                }
                                            } else {
                                                form.setFieldsValue({
                                                    is_roundtrip: next,
                                                });
                                            }

                                            setDirection(
                                                FlightDirection.ARRIVAL,
                                            );
                                        }}
                                    >
                                        <div
                                            className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${
                                                isRoundtrip
                                                    ? "bg-[#1a8cff]"
                                                    : "bg-[#bfc4cd]"
                                            }`}
                                        >
                                            <div
                                                className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                                                    isRoundtrip
                                                        ? "left-5"
                                                        : "left-0.5"
                                                }`}
                                            />
                                        </div>
                                        <span className="text-sm text-[#333]">
                                            {ft("add_roundtrip")}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {editingLeg && (
                            <div className="flex items-center gap-3 mt-5">
                                <Form.Item
                                    name="is_transfer_required"
                                    valuePropName="checked"
                                    className="mb-0"
                                    hidden
                                >
                                    <Switch />
                                </Form.Item>
                                <button
                                    type="button"
                                    className="flex items-center gap-3 bg-transparent border-0 p-0 cursor-pointer"
                                    onClick={() =>
                                        form.setFieldsValue({
                                            is_transfer_required:
                                                !isTransferRequired,
                                        })
                                    }
                                >
                                    <div
                                        className={`w-10 h-[22px] rounded-[11px] relative transition-colors duration-200 ${
                                            isTransferRequired
                                                ? "bg-[#1a8cff]"
                                                : "bg-[#bfc4cd]"
                                        }`}
                                    >
                                        <div
                                            className={`w-[18px] h-[18px] rounded-full bg-white absolute top-[2px] transition-all duration-200 ${
                                                isTransferRequired
                                                    ? "left-5"
                                                    : "left-0.5"
                                            }`}
                                        />
                                    </div>
                                    <span className="text-sm text-[#333]">
                                        {ft(
                                            "airport_transfer_required_question",
                                        )}
                                    </span>
                                </button>
                            </div>
                        )}
                    </div>
                </Form>
            </Modal>

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
                                ? (flightDateFormatters.formatDateTime(
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
