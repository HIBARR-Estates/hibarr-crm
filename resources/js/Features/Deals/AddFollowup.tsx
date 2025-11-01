import { Deal } from "@/Types";
import { IModalProps } from "@/Types/common";
import { Drawer, Form } from "antd";
import React from "react";
import { router } from "@inertiajs/react";

interface Props extends IModalProps {
    deal?: Deal;
}

const AddFollowUp: React.FC<Props> = ({ deal, onClose, open }) => {
    const handleCancel = () => {
        onClose();
    };

  

    return (
        <Drawer
            title={`Add Follow Up`}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <Form>
               {/* Please complete the component, the original implementation can be found here - leads/followup/create.blade.php. Refer to the DealController to get a sense of the intended functionality */}
            </Form>
        </Drawer>
    );
};

export default AddFollowUp;
