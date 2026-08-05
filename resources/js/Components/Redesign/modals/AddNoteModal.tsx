import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";

export interface AddNoteFormState {
    title: string;
    text: string;
}

export interface AddNoteModalLabels {
    title: string;
    cancel: string;
    submit: string;
    titleField: string;
    titlePlaceholder: string;
    detailsField: string;
    bodyPlaceholder: string;
}

const INITIAL_FORM: AddNoteFormState = { title: "", text: "" };

interface AddNoteModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    onSubmit: (form: AddNoteFormState) => void;
    labels: AddNoteModalLabels;
}

export default function AddNoteModal({
    open,
    onClose,
    saving,
    errors,
    onSubmit,
    labels,
}: AddNoteModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<AddNoteFormState>(INITIAL_FORM);

    useEffect(() => {
        if (!open) {
            setForm(INITIAL_FORM);
        }
    }, [open]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    const handleSubmit = () => {
        onSubmit(form);
    };

    return (
        <Modal
            open={open}
            title={labels.title}
            onClose={handleClose}
            dirty={Boolean(form.title.trim() || form.text.trim())}
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
                        disabled={!form.text.trim() || saving}
                        loading={saving}
                    >
                        {labels.submit}
                    </Button>
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

            <ModalField label={labels.titleField}>
                <input
                    value={form.title}
                    autoFocus
                    disabled={saving}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            title: event.target.value,
                        }))
                    }
                    placeholder={labels.titlePlaceholder}
                />
            </ModalField>

            <ModalField label={labels.detailsField}>
                <textarea
                    value={form.text}
                    disabled={saving}
                    onChange={(event) =>
                        setForm((current) => ({
                            ...current,
                            text: event.target.value,
                        }))
                    }
                    placeholder={labels.bodyPlaceholder}
                    rows={6}
                    style={{ resize: "vertical" }}
                />
            </ModalField>
        </Modal>
    );
}
