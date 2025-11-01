import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Note } from "@/Types/api/note";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";
import { DeleteOutlined } from "@ant-design/icons";

interface Props extends IModalProps {
    note?: Note;
}

const DeleteNote: React.FC<Props> = ({ note, onClose, open }) => {
    const [deleteLoading, setDeleteLoading] = useState(false);

    // Handle single note deletion
    const handleDeleteNote = () => {
        if (!note) return;

        setDeleteLoading(true);
        router.delete(route("deal-notes.destroy", note.id), {
            onSuccess: () => {
                message.success("Note deleted successfully");
                onClose();
                setDeleteLoading(false);
                router.reload();
            },
            onError: () => {
                message.error("Failed to delete note");
                setDeleteLoading(false);
            },
        });
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleDeleteNote,
                loading: deleteLoading,
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