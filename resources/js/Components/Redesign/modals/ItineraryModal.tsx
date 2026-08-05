import { useCallback, useEffect, useMemo, useState } from "react";
import { Select, message } from "antd";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import { FlightItineraryType, IFlightItineraryEntry } from "@/Types/api/ocr";
import useFileUpload from "@/Hooks/useFileUpload";
import Button from "@/Components/Redesign/primitives/Button";
import FileDropzone from "@/Components/Redesign/primitives/FileDropzone";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TY,
} from "@/Components/Redesign/tokens";
import ItineraryOcrScanner from "./ItineraryOcrScanner";

export interface ItineraryFormInput {
    direction: FlightDirection;
    flight_number: string;
    airport_name: string;
    flight_date: string;
    is_transfer_required: boolean;
    ticket_image_url?: string | null;
}

interface AirportOption {
    id: number;
    name: string;
    label?: string | null;
    code?: string | null;
}

interface AirportsResponse {
    status: string;
    airports: AirportOption[];
}

interface ItineraryFormState {
    direction: FlightDirection;
    flight_number: string;
    airport_name: string;
    date: string;
    time: string;
    is_transfer_required: boolean;
    ticket_image_url: string | null;
}

const EMPTY_FORM: ItineraryFormState = {
    direction: FlightDirection.ARRIVAL,
    flight_number: "",
    airport_name: "",
    date: "",
    time: "12:00",
    is_transfer_required: false,
    ticket_image_url: null,
};

function humanizeAirportName(value: string): string {
    return value
        .replace(/_/g, " ")
        .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAirportLabel(airport: AirportOption): string {
    const base = airport.label?.trim() || humanizeAirportName(airport.name);
    return airport.code ? `${base} (${airport.code})` : base;
}

function pad2(value: number): string {
    return String(value).padStart(2, "0");
}

function directionFromFlightType(
    type: FlightItineraryType | null,
): FlightDirection | null {
    if (type === FlightItineraryType.ARRIVAL) return FlightDirection.ARRIVAL;
    if (type === FlightItineraryType.DEPARTURE) return FlightDirection.DEPARTURE;
    return null;
}

function splitFlightDateTime(
    value: string | null,
): { date: string; time: string } | null {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return {
        date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
        time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
    };
}

/** OCR carries both origin and destination; only the Cyprus-side airport
 * maps to this form's single `airport_name` field. */
function ocrAirportText(entry: IFlightItineraryEntry): string {
    if (entry.flightType === FlightItineraryType.DEPARTURE) {
        return entry.departureAirport ?? entry.arrivalAirport ?? "";
    }
    return entry.arrivalAirport ?? entry.departureAirport ?? "";
}

/** Match OCR airport text against options (IATA code, then label substring). */
function matchAirportOption(
    text: string,
    options: Array<{ value: string; label: string }>,
): string {
    if (!text) return "";
    const codeMatch = text.match(/\b[A-Z]{3}\b/);
    const needle = text.toLowerCase();

    const byCode = codeMatch
        ? options.find((option) =>
              option.label.toUpperCase().includes(codeMatch[0]),
          )
        : undefined;
    if (byCode) return byCode.value;

    const byLabel = options.find((option) =>
        option.label.toLowerCase().includes(needle),
    );
    if (byLabel) return byLabel.value;

    return text;
}

function formFromLeg(leg: ILeadFlightItinerary): ItineraryFormState {
    const dateTime = splitFlightDateTime(leg.flight_date ?? null);

    return {
        direction: leg.direction,
        flight_number: leg.flight_number ?? "",
        airport_name: leg.airport_name ?? "",
        date: dateTime?.date ?? "",
        time: dateTime?.time ?? "12:00",
        is_transfer_required: Boolean(leg.is_transfer_required),
        ticket_image_url: leg.ticket_image_url ?? null,
    };
}

export interface ItineraryModalLabels {
    addTitle: string;
    editTitle: string;
    cancel: string;
    save: string;
    addSubmit: string;
    arrival: string;
    departure: string;
    direction: string;
    flightNumber: string;
    flightNumberPlaceholder: string;
    airportName: string;
    selectAirport: string;
    date: string;
    time: string;
    transferQuestion: string;
    yes: string;
    no: string;
    flightPlanImage: string;
    uploadFlightPlan: string;
    removeFlightPlan: string;
    uploadingFlightPlan: string;
    uploadFormatsHint?: string;
}

interface ItineraryModalProps {
    open: boolean;
    onClose: () => void;
    leg?: ILeadFlightItinerary | null;
    saving: boolean;
    onSubmit: (payload: ItineraryFormInput) => void;
    labels: ItineraryModalLabels;
    /** When true (and creating), show the ticket OCR scanner above the form. */
    showOcrScanner?: boolean;
}

export default function ItineraryModal({
    open,
    onClose,
    leg = null,
    saving,
    onSubmit,
    labels,
    showOcrScanner = false,
}: ItineraryModalProps) {
    const isEdit = Boolean(leg?.id);
    const [form, setForm] = useState(EMPTY_FORM);
    const [isUploadingTicket, setIsUploadingTicket] = useState(false);

    const {
        uploadSingle,
        aggregateProgress,
        reset: resetUpload,
    } = useFileUpload({
        onError: (error) => {
            message.error(error.message || "Failed to upload image");
        },
    });

    const { data: airportData, isLoading: airportsLoading } =
        useApiQuery<AirportsResponse>({
            path: route("project-locations.airports"),
            options: { enabled: open, staleTime: 5 * 60 * 1000 },
        });

    const airportOptions = useMemo(
        () =>
            (airportData?.airports ?? []).map((airport) => {
                const label = formatAirportLabel(airport);
                return { value: label, label };
            }),
        [airportData?.airports],
    );

    useEffect(() => {
        if (!open) {
            setForm(EMPTY_FORM);
            setIsUploadingTicket(false);
            resetUpload();
            return;
        }
        setForm(leg ? formFromLeg(leg) : EMPTY_FORM);
        setIsUploadingTicket(false);
        resetUpload();
    }, [leg, open, resetUpload]);

    const handleTicketUpload = async (files: FileList | File[] | null) => {
        const file = files?.[0];
        if (!file || saving || isUploadingTicket) return;

        setIsUploadingTicket(true);
        try {
            const result = await uploadSingle(file, "lead-flight-itineraries");
            setForm((current) => ({
                ...current,
                ticket_image_url: result.downloadUrl ?? null,
            }));
        } catch {
            // surfaced via useFileUpload onError
        } finally {
            setIsUploadingTicket(false);
        }
    };

    useEffect(() => {
        if (!open || isEdit || form.airport_name || airportOptions.length === 0) {
            return;
        }
        const first = airportOptions[0];
        setForm((current) =>
            current.airport_name
                ? current
                : { ...current, airport_name: first.value },
        );
    }, [airportOptions, form.airport_name, isEdit, open]);

    const selectOptions = useMemo(() => {
        if (
            !form.airport_name ||
            airportOptions.some((option) => option.value === form.airport_name)
        ) {
            return airportOptions;
        }
        return [
            { value: form.airport_name, label: form.airport_name },
            ...airportOptions,
        ];
    }, [airportOptions, form.airport_name]);

    const applyDetectedFlight = useCallback(
        (entry: IFlightItineraryEntry, fileUrl: string | null) => {
            const detectedDirection = directionFromFlightType(entry.flightType);
            const dateTime = splitFlightDateTime(entry.flightDateTime);
            const airportText = ocrAirportText(entry);
            const matchedAirport = airportText
                ? matchAirportOption(airportText, selectOptions)
                : "";

            setForm((current) => ({
                ...current,
                direction: detectedDirection ?? current.direction,
                flight_number: entry.flightNumber
                    ? entry.flightNumber.toUpperCase()
                    : current.flight_number,
                airport_name: matchedAirport || current.airport_name,
                date: dateTime?.date ?? current.date,
                time: dateTime?.time ?? current.time,
                ticket_image_url: fileUrl ?? current.ticket_image_url,
            }));
        },
        [selectOptions],
    );

    const handleClose = () => {
        if (saving || isUploadingTicket) return;
        onClose();
    };

    const handleSubmit = () => {
        if (!form.flight_number.trim() || !form.date || !form.airport_name) {
            return;
        }
        onSubmit({
            direction: form.direction,
            flight_number: form.flight_number.trim().toUpperCase(),
            airport_name: form.airport_name,
            flight_date: `${form.date} ${form.time}:00`,
            is_transfer_required: form.is_transfer_required,
            ticket_image_url: form.ticket_image_url,
        });
    };

    const directions: Array<{ value: FlightDirection; label: string }> = [
        { value: FlightDirection.ARRIVAL, label: labels.arrival },
        { value: FlightDirection.DEPARTURE, label: labels.departure },
    ];

    const canSubmit =
        !saving &&
        !isUploadingTicket &&
        !!form.flight_number.trim() &&
        !!form.date &&
        !!form.airport_name;

    return (
        <Modal
            open={open}
            title={isEdit ? labels.editTitle : labels.addTitle}
            onClose={handleClose}
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={handleClose}
                        disabled={saving || isUploadingTicket}
                    >
                        {labels.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={!canSubmit}
                    >
                        {isEdit ? labels.save : labels.addSubmit}
                    </Button>
                </>
            }
        >
            {/* Flag ON (create): OCR scanner → POST /ocr/flight-itineraries + poll.
                Flag OFF / edit: plain storage upload of ticket_image_url only. */}
            {!isEdit && showOcrScanner ? (
                <>
                    <ItineraryOcrScanner
                        key={open ? "open" : "closed"}
                        disabled={saving}
                        onApply={applyDetectedFlight}
                    />
                    {form.ticket_image_url ? (
                        <ModalField label={labels.flightPlanImage}>
                            <TicketImagePreview
                                url={form.ticket_image_url}
                                alt={labels.flightPlanImage}
                                removeLabel={labels.removeFlightPlan}
                                disabled={saving || isUploadingTicket}
                                onRemove={() =>
                                    setForm((current) => ({
                                        ...current,
                                        ticket_image_url: null,
                                    }))
                                }
                            />
                        </ModalField>
                    ) : null}
                </>
            ) : (
                <ModalField label={labels.flightPlanImage}>
                    {form.ticket_image_url ? (
                        <TicketImagePreview
                            url={form.ticket_image_url}
                            alt={labels.flightPlanImage}
                            removeLabel={labels.removeFlightPlan}
                            disabled={saving || isUploadingTicket}
                            onRemove={() =>
                                setForm((current) => ({
                                    ...current,
                                    ticket_image_url: null,
                                }))
                            }
                        />
                    ) : (
                        <FileDropzone
                            multiple={false}
                            accept="image/png,image/jpeg,image/webp"
                            disabled={saving}
                            isUploading={isUploadingTicket}
                            uploadProgress={Math.round(
                                aggregateProgress.overallProgress ?? 0,
                            )}
                            dropHint={labels.uploadFlightPlan}
                            uploadingLabel={labels.uploadingFlightPlan}
                            sizeHint={
                                labels.uploadFormatsHint ?? "PNG, JPG, or WEBP"
                            }
                            onFilesSelected={handleTicketUpload}
                        />
                    )}
                </ModalField>
            )}

            <ModalField label={labels.direction}>
                <div
                    className="grid grid-cols-2 gap-1.5"
                    role="group"
                    aria-label={labels.direction}
                >
                    {directions.map((option) => {
                        const selected = form.direction === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                disabled={saving}
                                aria-pressed={selected}
                                onClick={() =>
                                    setForm({
                                        ...form,
                                        direction: option.value,
                                    })
                                }
                                className="font-medium"
                                style={{
                                    fontSize: TY.BODY,
                                    padding: "10px 12px",
                                    borderRadius: R.MD,
                                    border: `1px solid ${
                                        selected ? T.BLUE_MID : T.BORDER
                                    }`,
                                    background: selected
                                        ? T.BLUE_LIGHT
                                        : T.SURFACE,
                                    color: selected ? T.BLUE_DARK : T.TEXT,
                                    cursor: saving ? "default" : "pointer",
                                }}
                            >
                                {option.label}
                            </button>
                        );
                    })}
                </div>
            </ModalField>

            <ModalField label={labels.flightNumber}>
                <input
                    value={form.flight_number}
                    disabled={saving}
                    autoFocus
                    onChange={(e) =>
                        setForm({ ...form, flight_number: e.target.value })
                    }
                    placeholder={labels.flightNumberPlaceholder}
                />
            </ModalField>

            <ModalField label={labels.airportName}>
                <Select
                    value={form.airport_name || undefined}
                    options={selectOptions}
                    onChange={(value) =>
                        setForm({ ...form, airport_name: value ?? "" })
                    }
                    placeholder={labels.selectAirport}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={airportsLoading}
                    disabled={saving || airportsLoading}
                    className="w-full"
                />
            </ModalField>

            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
                <ModalField label={labels.date}>
                    <input
                        type="date"
                        value={form.date}
                        disabled={saving}
                        onChange={(e) =>
                            setForm({ ...form, date: e.target.value })
                        }
                    />
                </ModalField>
                <ModalField label={labels.time}>
                    <input
                        type="time"
                        value={form.time}
                        disabled={saving}
                        onChange={(e) =>
                            setForm({ ...form, time: e.target.value })
                        }
                    />
                </ModalField>
            </div>

            <div
                className="flex items-center justify-between gap-4"
                style={{
                    marginBottom: 4,
                    padding: "14px 16px",
                    borderRadius: R.MD,
                    border: `1px solid ${T.BORDER}`,
                    background: T.SURFACE_2,
                }}
            >
                <div
                    className="min-w-0 font-medium"
                    style={{ fontSize: TY.BODY, color: T.TEXT }}
                >
                    {labels.transferQuestion}
                </div>
                <button
                    type="button"
                    role="switch"
                    aria-checked={form.is_transfer_required}
                    disabled={saving}
                    onClick={() =>
                        setForm({
                            ...form,
                            is_transfer_required: !form.is_transfer_required,
                        })
                    }
                    className="inline-flex shrink-0 items-center gap-2 border-0 bg-transparent p-0"
                    style={{ cursor: saving ? "default" : "pointer" }}
                >
                    <span
                        className="relative inline-block h-5 w-[34px] rounded-full"
                        style={{
                            background: form.is_transfer_required
                                ? T.GREEN
                                : T.BORDER,
                        }}
                    >
                        <span
                            className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                            style={{
                                left: form.is_transfer_required ? 16 : 2,
                            }}
                        />
                    </span>
                    <span
                        className="font-medium"
                        style={{ fontSize: TY.BODY, color: T.TEXT_MUTED }}
                    >
                        {form.is_transfer_required ? labels.yes : labels.no}
                    </span>
                </button>
            </div>
        </Modal>
    );
}

function TicketImagePreview({
    url,
    alt,
    removeLabel,
    disabled,
    onRemove,
}: {
    url: string;
    alt: string;
    removeLabel: string;
    disabled?: boolean;
    onRemove: () => void;
}) {
    return (
        <div className="flex flex-col gap-2">
            <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
            >
                <img
                    src={url}
                    alt={alt}
                    className="max-h-40 rounded-md border border-solid object-contain"
                    style={{ borderColor: T.BORDER }}
                />
            </a>
            <Button
                variant="ghost"
                size="sm"
                disabled={disabled}
                onClick={onRemove}
                className="self-start"
            >
                {removeLabel}
            </Button>
        </div>
    );
}
