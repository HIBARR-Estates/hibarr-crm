import ImportModal from "@/Components/Common/ImportModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";

type Props = IModalProps;

const ImportLeads: React.FC<Props> = ({ open, onClose }) => {
    const [importLoading, setImportLoading] = useState(false);

    // Import handler
    const handleImport = (formData: FormData) => {
        console.log("handleImport called with formData:", formData);

        // Debug: Log FormData contents
        for (let pair of formData.entries()) {
            console.log("FormData entry:", pair[0], pair[1]);
        }

        setImportLoading(true);

        // Convert FormData to object for Inertia
        const formDataObject: { [key: string]: File | string } = {};
        formData.forEach((value, key) => {
            formDataObject[key] = value;
        });

        console.log("FormData object:", formDataObject);

        router.post(route("lead-contact.import.store"), formDataObject, {
            forceFormData: true, // Force Inertia to send as FormData
            onSuccess: (response) => {
                console.log("Import success:", response);
                message.success(
                    "Import has been queued. Leads will appear shortly if the queue worker is running."
                );
                onClose();
                // X2: refresh just the leads list
                router.reload({ only: ["leads"] });
            },
            onError: (errors) => {
                console.error("Import errors:", errors);
                const errorMessage = Object.values(errors).flat().join(", ");
                message.error(errorMessage || "Import failed");
            },
            onFinish: () => {
                setImportLoading(false);
            },
        });
    };

    return (
        <ImportModal
            visible={open}
            onClose={onClose}
            onSubmit={handleImport}
            loading={importLoading}
            title="Import Leads"
            sampleDownloadUrl={route("lead-contact.sample_import")}
            description="Import multiple leads at once using an Excel file. Make sure to follow the template format for successful import."
            acceptedFileTypes=".xlsx,.xls"
            maxFileSize={10}
        />
    );
};

export default ImportLeads;
