import React from "react";
import { Form, Checkbox, Row, Col, Typography, Button, Tooltip } from "antd";
import { DeleteOutlined } from "@ant-design/icons";
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
 * Supports multiple file uploads per document type.
 * The uploaded file URLs are stored as an array in documents_checklist.<key>.
 */
const DocumentsSection: React.FC<DocumentsSectionProps> = ({
    form,
    primaryCategory,
}) => {
    const handleUploadSuccess = (
        key: string,
        response: IUploadResponseItem | IUploadResponseItem[],
    ) => {
        const items = Array.isArray(response) ? response : [response];
        const newUrls = items.map((item) => item?.downloadUrl).filter(Boolean);

        if (newUrls.length === 0) return;

        // Append to existing URLs
        const existing = form.getFieldValue(["documents_checklist", key]);
        const currentUrls: string[] = Array.isArray(existing)
            ? existing
            : existing
              ? [existing]
              : [];

        form.setFieldValue(
            ["documents_checklist", key],
            [...currentUrls, ...newUrls],
        );
    };

    return (
        <div>
            <Text type="secondary" className="text-sm block mb-4">
                Upload required documents for this land listing. Check each item
                and attach the corresponding file(s).
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

/** Extract a short display name from a URL */
function getFileName(url: string): string {
    try {
        const pathname = new URL(url).pathname;
        const name = pathname.split("/").pop() || url;
        // Truncate if too long
        return name.length > 35 ? name.slice(0, 32) + "…" : name;
    } catch {
        return url.length > 35 ? url.slice(0, 32) + "…" : url;
    }
}

/** Individual document row: checkbox + conditional file uploader + file list */
const DocumentRow: React.FC<{
    docKey: string;
    label: string;
    form: FormInstance;
    onUploadSuccess: (
        response: IUploadResponseItem | IUploadResponseItem[],
    ) => void;
}> = ({ docKey, label, form, onUploadSuccess }) => {
    // Watch the stored URLs (may be string or string[])
    const rawValue = Form.useWatch(["documents_checklist", docKey], form);
    const urls: string[] = Array.isArray(rawValue)
        ? rawValue
        : rawValue
          ? [rawValue]
          : [];

    // Watch the checkbox state
    const checked = Form.useWatch(
        ["documents_checklist", `${docKey}_checked`],
        form,
    );

    const handleRemoveFile = (index: number) => {
        const updated = urls.filter((_, i) => i !== index);
        form.setFieldValue(
            ["documents_checklist", docKey],
            updated.length > 0 ? updated : undefined,
        );
    };

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
                    {urls.length > 0 && (
                        <Text type="success" className="text-xs ml-2">
                            ✓ {urls.length} file{urls.length !== 1 ? "s" : ""}{" "}
                            uploaded
                        </Text>
                    )}
                </Col>

                <Col xs={24} md={14}>
                    {checked && (
                        <>
                            {/* Hidden field to store the URL array */}
                            <Form.Item
                                name={["documents_checklist", docKey]}
                                hidden
                            >
                                <input type="hidden" />
                            </Form.Item>

                            {/* Existing file list */}
                            {urls.length > 0 && (
                                <div className="mb-2 space-y-1">
                                    {urls.map((url, index) => (
                                        <div
                                            key={index}
                                            className="flex items-center gap-2 bg-gray-50 rounded px-2 py-1 text-xs"
                                        >
                                            <a
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-600 hover:underline truncate flex-1"
                                            >
                                                {getFileName(url)}
                                            </a>
                                            <Tooltip title="Remove file">
                                                <Button
                                                    type="text"
                                                    size="small"
                                                    danger
                                                    icon={<DeleteOutlined />}
                                                    onClick={() =>
                                                        handleRemoveFile(index)
                                                    }
                                                    className="!px-1"
                                                />
                                            </Tooltip>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <FileUploader
                                targetFolder="property-documents"
                                accept=".pdf,.jpg,.jpeg,.png,.webp"
                                multiple
                                maxFiles={10}
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
