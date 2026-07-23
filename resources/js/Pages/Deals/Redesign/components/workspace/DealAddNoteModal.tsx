import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useDealNoteCreate from "../../hooks/useDealNoteCreate";
import DealButton from "../primitives/DealButton";
import { DealModal, DealModalField } from "../primitives/DealModal";

interface DealAddNoteModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
}

interface NoteFormState {
    title: string;
    text: string;
}

const INITIAL_FORM: NoteFormState = { title: "", text: "" };

/** Ported from v2.2's Notes composer (deal-v2-2.jsx:1614-1630) as a modal. */
export default function DealAddNoteModal({
    open,
    onClose,
    dealId,
}: DealAddNoteModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [form, setForm] = useState<NoteFormState>(INITIAL_FORM);
    const { createNote, isSaving, errors, clearErrors } =
        useDealNoteCreate(dealId);

    useEffect(() => {
        if (!open) {
            setForm(INITIAL_FORM);
            clearErrors();
        }
    }, [clearErrors, open]);

    const handleClose = () => {
        if (isSaving) return;
        onClose();
    };

    const handleSubmit = () => {
        createNote(
            { text: form.text, title: form.title },
            () => {
                setForm(INITIAL_FORM);
                handleClose();
            },
        );
    };

    return (
        <DealModal
            open={open}
            title={t("pages.deals.workspace.notes.add_note")}
            onClose={handleClose}
            dirty={Boolean(form.title.trim() || form.text.trim())}
            footer={
                <>
                    <DealButton
                        variant="ghost"
                        onClick={handleClose}
                        disabled={isSaving}
                    >
                        {t("pages.deals.common.cancel")}
                    </DealButton>
                    <DealButton
                        variant="primary"
                        onClick={handleSubmit}
                        disabled={!form.text.trim() || isSaving}
                        loading={isSaving}
                    >
                        {t("pages.deals.workspace.notes.save")}
                    </DealButton>
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {td(error)}
                        </p>
                    ))}
                </div>
            )}

            <DealModalField label={t("pages.deals.workspace.notes.title_label")}>
                <input
                    value={form.title}
                    autoFocus
                    disabled={isSaving}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            title: event.target.value,
                        }))
                    }
                    placeholder={t("pages.deals.workspace.notes.title_placeholder")}
                />
            </DealModalField>

            <DealModalField label={t("pages.deals.workspace.notes.details_label")}>
                <textarea
                    value={form.text}
                    disabled={isSaving}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            text: event.target.value,
                        }))
                    }
                    placeholder={t("pages.deals.workspace.notes.body_placeholder")}
                    rows={6}
                    style={{ resize: "vertical" }}
                />
            </DealModalField>
        </DealModal>
    );
}
