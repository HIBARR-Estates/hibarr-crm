import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { Note } from "@/Types/api/note";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import React from "react";
import { DeleteOutlined } from "@ant-design/icons";
import { ApiResponse } from "@/lib/api/types";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";

interface Props extends IModalProps {
    note?: Note;
}

const DeleteNote: React.FC<Props> = ({ note, onClose, open }) => {
    const handleCancel = () => {
        onClose();
    };

    const { mutate, status } = useApiMutate<null, null, ApiResponse<null>>(
        route("deal-notes.destroy", note?.id),
        "DELETE",

        () => {
            handleCancel();
        }
    );
    const onSubmit = () => {
        mutate(null, {
            onSuccess: () => {
                console.log("was deleted note ....");
                router.reload();
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
