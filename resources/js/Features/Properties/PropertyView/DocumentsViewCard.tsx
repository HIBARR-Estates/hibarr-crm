import React from "react";
import { Card, Tag, Typography, Row, Col } from "antd";
import {
    FolderOpenOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    FileOutlined,
} from "@ant-design/icons";
import { Property, DocumentsChecklist } from "@/Types";

const { Text } = Typography;

interface DocumentsViewCardProps {
    property: Property;
}

const DOCUMENT_LABELS: { key: keyof DocumentsChecklist; label: string }[] = [
    { key: "onboarding_contract_url", label: "Onboarding Contract" },
    { key: "search_document_url", label: "Search Document" },
    { key: "sales_agreement_url", label: "Sales Agreement" },
    { key: "title_deed_copy_url", label: "Title Deed Copy" },
    { key: "owner_passport_url", label: "Owner Passport" },
    { key: "site_plan_url", label: "Site Plan" },
];

export default function DocumentsViewCard({
    property,
}: DocumentsViewCardProps) {
    const docs = property.documents_checklist;
    if (!docs) return null;

    // Check if at least one document has a URL
    const hasAnyDocument = DOCUMENT_LABELS.some((d) => !!docs[d.key]);
    if (!hasAnyDocument) return null;

    return (
        <Card
            title={
                <span>
                    <FolderOpenOutlined className="mr-2" />
                    Documents Checklist
                </span>
            }
            variant="outlined"
            size="small"
        >
            <Row gutter={[12, 8]}>
                {DOCUMENT_LABELS.map(({ key, label }) => {
                    const url = docs[key];
                    const hasDoc = !!url;

                    return (
                        <Col key={key} xs={24} sm={12}>
                            <div className="flex items-center gap-2 py-1.5 px-3 rounded bg-gray-50">
                                {hasDoc ? (
                                    <CheckCircleOutlined className="text-green-500" />
                                ) : (
                                    <CloseCircleOutlined className="text-gray-300" />
                                )}
                                <Text
                                    className={
                                        hasDoc ? "text-sm" : "text-sm text-gray-400"
                                    }
                                >
                                    {label}
                                </Text>
                                {hasDoc && (
                                    <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto text-xs text-blue-500 hover:text-blue-700"
                                    >
                                        <FileOutlined className="mr-0.5" />
                                        View
                                    </a>
                                )}
                            </div>
                        </Col>
                    );
                })}
            </Row>
        </Card>
    );
}
