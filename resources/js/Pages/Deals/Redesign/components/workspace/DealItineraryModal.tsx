import useTranslation from "@/Hooks/useTranslation";
import type { ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import ItineraryModal, {
    type ItineraryFormInput,
} from "@/Components/Redesign/modals/ItineraryModal";
import useDealItinerary from "../../hooks/useDealItinerary";

interface DealItineraryModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    /** When set, the modal edits this leg instead of creating a new one. */
    leg?: ILeadFlightItinerary | null;
}

export default function DealItineraryModal({
    open,
    onClose,
    dealId,
    leg = null,
}: DealItineraryModalProps) {
    const { t } = useTranslation();
    const ft = (key: string) => t(`pages.flight_itinerary.${key}`);
    const isEdit = Boolean(leg?.id);
    const { createLeg, isCreating, updateLeg, isUpdating } =
        useDealItinerary(dealId);
    const saving = isCreating || isUpdating;

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const handleSubmit = (payload: ItineraryFormInput) => {
        if (isEdit && leg) {
            updateLeg(leg, payload, handleClose);
        } else {
            createLeg(payload, handleClose);
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
                cancel: t("pages.deals.common.cancel"),
                save: t("pages.deals.common.save_changes"),
                addSubmit: ft("add_flight"),
                arrival: ft("arrival"),
                departure: ft("departure"),
                direction: ft("direction"),
                flightNumber: ft("flight_number"),
                flightNumberPlaceholder: t(
                    "pages.deals.workspace.itinerary.flight_number_placeholder",
                ),
                airportName: ft("airport_name"),
                selectAirport: `${t("pages.deals.common.select")} ${ft("airport")}`,
                date: t("app.date"),
                time: t("app.time"),
                transferQuestion: ft("airport_transfer_required_question"),
                yes: t("pages.deals.common.yes"),
                no: t("pages.deals.common.no"),
            }}
        />
    );
}
