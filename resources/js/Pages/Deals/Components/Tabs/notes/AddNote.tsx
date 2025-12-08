import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { Drawer } from "antd";
import { useState } from "react";
import SaveNote from "./SaveNote";
import { useApiMutate } from "@/lib/api/client";
import { isLoading } from "@/lib/utils";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import { router } from "@inertiajs/react";

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
    >(
        route("deal-notes.store"),
        "POST",

        () => {
            handleCancel();
        }
    );
    const onSubmit = (data: SaveNoteFormData) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                console.log("was addded note ....");
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
            title="Add Note"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnClose
        >
            <SaveNote
                deal={deal}
                onSubmit={onSubmit}
                onCancel={handleCancel}
                loading={isLoading({ status })}
                errors={errors}
            />
        </Drawer>
    );
};

export default AddNote;
