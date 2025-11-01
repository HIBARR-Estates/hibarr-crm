import { Lead } from "@/Types";
import { IModalProps } from "@/Types/common";
import { Drawer } from "antd";
import React from "react";
import { router } from "@inertiajs/react";

interface Props extends IModalProps {
    lead?: Lead;
}

const ChangeToClient: React.FC<Props> = ({ lead, onClose, open }) => {
    const handleCancel = () => {
        onClose();
    };

    const handleConvert = () => {
        if (lead) {
            // Navigate to client creation form with lead data
            router.get(route('clients.create'), { lead: lead.id });
        }
        onClose();
    };

    return (
        <Drawer
            title={`Change Lead to Client${
                lead ? `: ${lead.client_name}` : ""
            }`}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
        >
            <div className="space-y-4">
                <p>
                    Converting this lead to a client will create a new client record 
                    with the lead's information pre-filled.
                </p>
                
                {lead && (
                    <div className="border rounded-lg p-4 bg-gray-50">
                        <h4 className="font-medium mb-2">Lead Information:</h4>
                        <div className="space-y-1 text-sm">
                            <p><strong>Name:</strong> {lead.client_name}</p>
                            <p><strong>Email:</strong> {lead.client_email}</p>
                            <p><strong>Company:</strong> {lead.company_name || 'N/A'}</p>
                            <p><strong>Mobile:</strong> {lead.mobile || 'N/A'}</p>
                        </div>
                    </div>
                )}
                
                <div className="flex justify-end space-x-2 pt-4">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConvert}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                        Convert to Client
                    </button>
                </div>
            </div>
        </Drawer>
    );
};

export default ChangeToClient;
