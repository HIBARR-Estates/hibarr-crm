import { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import { FlightItineraryType, IFlightItineraryEntry } from "@/Types/api/ocr";
import useDealItinerary, {
    DealItineraryFormInput,
} from "../../hooks/useDealItinerary";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";
import DealItineraryOcrScanner from "./DealItineraryOcrScanner";
import {
    DEAL_REDESIGN_RADIUS as R,
    DEAL_REDESIGN_TOKENS as T,
    DEAL_REDESIGN_TYPE as TY,
} from "../../tokens";

const FLIGHT_ITINERARY_EXTRACTION_FLAG = "crm.flight-itinerary-extraction";

interface DealItineraryModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    /** When set, the modal edits this leg instead of creating a new one. */
    leg?: ILeadFlightItinerary | null;
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

/** The OCR result carries both origin and destination text; only the
 * Cyprus-side airport is relevant to this form's single `airport_name`
 * field — arrival airport for an Arrival leg, departure airport for a
 * Departure leg. */
function ocrAirportText(entry: IFlightItineraryEntry): string {
    if (entry.flightType === FlightItineraryType.DEPARTURE) {
        return entry.departureAirport ?? entry.arrivalAirport ?? "";
    }
    return entry.arrivalAirport ?? entry.departureAirport ?? "";
}

/** Best-effort match of raw OCR airport text against the configured airport
 * list — by IATA code first, then by substring on the display label. Falls
 * back to the raw text so the user can still see what was detected and pick
 * the right option manually. */
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

/** Create / edit flight itinerary modal for the deal workspace. */
export default function DealItineraryModal({
    open,
    onClose,
    dealId,
    leg = null,
}: DealItineraryModalProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const showOcrScanner =
        props.featureFlags?.[FLIGHT_ITINERARY_EXTRACTION_FLAG] === true;
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const isEdit = Boolean(leg?.id);
    const [form, setForm] = useState(EMPTY_FORM);
    const { createLeg, isCreating, updateLeg, isUpdating } =
        useDealItinerary(dealId);
    const saving = isCreating || isUpdating;

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
            return;
        }
        setForm(leg ? formFromLeg(leg) : EMPTY_FORM);
    }, [leg, open]);

    // On create only: default to the first configured airport when the list loads.
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

    // If the saved airport string isn't in the config list (legacy free-text),
    // keep it selectable so edit doesn't wipe it.
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

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const applyDetectedFlight = (
        entry: IFlightItineraryEntry,
        fileUrl: string | null,
    ) => {
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
    };

    const handleSubmit = () => {
        if (!form.flight_number.trim() || !form.date || !form.airport_name) {
            return;
        }
        const payload: DealItineraryFormInput = {
            direction: form.direction,
            flight_number: form.flight_number.trim().toUpperCase(),
            airport_name: form.airport_name,
            flight_date: `${form.date} ${form.time}:00`,
            is_transfer_required: form.is_transfer_required,
            ticket_image_url: form.ticket_image_url,
        };
        if (isEdit && leg) {
            updateLeg(leg, payload, handleClose);
        } else {
            createLeg(payload, handleClose);
        }
    };

    const directions: Array<{ value: FlightDirection; label: string }> = [
        { value: FlightDirection.ARRIVAL, label: ft("arrival") },
        { value: FlightDirection.DEPARTURE, label: ft("departure") },
    ];

    const canSubmit =
        !saving &&
        !!form.flight_number.trim() &&
        !!form.date &&
        !!form.airport_name;

    return (
        <DealModal
            open={open}
            title={isEdit ? ft("edit_flight") : ft("add_flight")}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={saving}
                    >
                        {t("pages.deals.common.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={saving}
                        disabled={!canSubmit}
                    >
                        {isEdit
                            ? t("pages.deals.common.save_changes")
                            : ft("add_flight")}
                    </DealButton>
                </>
            }
        >
            {!isEdit && showOcrScanner && (
                <DealItineraryOcrScanner
                    key={open ? "open" : "closed"}
                    disabled={saving}
                    onApply={applyDetectedFlight}
                />
            )}

            <DealModalField label={ft("direction")}>
                <div
                    className="grid grid-cols-2 gap-1.5"
                    role="group"
                    aria-label={ft("direction")}
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
                                    setForm({ ...form, direction: option.value })
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
            </DealModalField>

            <DealModalField label={ft("flight_number")}>
                <input
                    value={form.flight_number}
                    disabled={saving}
                    autoFocus
                    onChange={(e) =>
                        setForm({ ...form, flight_number: e.target.value })
                    }
                    placeholder={t(
                        "pages.deals.workspace.itinerary.flight_number_placeholder",
                    )}
                />
            </DealModalField>

            <DealModalField label={ft("airport_name")}>
                <Select
                    value={form.airport_name || undefined}
                    options={selectOptions}
                    onChange={(value) =>
                        setForm({ ...form, airport_name: value ?? "" })
                    }
                    placeholder={`${t("pages.deals.common.select")} ${ft("airport")}`}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={airportsLoading}
                    disabled={saving || airportsLoading}
                    className="w-full"
                />
            </DealModalField>

            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 sm:gap-3">
                <DealModalField label={t("app.date")}>
                    <input
                        type="date"
                        value={form.date}
                        disabled={saving}
                        onChange={(e) =>
                            setForm({ ...form, date: e.target.value })
                        }
                    />
                </DealModalField>
                <DealModalField label={t("app.time")}>
                    <input
                        type="time"
                        value={form.time}
                        disabled={saving}
                        onChange={(e) =>
                            setForm({ ...form, time: e.target.value })
                        }
                    />
                </DealModalField>
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
                    {ft("airport_transfer_required_question")}
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
                        {form.is_transfer_required
                            ? t("pages.deals.common.yes")
                            : t("pages.deals.common.no")}
                    </span>
                </button>
            </div>
        </DealModal>
    );
}
