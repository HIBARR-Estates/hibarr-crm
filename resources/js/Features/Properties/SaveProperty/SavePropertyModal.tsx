import CreateProperty from "@/Pages/Properties/Create";
import { IndexProps } from "@/Pages/Properties/Index";
import { Property } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import { Modal } from "antd";
import React from "react";

interface Props extends Omit<IModalProps, "onClose"> {
    property?: Property;
    setProperty?: (property: Property | undefined) => void;
    onClose: () => void;
}

const SavePropertyModal: React.FC<Props> = ({
    property,
    onClose,
    open,
    setProperty,
}) => {
    const isEditing = !!property?.id;
    const title = isEditing ? "Edit Property" : "Create New Property";

    const handleSuccess = () => {
        onClose();
        // Refresh the properties list to show newly created/updated property
        router.reload({ only: ["properties"] });
    };

    return (
        <Modal
            title={title}
            // placement="right"
            // size="large"
            open={open}
            onCancel={onClose}
            footer={null}
            width={1000}
            destroyOnHidden
            maskClosable={false}
            className="top-8"
        >
            <CreateProperty
                visible={open}
                property={property}
                setProperty={setProperty}
                products={[]}
                onClose={onClose}
                onSuccess={handleSuccess}
            />
        </Modal>
    );
};

export default SavePropertyModal;
