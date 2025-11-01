import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { router, useForm } from "@inertiajs/react";
import { Drawer, message, Modal } from "antd";
import { useState } from "react";
import SaveNote from "./SaveNote";

interface SaveNoteFormData {
    title: string;
    details: string;
    lead_id: number;
}

interface Props extends IModalProps {
    deal: Deal;
}

const AddNote: React.FC<Props> = ({ deal, onClose, open }) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const {
        data,
        setData,
        post,
        processing,
        errors: formErrors,
        reset,
    } = useForm<SaveNoteFormData>({
        title: "",
        details: "",
        lead_id: deal.id,
    });

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
        post(route("deal-notes.store"), {
            onSuccess: () => {
                message.success("Note created successfully");
                reset();
                setSaving(false);
                onClose();
                // Refresh the page to show the new note
                router.reload();
            },
            onError: (errors: any) => {
                setSaving(false);
                const errorMessages = Object.values(errors).flat().map(String);
                setErrors(errorMessages);
                message.error("Please check the form for errors");
            },
        });
    };

    const handleCancel = () => {
        reset();
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
            title="Add Deal Note"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnClose
        >
            <SaveNote
                deal={deal}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing || saving}
                errors={allErrors}
            />
        </Drawer>
    );
};

export default AddNote;
