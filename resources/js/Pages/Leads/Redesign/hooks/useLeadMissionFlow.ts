import { useCallback, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import type { Deal } from "@/Types/api/deals";
import type { LeadMissionCtaAction } from "../types";
import type useLeadQualificationWorkspace from "./useLeadQualificationWorkspace";

type QualificationWorkspace = ReturnType<typeof useLeadQualificationWorkspace>;

interface UseLeadMissionFlowArgs {
    qualification: QualificationWorkspace;
    deals: Deal[];
    changeStatus: (statusKey: string) => unknown;
    /** Opens or closes the qualification call (QualifyModal). */
    setQualificationOpen: (open: boolean) => void;
    /** "view answers": where the page shows the answers. Omitted when it has nowhere to. */
    onViewAnswers?: () => void;
    /** "Open deal" when no single deal can be opened. */
    onShowDeals?: () => void;
}

/**
 * The lifecycle mission's actions (start or resume the qualification, create
 * or open a deal, reactivate, view answers) and the open state of the
 * template picker and the create-deal form. Shared by the lead page and the
 * agent workspace's contact page; LeadMissionModals renders the modals.
 */
export default function useLeadMissionFlow({
    qualification,
    deals,
    changeStatus,
    setQualificationOpen,
    onViewAnswers,
    onShowDeals,
}: UseLeadMissionFlowArgs) {
    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [createDealOpen, setCreateDealOpen] = useState(false);

    const primaryDeal = useMemo((): Deal | null => {
        if (deals.length === 0) return null;
        // Prefer highest id as latest when order is ambiguous.
        return [...deals].sort((a, b) => b.id - a.id)[0] ?? null;
    }, [deals]);

    const handleTemplateSelect = useCallback(
        async (templateId: string) => {
            // Open first so this feels instant; the start call and script
            // load show inside the modal.
            setTemplatePickerOpen(false);
            setQualificationOpen(true);

            const started = await qualification.startQualificationScript(templateId);
            if (!started) {
                // Start failed — don't leave an empty modal hanging.
                setQualificationOpen(false);
            }
        },
        [qualification, setQualificationOpen],
    );

    const openTemplatePicker = useCallback(() => {
        if (qualification.templates.length === 1) {
            void handleTemplateSelect(qualification.templates[0].id);
            return;
        }
        setTemplatePickerOpen(true);
    }, [handleTemplateSelect, qualification.templates]);

    const handleMissionAction = useCallback(
        (action: LeadMissionCtaAction) => {
            switch (action) {
                case "qualify_start":
                    openTemplatePicker();
                    break;
                case "qualify_resume": {
                    const active =
                        qualification.current?.status === "inProgress"
                            ? qualification.current
                            : qualification.history.find((run) => run.status === "inProgress") ?? null;
                    if (!active) break;
                    // Modal first — the tree load shows inside it.
                    setQualificationOpen(true);
                    void qualification.resumeQualification(active);
                    break;
                }
                case "create_deal":
                    setCreateDealOpen(true);
                    break;
                case "open_deal":
                    if (primaryDeal?.id) {
                        router.visit(route("deals.show", primaryDeal.id));
                    } else if (deals.length > 0) {
                        onShowDeals?.();
                    }
                    break;
                case "reactivate":
                    void changeStatus("new");
                    break;
                case "view_answers":
                    onViewAnswers?.();
                    break;
                default:
                    break;
            }
        },
        [changeStatus, deals.length, onShowDeals, onViewAnswers, openTemplatePicker, primaryDeal, qualification, setQualificationOpen],
    );

    return {
        primaryDeal,
        templatePickerOpen,
        closeTemplatePicker: () => setTemplatePickerOpen(false),
        handleTemplateSelect,
        openTemplatePicker,
        createDealOpen,
        openCreateDeal: () => setCreateDealOpen(true),
        closeCreateDeal: () => setCreateDealOpen(false),
        handleMissionAction,
    };
}

export type LeadMissionFlow = ReturnType<typeof useLeadMissionFlow>;
