import useTranslation from "@/Hooks/useTranslation";
import AddNoteModal, {
    type AddNoteFormState,
} from "@/Components/Redesign/modals/AddNoteModal";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";

interface DealAddNoteModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    sourceEmailMessageId?: string | null;
}

export default function DealAddNoteModal({
    open,
    onClose,
    dealId,
    sourceEmailMessageId = null,
}: DealAddNoteModalProps) {
    const { t } = useTranslation();
    const { createNote, isSaving, errors, clearErrors } =
        useDealNoteCreate(dealId);

    const handleClose = () => {
        if (isSaving) return;
        clearErrors();
        onClose();
    };

    const handleSubmit = (form: AddNoteFormState) => {
        createNote(
            {
                text: form.text,
                title: form.title,
                sourceEmailMessageId,
            },
            handleClose,
        );
    };

    return (
        <AddNoteModal
            open={open}
            onClose={handleClose}
            saving={isSaving}
            errors={errors}
            onSubmit={handleSubmit}
            labels={{
                title: t("pages.deals.workspace.notes.add_note"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("pages.deals.workspace.notes.save"),
                titleField: t("pages.deals.workspace.notes.title_label"),
                titlePlaceholder: t(
                    "pages.deals.workspace.notes.title_placeholder",
                ),
                detailsField: t("pages.deals.workspace.notes.details_label"),
                bodyPlaceholder: t(
                    "pages.deals.workspace.notes.body_placeholder",
                ),
            }}
        />
    );
}
