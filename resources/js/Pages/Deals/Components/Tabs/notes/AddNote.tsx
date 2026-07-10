import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { Modal } from "antd";
import { useState } from "react";
import SaveNote from "./SaveNote";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { router } from "@inertiajs/react";
import "@/Components/Common/note-modal.css";

interface SaveNoteFormData {
    title: string;
    details: string;
    lead_id: number;
}

interface Props extends IModalProps {
    deal: Deal;
}

const AddNote: React.FC<Props> = ({ deal, onClose, open }) => {
    const [errors, setErrors] = useState<string[]>([]);

    const handleCancel = () => {
        setErrors([]);
        onClose();
    };

    const { mutate, status } = useApiMutate<
        SaveNoteFormData,
        null,
        ApiResponse<null>
    >(route("deal-notes.store"), "POST");

    const onSubmit = (data: SaveNoteFormData) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                router.reload();
                handleCancel();
            },
            onError: (errorResponse) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors((prev) => [
                    ...prev,
                    ...Object.values(responseErrors).flat(),
                ]);
            },
        });
    };

    const loading = isLoading({ status });

    return (
        <Modal
            className="note-modal"
            title={null}
            open={open}
            onCancel={handleCancel}
            footer={null}
            width={700}
            centered
            destroyOnHidden
            maskClosable={!loading}
            closable={!loading}
        >
            <div className="px-6 pt-6 pb-5 pr-14 border-b border-gray-100 shrink-0">
                <h2 className="text-xl font-semibold text-gray-900 leading-tight">
                    Add Note
                </h2>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-5">
                <SaveNote
                    deal={deal}
                    onSubmit={onSubmit}
                    onCancel={handleCancel}
                    loading={loading}
                    errors={errors}
                />
            </div>
        </Modal>
    );
};

export default AddNote;
