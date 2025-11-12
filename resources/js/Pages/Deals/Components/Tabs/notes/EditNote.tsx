import { Deal } from "@/Types/api/deals";
import { Note } from "@/Types/api/note";
import { IModalProps } from "@/Types/common";
import { router, useForm } from "@inertiajs/react";
import { Drawer, message } from "antd";
import { useState, useEffect } from "react";
import SaveNote from "./SaveNote";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";

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
    // route("deal-notes.update", note.id)
    const [errors, setErrors] = useState<string[]>([]);

    const handleCancel = () => {
        setErrors([]);
        onClose();
    };

    const { mutate, status } = useApiMutate<
        SaveNoteFormData,
        null,
        ApiResponse<null>
    >(
        route("deal-notes.update", note.id),
        "PUT",

        () => {
            handleCancel();
        }
    );
    const onSubmit = (data: SaveNoteFormData) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                console.log("was updated note ....");
                router.reload();
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

    return (
        <Drawer
            title="Edit Note"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <SaveNote
                deal={deal}
                note={note}
                onSubmit={onSubmit}
                onCancel={handleCancel}
                loading={isLoading({ status })}
                errors={errors}
            />
        </Drawer>
    );
};

export default EditNote;
