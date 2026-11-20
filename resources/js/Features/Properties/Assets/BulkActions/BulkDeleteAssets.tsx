import ConfirmationModal from "@/Components/Common/ConfirmationModal";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import { router } from "@inertiajs/react";
import { DeleteOutlined } from "@ant-design/icons";
import { pluralOrSingular } from "@/lib/utils";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props extends IModalProps {
    ids: number[];
    propertyId: number;
}

const BulkDeleteAssets: React.FC<Props> = ({ open, onClose, ids, propertyId }) => {
    const { td } = useTd();
    interface BulkDeletePayload {
        asset_ids: number[];
        action_type: string;
    }

    const { mutate: deleteBulkAssets, isPending: isDeleting } = useApiMutate<
        BulkDeletePayload,
        Record<string, any>,
        ApiResponse<Record<string, any>>
    >(
        route("properties.assets.bulk_action", propertyId),
        "POST",
        () => {
            onClose(true);
            router.reload({ only: ["assets"] });
        }
    );

    const handleBulkDelete = () => {
        deleteBulkAssets({
            asset_ids: ids,
            action_type: "delete",
        });
    };

    return (
        <ConfirmationModal
            open={open}
            onClose={onClose}
            onSubmit={{
                fn: handleBulkDelete,
                loading: isDeleting,
            }}
            title={td("Delete Selected Assets", { source: "en" })}
            description={`Are you sure you want to delete ${pluralOrSingular(
                ids.length,
                "this asset",
                "assets"
            )}? This action cannot be undone.`}
            icon={<DeleteOutlined className="text-red-500 text-3xl" />}
            confirmText={td("Yes, Delete All", { source: "en" })}
            cancelText={td("Cancel", { source: "en" })}
            confirmType="primary"
            confirmDanger={true}
        />
    );
};

export default BulkDeleteAssets;
