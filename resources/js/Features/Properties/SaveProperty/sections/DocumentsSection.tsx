import React from "react";
import { Form, Checkbox, Row, Col, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import FileUploader from "@/Components/FileUploader/FileUploader";
import type { IUploadResponseItem } from "@/Types/uploads";

const { Text } = Typography;

interface DocumentsSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
}

/** Document type definition */
interface DocumentType {
    key: string;
    label: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
    {
        key: "onboarding_contract_url",
        label: "Onboarding contract with Hibarr",
    },
    {
        key: "search_document_url",
        label: "Search document (land registry)",
    },
    { key: "sales_agreement_url", label: "Sales Agreement" },
    { key: "title_deed_copy_url", label: "Copy of Title Deed" },
    { key: "owner_passport_url", label: "Copy of Owner's Passport" },
    { key: "site_plan_url", label: "Site Plan or Layout" },
];

/**
 * Documents checklist section for land properties.
 * Each document has a checkbox; when checked, a file uploader is shown.
 * The uploaded file URL is stored in documents_checklist.<key>.
 * Having a URL stored is equivalent to "checked/completed".
 */
const DocumentsSection: React.FC<DocumentsSectionProps> = ({
    form,
    primaryCategory,
}) => {
    const handleUploadSuccess = (
        key: string,
        response: IUploadResponseItem | IUploadResponseItem[],
    ) => {
        const item = Array.isArray(response) ? response[0] : response;
        if (item?.downloadUrl) {
            form.setFieldValue(["documents_checklist", key], item.downloadUrl);
        }
    };

    return (
        <div>
            <Text type="secondary" className="text-sm block mb-4">
                Upload required documents for this land listing. Check each item
                and attach the corresponding file.
            </Text>

            {DOCUMENT_TYPES.map(({ key, label }) => (
                <DocumentRow
                    key={key}
                    docKey={key}
                    label={label}
                    form={form}
                    onUploadSuccess={(resp) => handleUploadSuccess(key, resp)}
                />
            ))}
        </div>
    );
};

/** Individual document row: checkbox + conditional file uploader */
const DocumentRow: React.FC<{
    docKey: string;
    label: string;
    form: FormInstance;
    onUploadSuccess: (
        response: IUploadResponseItem | IUploadResponseItem[],
    ) => void;
}> = ({ docKey, label, form, onUploadSuccess }) => {
    // Watch the hidden URL field to know if a file has been uploaded
    const urlValue = Form.useWatch(["documents_checklist", docKey], form);
    // Watch the checkbox state
    const checked = Form.useWatch(
        ["documents_checklist", `${docKey}_checked`],
        form,
    );

    return (
        <div className="border border-gray-200 rounded-md p-3 mb-3">
            <Row gutter={[16, 0]} align="middle">
                <Col xs={24} md={10}>
                    <Form.Item
                        name={["documents_checklist", `${docKey}_checked`]}
                        valuePropName="checked"
                        noStyle
                    >
                        <Checkbox>
                            <span className="font-medium">{label}</span>
                        </Checkbox>
                    </Form.Item>
                    {urlValue && (
                        <Text type="success" className="text-xs ml-2">
                            ✓ Uploaded
                        </Text>
                    )}
                </Col>

                <Col xs={24} md={14}>
                    {checked && (
                        <>
                            {/* Hidden field to store the URL */}
                            <Form.Item
                                name={["documents_checklist", docKey]}
                                hidden
                            >
                                <input type="hidden" />
                            </Form.Item>

                            <FileUploader
                                targetFolder="property-documents"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                maxFiles={1}
                                onSuccess={onUploadSuccess}
                            />
                        </>
                    )}
                </Col>
            </Row>
        </div>
    );
};

export default DocumentsSection;
