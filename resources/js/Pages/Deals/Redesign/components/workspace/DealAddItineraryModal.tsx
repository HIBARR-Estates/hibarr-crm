import { useEffect, useState } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { FlightDirection } from "@/Types/api/lead-flight-itinerary";
import useDealItinerary, {
    DealItineraryCreateInput,
} from "../../hooks/useDealItinerary";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealAddItineraryModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
}

const EMPTY_FORM = {
    direction: FlightDirection.ARRIVAL,
    flight_number: "",
    // v2.2 default (deal-v2-2.jsx:2956) — most HIBARR inspection trips fly
    // into Ercan, so it's a sensible starting value rather than empty.
    airport_name: "Ercan (ECN)",
    date: "",
    time: "12:00",
    is_transfer_required: false,
};

/** Flight itinerary composer, moved from an inline panel in
 * WorkspaceItineraryTab into a modal — matching every other "add" flow in
 * this workspace (DealAddTaskModal, DealScheduleMeetingModal, ...). */
export default function DealAddItineraryModal({
    open,
    onClose,
    dealId,
}: DealAddItineraryModalProps) {
    const { t } = useTranslation();
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const [form, setForm] = useState(EMPTY_FORM);
    const { createLeg, isCreating } = useDealItinerary(dealId);

    useEffect(() => {
        if (!open) setForm(EMPTY_FORM);
    }, [open]);

    const handleClose = () => {
        if (isCreating) return;
        onClose();
    };

    const handleSubmit = () => {
        if (!form.flight_number.trim() || !form.date) return;
        const payload: DealItineraryCreateInput = {
            direction: form.direction,
            flight_number: form.flight_number.trim().toUpperCase(),
            airport_name: form.airport_name,
            flight_date: `${form.date} ${form.time}:00`,
            is_transfer_required: form.is_transfer_required,
        };
        createLeg(payload, handleClose);
    };

    return (
        <DealModal
            open={open}
            title={`+ ${ft("add_flight")}`}
            onClose={handleClose}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isCreating}
                    >
                        {t("app.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        loading={isCreating}
                        disabled={
                            isCreating || !form.flight_number.trim() || !form.date
                        }
                    >
                        {ft("add_flight")}
                    </DealButton>
                </>
            }
        >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DealModalField label={ft("direction")}>
                    <select
                        value={form.direction}
                        disabled={isCreating}
                        onChange={(e) =>
                            setForm({
                                ...form,
                                direction: e.target.value as FlightDirection,
                            })
                        }
                    >
                        <option value={FlightDirection.ARRIVAL}>
                            {ft("arrival")}
                        </option>
                        <option value={FlightDirection.DEPARTURE}>
                            {ft("departure")}
                        </option>
                    </select>
                </DealModalField>
                <DealModalField label={ft("flight_number")}>
                    <input
                        value={form.flight_number}
                        disabled={isCreating}
                        autoFocus
                        onChange={(e) =>
                            setForm({ ...form, flight_number: e.target.value })
                        }
                        placeholder="e.g. PC 1234"
                    />
                </DealModalField>
                <DealModalField label={ft("airport_name")}>
                    <input
                        value={form.airport_name}
                        disabled={isCreating}
                        onChange={(e) =>
                            setForm({ ...form, airport_name: e.target.value })
                        }
                    />
                </DealModalField>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <DealModalField label={t("app.date")}>
                    <input
                        type="date"
                        value={form.date}
                        disabled={isCreating}
                        onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                </DealModalField>
                <DealModalField label={t("app.time")}>
                    <input
                        type="time"
                        value={form.time}
                        disabled={isCreating}
                        onChange={(e) => setForm({ ...form, time: e.target.value })}
                    />
                </DealModalField>
                <DealModalField label={ft("transfer")}>
                    <button
                        type="button"
                        role="switch"
                        aria-checked={form.is_transfer_required}
                        disabled={isCreating}
                        onClick={() =>
                            setForm({
                                ...form,
                                is_transfer_required: !form.is_transfer_required,
                            })
                        }
                        className="inline-flex items-center gap-2 border-0 bg-transparent p-0"
                        style={{ cursor: isCreating ? "default" : "pointer" }}
                    >
                        <span
                            className="relative inline-block h-5 w-[34px] shrink-0 rounded-full"
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
                        <span className="text-[13px]">
                            {form.is_transfer_required ? t("app.yes") : t("app.no")}
                        </span>
                    </button>
                </DealModalField>
            </div>
        </DealModal>
    );
}
