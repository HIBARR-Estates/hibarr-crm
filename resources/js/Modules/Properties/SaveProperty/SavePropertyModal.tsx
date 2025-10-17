import CreateProperty from "@/Pages/Properties/Create";
import { IndexProps } from "@/Pages/Properties/Index";
import { Property } from "@/Types";
import { IModalProps } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import { Drawer, message } from "antd";
import React from "react";

interface Props extends IModalProps {
    property?: Property;
    setProperty?: (property: Property | undefined) => void;
}

const SavePropertyModal: React.FC<Props> = ({
    property,
    onClose,
    open,
    setProperty,
}) => {
    return (
        <Drawer
            title="Create New Property"
            placement="right"
            size="large"
            open={open}
            onClose={onClose}
            // width="80%"
            // style={{ maxWidth: "1200px" }}
        >
            <CreateProperty
                visible={open}
                property={property}
                setProperty={setProperty}
                products={[]}
                onClose={onClose}
                onSuccess={() => {
                    onClose();
                    // Refresh the properties list
                    router.reload();
                    message.success("Property created successfully");
                }}
            />
        </Drawer>
    );
};

export default SavePropertyModal;
