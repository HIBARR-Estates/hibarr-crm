import { useEffect, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import MeetingFormFields from "@/Components/Redesign/meeting/MeetingFormFields";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";

export interface EditMeetingModalLabels {
    title: string;
    cancel: string;
    submit: string;
}

interface EditMeetingModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    /** Null until followup is ready — modal renders nothing. */
    initialForm: MeetingFormState | null;
    onSubmit: (form: MeetingFormState) => void;
    labels: EditMeetingModalLabels;
    showExistingMeetingLinkHint?: boolean;
}

export default function EditMeetingModal({
    open,
    onClose,
    saving,
    errors,
    meetingTypes,
    initialForm,
    onSubmit,
    labels,
    showExistingMeetingLinkHint = true,
}: EditMeetingModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<MeetingFormState | null>(null);

    useEffect(() => {
        if (open && initialForm) {
            setForm(initialForm);
        }
    }, [open, initialForm]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    if (!form) return null;

    return (
        <Modal
            open={open}
            title={labels.title}
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
                        onClick={() => onSubmit(form)}
                        loading={saving}
                        disabled={saving}
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

            <MeetingFormFields
                form={form}
                onChange={(patch) =>
                    setForm((current) =>
                        current ? { ...current, ...patch } : current,
                    )
                }
                meetingTypes={meetingTypes}
                disabled={saving}
                showExistingMeetingLinkHint={showExistingMeetingLinkHint}
            />
        </Modal>
    );
}
