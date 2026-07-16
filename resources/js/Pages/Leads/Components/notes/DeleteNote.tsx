import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { LeadNote } from "@/Types/api/lead-note";
import { IModalProps } from "@/Types/common";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";

interface Props extends IModalProps {
    note?: LeadNote;
    onDeleted?: (noteId: number) => void;
}

const DeleteNote: React.FC<Props> = ({ note, onClose, open, onDeleted }) => {
    const handleCancel = () => {
        onClose();
    };

    const { mutate, status } = useApiMutate<null, null, ApiResponse<null>>(
        route("lead-notes.destroy", { lead_note: Number(note?.id) }),
        "DELETE",
        () => {
            handleCancel();
        },
    );

    const onSubmit = () => {
        mutate(null, {
            onSuccess: () => {
                if (note?.id) {
                    onDeleted?.(note.id);
                }
            },
        });
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: onSubmit,
                loading: isLoading({ status }),
            }}
            title="Delete Note"
            description={
                note
                    ? `Are you sure you want to delete "${note?.title}"? This action cannot be undone.`
                    : "Are you sure you want to delete this note? This action cannot be undone."
            }
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText="Yes, Delete"
            cancelText="Cancel"
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default DeleteNote;
