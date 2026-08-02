import { useEffect, useMemo, useState } from "react";
import { Select } from "antd";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import {
    FlightDirection,
    ILeadFlightItinerary,
} from "@/Types/api/lead-flight-itinerary";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TY,
} from "@/Components/Redesign/tokens";

export interface ItineraryFormInput {
    direction: FlightDirection;
    flight_number: string;
    airport_name: string;
    flight_date: string;
    is_transfer_required: boolean;
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
}

const EMPTY_FORM: ItineraryFormState = {
    direction: FlightDirection.ARRIVAL,
    flight_number: "",
    airport_name: "",
    date: "",
    time: "12:00",
    is_transfer_required: false,
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

function formFromLeg(leg: ILeadFlightItinerary): ItineraryFormState {
    const parsed = leg.flight_date ? new Date(leg.flight_date) : null;
    const valid = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;

    return {
        direction: leg.direction,
        flight_number: leg.flight_number ?? "",
        airport_name: leg.airport_name ?? "",
        date: valid
            ? `${valid.getFullYear()}-${pad2(valid.getMonth() + 1)}-${pad2(valid.getDate())}`
            : "",
        time: valid
            ? `${pad2(valid.getHours())}:${pad2(valid.getMinutes())}`
            : "12:00",
        is_transfer_required: Boolean(leg.is_transfer_required),
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
}

interface ItineraryModalProps {
    open: boolean;
    onClose: () => void;
    leg?: ILeadFlightItinerary | null;
    saving: boolean;
    onSubmit: (payload: ItineraryFormInput) => void;
    labels: ItineraryModalLabels;
}

export default function ItineraryModal({
    open,
    onClose,
    leg = null,
    saving,
    onSubmit,
    labels,
}: ItineraryModalProps) {
    const isEdit = Boolean(leg?.id);
    const [form, setForm] = useState(EMPTY_FORM);

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

    const handleClose = () => {
        if (saving) return;
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
        });
    };

    const directions: Array<{ value: FlightDirection; label: string }> = [
        { value: FlightDirection.ARRIVAL, label: labels.arrival },
        { value: FlightDirection.DEPARTURE, label: labels.departure },
    ];

    const canSubmit =
        !saving &&
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
                        disabled={saving}
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
