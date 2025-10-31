import { Deal } from "@/Types/api/deals";
import { Note } from "@/Types/api/note";
import { IModalProps } from "@/Types/common";
import { router, useForm } from "@inertiajs/react";
import { Drawer, message } from "antd";
import { useState, useEffect } from "react";
import SaveNote from "./SaveNote";

interface SaveNoteFormData {
    title: string;
    details: string;
    lead_id: number;
}

interface Props extends IModalProps {
    deal: Deal;
    note: Note;
}

const EditNote: React.FC<Props> = ({ deal, note, onClose, open }) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const {
        data,
        setData,
        put,
        processing,
        errors: formErrors,
        reset,
    } = useForm<SaveNoteFormData>({
        title: note.title,
        details: note.details,
        lead_id: deal.id,
    });

    // Update form when note changes
    useEffect(() => {
        if (note) {
            setData({
                title: note.title,
                details: note.details,
                lead_id: deal.id,
            });
        }
    }, [note, setData, deal.id]);

    const handleSubmit = (formData: SaveNoteFormData) => {
        setSaving(true);
        setErrors([]);

        // Update the form data first
        setData({
            title: formData.title,
            details: formData.details,
            lead_id: deal.id,
        });

        // Use setTimeout to ensure setData has updated the form
        setTimeout(() => {
            put(route("deal-notes.update", note.id), {
                onSuccess: () => {
                    message.success("Note updated successfully");
                    setSaving(false);
                    onClose();
                    // Refresh the page to show the updated note
                    router.reload();
                },
                onError: (errors: any) => {
                    setSaving(false);
                    const errorMessages = Object.values(errors)
                        .flat()
                        .map(String);
                    setErrors(errorMessages);
                    message.error("Please check the form for errors");
                },
            });
        }, 0);
    };

    const handleCancel = () => {
        setErrors([]);
        onClose();
    };

    // Combine form errors with manual errors
    const allErrors = [
        ...errors,
        ...Object.values(formErrors).flat().map(String),
    ];

    return (
        <Drawer
            title="Edit Deal Note"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnClose
        >
            <SaveNote
                deal={deal}
                note={note}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing || saving}
                errors={allErrors}
            />
        </Drawer>
    );
};

export default EditNote;
