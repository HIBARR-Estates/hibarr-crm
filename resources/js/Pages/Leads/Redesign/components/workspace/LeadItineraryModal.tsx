import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import ItineraryModal, {
    type ItineraryFormInput,
} from "@/Components/Redesign/modals/ItineraryModal";
import useLeadItineraryMutations from "../../hooks/useLeadItineraryMutations";

interface LeadItineraryModalProps {
    open: boolean;
    onClose: () => void;
    leadId: number;
    /** Optional deal to attach the flight to when the lead has deals. */
    dealId?: number | null;
    leg?: ILeadFlightItinerary | null;
}

export default function LeadItineraryModal({
    open,
    onClose,
    leadId,
    dealId = null,
    leg = null,
}: LeadItineraryModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const isEdit = Boolean(leg?.id);
    const { createLeg, isCreating, updateLeg, isUpdating } =
        useLeadItineraryMutations();
    const saving = isCreating || isUpdating;

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const handleSubmit = (payload: ItineraryFormInput) => {
        if (isEdit && leg) {
            updateLeg(leg, payload, handleClose);
        } else {
            createLeg(
                { leadId, dealId: dealId ?? null },
                payload,
                handleClose,
            );
        }
    };

    return (
        <ItineraryModal
            open={open}
            onClose={handleClose}
            leg={leg}
            saving={saving}
            onSubmit={handleSubmit}
            labels={{
                addTitle: ft("add_flight"),
                editTitle: ft("edit_flight"),
                cancel: td("Cancel"),
                save: td("Save changes"),
                addSubmit: ft("add_flight"),
                arrival: ft("arrival"),
                departure: ft("departure"),
                direction: ft("direction"),
                flightNumber: ft("flight_number"),
                flightNumberPlaceholder: td("e.g. EK123"),
                airportName: ft("airport_name"),
                selectAirport: `${td("Select")} ${ft("airport")}`,
                date: t("app.date"),
                time: t("app.time"),
                transferQuestion: ft("airport_transfer_required_question"),
                yes: td("Yes"),
                no: td("No"),
            }}
        />
    );
}
