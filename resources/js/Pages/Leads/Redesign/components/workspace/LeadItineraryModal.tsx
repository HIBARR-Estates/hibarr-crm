import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ILeadFlightItinerary } from "@/Types/api/lead-flight-itinerary";
import ItineraryModal, {
    type ItineraryFormInput,
} from "@/Components/Redesign/modals/ItineraryModal";
import useLeadItineraryMutations from "../../hooks/useLeadItineraryMutations";

const FLIGHT_ITINERARY_EXTRACTION_FLAG = "crm.flight-itinerary-extraction";

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
    const page = usePage();
    const featureFlags =
        (page.props.featureFlags as Record<string, boolean> | undefined) ?? {};
    const showOcrScanner = featureFlags[FLIGHT_ITINERARY_EXTRACTION_FLAG] === true;
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
            showOcrScanner={showOcrScanner}
            labels={{
                addTitle: ft("add_flight"),
                editTitle: ft("edit_flight"),
                cancel: td("Cancel", { source: "en" }),
                save: td("Save changes", { source: "en" }),
                addSubmit: ft("add_flight"),
                arrival: ft("arrival"),
                departure: ft("departure"),
                direction: ft("direction"),
                flightNumber: ft("flight_number"),
                flightNumberPlaceholder: td("e.g. EK123", { source: "en" }),
                airportName: ft("airport_name"),
                selectAirport: `${td("Select", { source: "en" })} ${ft("airport")}`,
                date: t("app.date"),
                time: t("app.time"),
                transferQuestion: ft("airport_transfer_required_question"),
                yes: td("Yes", { source: "en" }),
                no: td("No", { source: "en" }),
                flightPlanImage: ft("flight_plan_image"),
                uploadFlightPlan: ft("upload_flight_plan"),
                removeFlightPlan: ft("remove_flight_plan"),
                uploadingFlightPlan: ft("uploading_flight_plan"),
            }}
        />
    );
}
