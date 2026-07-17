import ImportModal from "@/Components/Common/ImportModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";

type Props = IModalProps;

const ImportLeads: React.FC<Props> = ({ open, onClose }) => {
    const [importLoading, setImportLoading] = useState(false);

    const handleImport = (formData: FormData) => {
        setImportLoading(true);

        const formDataObject: { [key: string]: File | string } = {};
        formData.forEach((value, key) => {
            formDataObject[key] = value;
        });

        router.post(route("lead-contact.import.store"), formDataObject, {
            forceFormData: true,
            onSuccess: () => {
                onClose();
                router.reload({ only: ["leads"] });
            },
            onError: (errors) => {
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
