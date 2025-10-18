import ExportModal from "@/Components/Common/ExportModal";
import ImportModal from "@/Components/Common/ImportModal";
import { IModalProps } from "@/Types/common";
import { router } from "@inertiajs/react";
import { message } from "antd";
import React, { useState } from "react";

type Props = IModalProps;

const ExportProperties: React.FC<Props> = ({ open, onClose }) => {
    const [exportLoading, setExportLoading] = useState(false);
    // Import handler
    // Export handler
    const handleExport = (exportFilters: any) => {
        setExportLoading(true);

        // Create a form and submit it to trigger file download
        const form = document.createElement("form");
        form.method = "POST";
        form.action = route("properties.export");
        form.style.display = "none";

        // Add CSRF token
        const csrfToken = document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content");
        if (csrfToken) {
            const csrfInput = document.createElement("input");
            csrfInput.type = "hidden";
            csrfInput.name = "_token";
            csrfInput.value = csrfToken;
            form.appendChild(csrfInput);
        }

        // Add export filters
        Object.keys(exportFilters).forEach((key) => {
            if (
                exportFilters[key] !== undefined &&
                exportFilters[key] !== null &&
                exportFilters[key] !== ""
            ) {
                const input = document.createElement("input");
                input.type = "hidden";
                input.name = key;
                input.value = exportFilters[key];
                form.appendChild(input);
            }
        });

        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);

        // Close modal and reset loading state
        setTimeout(() => {
            setExportLoading(false);
            onClose();
            message.success("Export started successfully");
        }, 1000);
    };
    return (
        <ExportModal
            visible={open}
            onClose={onClose}
            onExport={handleExport}
            loading={exportLoading}
            title="Export Properties"
            description="Configure filters and export property data to Excel format."
        />
    );
};

export default ExportProperties;
