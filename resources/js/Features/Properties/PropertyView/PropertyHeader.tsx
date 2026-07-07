import React, { useState } from "react";
import {
    Typography,
    Tag,
    Space,
    Button,
    Tooltip,
    message,
    Modal,
    Input,
} from "antd";
import { router } from "@inertiajs/react";
import {
    EditOutlined,
    ShareAltOutlined,
    EnvironmentOutlined,
    DollarOutlined,
    FilePdfOutlined,
    CheckCircleOutlined,
    CopyOutlined,
    GlobalOutlined,
    EyeInvisibleOutlined,
    SafetyOutlined,
    SendOutlined,
    ClockCircleOutlined,
} from "@ant-design/icons";
import { Property } from "@/Types";
import {
    getStatusColor,
    parsePropertyPrice,
    formatCurrencyWithSymbol,
    generatePropertySubtitle,
} from "@/lib/utils";
import { usePage } from "@inertiajs/react";
import { PropertyPermissions } from "@/Hooks/usePropertyPermissions";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiSuccessResponse } from "@/lib/api/types";
import ConfirmationModal from "@/Components/Common/ConfirmationModal";

const { Title, Text } = Typography;

interface PropertyHeaderProps {
    property: Property;
    permissions: PropertyPermissions;
    hasPendingPublishRequest?: boolean;
    hasPendingEditAccessRequest?: boolean;
    onEdit?: () => void;
    onShare?: () => void;
    onGenerateExpose?: () => void;
}

function PropertyHeader({
    property,
    permissions,
    hasPendingPublishRequest = false,
    hasPendingEditAccessRequest = false,
    onEdit,
    onShare,
    onGenerateExpose,
}: PropertyHeaderProps) {
    const { props } = usePage<any>();
    const {
        default_currency_code: defaultCurrencyCode,
        default_currency_symbol: defaultCurrencySymbol,
        currencies = [],
    } = props || {};

    // Copied state for reference code
    const [copied, setCopied] = useState(false);

    // Confirmation modal state
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean;
        action: "publish" | "unpublish" | null;
    }>({ open: false, action: null });

    // Availability request modal state
    const [availabilityModal, setAvailabilityModal] = useState(false);
    const [availabilityMessage, setAvailabilityMessage] = useState("");

    // Edit access request modal state
    const [editAccessModal, setEditAccessModal] = useState(false);
    const [editAccessMessage, setEditAccessMessage] = useState("");

    const { amount, currency } = parsePropertyPrice(
        (property as any).price,
        defaultCurrencyCode || "TRY",
    );

    const resolvedSymbol =
        currencies.find((c: any) => c?.currency_code === currency)
            ?.currency_symbol ||
        defaultCurrencySymbol ||
        "";

    // Publish mutation
    const { mutate: publishProperty, isPending: isPublishing } = useApiMutate<
        Record<string, never>,
        { property: Property },
        ApiSuccessResponse<{ property: Property }>
    >(route("properties.publish", property.id), "POST", () => {
        setConfirmModal({ open: false, action: null });
        // Refresh the page to get updated property data
        router.reload({ only: ["property"] });
    });

    // Unpublish mutation
    const { mutate: unpublishProperty, isPending: isUnpublishing } =
        useApiMutate<
            Record<string, never>,
            { property: Property },
            ApiSuccessResponse<{ property: Property }>
        >(route("properties.unpublish", property.id), "POST", () => {
            setConfirmModal({ open: false, action: null });
            // Refresh the page to get updated property data
            router.reload({ only: ["property"] });
        });

    // Check Availability mutation
    const { mutate: requestAvailability, isPending: isRequestingAvailability } =
        useApiMutate<
            { property_id: number; message?: string },
            any,
            ApiSuccessResponse<any>
        >(route("availability-requests.store"), "POST", () => {
            setAvailabilityModal(false);
            setAvailabilityMessage("");
        });

    const { mutate: requestEditAccess, isPending: isRequestingEditAccess } =
        useApiMutate<
            { property_id: number; message?: string },
            any,
            ApiSuccessResponse<any>
        >(route("edit-access-requests.store"), "POST", () => {
            setEditAccessModal(false);
            setEditAccessMessage("");
            message.success("Edit access request sent successfully.");
            router.reload({
                only: ["property", "hasPendingEditAccessRequest"],
            });
        });

    // Publish request modal state
    const [publishRequestModal, setPublishRequestModal] = useState(false);
    const [publishRequestMessage, setPublishRequestMessage] = useState("");

    // Request Publishing mutation
    const {
        mutate: submitPublishRequest,
        isPending: isSubmittingPublishRequest,
    } = useApiMutate<
        { property_id: number; message?: string },
        any,
        ApiSuccessResponse<any>
    >(route("publish-requests.store"), "POST", () => {
        setPublishRequestModal(false);
        setPublishRequestMessage("");
        router.reload({ only: ["property", "hasPendingPublishRequest"] });
    });

    const handleCopyReferenceCode = async () => {
        if (!property.reference_code) return;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(property.reference_code);
            } else {
                // Fallback for non-HTTPS environments
                const textarea = document.createElement("textarea");
                textarea.value = property.reference_code;
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                document.body.removeChild(textarea);
            }
            setCopied(true);
            message.success("Reference code copied!");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            message.error("Failed to copy");
        }
    };

    const handlePublish = () => {
        setConfirmModal({ open: true, action: "publish" });
    };

    const handleUnpublish = () => {
        setConfirmModal({ open: true, action: "unpublish" });
    };

    const handleConfirmAction = () => {
        if (confirmModal.action === "publish") {
            publishProperty({});
        } else if (confirmModal.action === "unpublish") {
            unpublishProperty({});
        }
    };

    const handleCloseConfirmModal = () => {
        if (!isPublishing && !isUnpublishing) {
            setConfirmModal({ open: false, action: null });
        }
    };

    const handleCheckAvailability = () => {
        setAvailabilityModal(true);
    };

    const handleRequestPublish = () => {
        setPublishRequestModal(true);
    };

    const handleSubmitPublishRequest = () => {
        submitPublishRequest({
            property_id: property.id,
            message: publishRequestMessage || undefined,
        });
    };

    const handleSubmitAvailabilityRequest = () => {
        requestAvailability({
            property_id: property.id,
            message: availabilityMessage || undefined,
        });
    };

    const handleRequestEditAccess = () => {
        setEditAccessModal(true);
    };

    const handleSubmitEditAccessRequest = () => {
        requestEditAccess({
            property_id: property.id,
            message: editAccessMessage || undefined,
        });
    };

    return (
        <div className="mb-4">
            <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="flex-1">
                    {/* Reference Code Badge */}
                    {property.reference_code && (
                        <div className="flex items-center gap-2 mb-2">
                            <Tooltip
                                title={
                                    copied
                                        ? "Copied!"
                                        : "Click to copy reference code"
                                }
                            >
                                <Tag
                                    color={copied ? "green" : "geekblue"}
                                    className="text-xs cursor-pointer hover:opacity-80 transition-all"
                                    onClick={handleCopyReferenceCode}
                                >
                                    {copied ? (
                                        <CheckCircleOutlined className="mr-1" />
                                    ) : (
                                        <CopyOutlined className="mr-1" />
                                    )}
                                    {property.reference_code}
                                </Tag>
                            </Tooltip>
                        </div>
                    )}

                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Title level={2} className="mb-0">
                            {generatePropertySubtitle(property) ||
                                property.title}
                        </Title>
                        <Tag
                            color={getStatusColor(property.status)}
                            className="text-sm px-3 py-1"
                        >
                            {property.status}
                        </Tag>
                        {permissions.isCollaborator && (
                            <Tag color="blue" className="text-sm px-3 py-1">
                                Collaborator
                            </Tag>
                        )}
                        {/* Publishing Status Badge */}
                        {property.is_published !== undefined && (
                            <Tooltip
                                title={
                                    property.is_published
                                        ? "Visible to all agents"
                                        : "Only visible to you and admins"
                                }
                            >
                                <Tag
                                    icon={
                                        property.is_published ? (
                                            <GlobalOutlined />
                                        ) : (
                                            <EyeInvisibleOutlined />
                                        )
                                    }
                                    color={
                                        property.is_published
                                            ? "green"
                                            : "orange"
                                    }
                                >
                                    {property.is_published
                                        ? "Published"
                                        : "Draft"}
                                </Tag>
                            </Tooltip>
                        )}
                    </div>

                    <div className="flex items-center gap-4 mb-3 text-gray-600 flex-wrap">
                        <Space>
                            <EnvironmentOutlined />
                            <Text>
                                {property?.area ? `${property.area}, ` : ""}
                                {property?.city || ""}
                                {!property?.area &&
                                    !property?.city &&
                                    "Location not specified"}
                            </Text>
                        </Space>
                    </div>

                    <div className="flex items-center gap-2 mb-4">
                        <Title level={3} className="mb-0 text-blue-600">
                            {formatCurrencyWithSymbol(amount, resolvedSymbol)}
                        </Title>
                        {property.sale_type.includes("Rent") && (
                            <Text type="secondary">
                                / {property.rent_payment_interval || "month"}
                            </Text>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Publish/Unpublish Button (SM/Admin only) */}
                    {permissions.canPublish &&
                        (property.is_published ? (
                            <Button
                                icon={<EyeInvisibleOutlined />}
                                onClick={handleUnpublish}
                                loading={isUnpublishing}
                                disabled={isUnpublishing}
                            >
                                Unpublish
                            </Button>
                        ) : (
                            <Button
                                type="primary"
                                ghost
                                icon={<GlobalOutlined />}
                                onClick={handlePublish}
                                loading={isPublishing}
                                disabled={isPublishing}
                            >
                                Publish
                            </Button>
                        ))}
                    {/* Request Publishing Button (non-SM agents) */}
                    {permissions.canRequestPublish &&
                        !property.is_published &&
                        (hasPendingPublishRequest ? (
                            <Tooltip title="A publish request is pending review by a Sales Manager">
                                <Tag
                                    icon={<ClockCircleOutlined />}
                                    color="orange"
                                    className="text-sm px-3 py-1 m-0"
                                >
                                    Pending Review
                                </Tag>
                            </Tooltip>
                        ) : (
                            <Button
                                type="primary"
                                ghost
                                icon={<SendOutlined />}
                                onClick={handleRequestPublish}
                                loading={isSubmittingPublishRequest}
                            >
                                Request Publishing
                            </Button>
                        ))}
                    {/* Check Availability Button */}
                    {permissions.canRequestAccess && !permissions.isAdmin && (
                        <Tooltip title="Request availability check before presenting to customer">
                            <Button
                                icon={<SafetyOutlined />}
                                onClick={handleCheckAvailability}
                                loading={isRequestingAvailability}
                            >
                                Check Availability
                            </Button>
                        </Tooltip>
                    )}
                    {permissions.canRequestEditAccess && (
                        hasPendingEditAccessRequest ? (
                            <Tooltip title="Your edit access request is pending review by the responsible agent">
                                <Tag
                                    icon={<ClockCircleOutlined />}
                                    color="orange"
                                    className="text-sm px-3 py-1 m-0"
                                >
                                    Edit Access Pending
                                </Tag>
                            </Tooltip>
                        ) : (
                            <Tooltip title="Request permission to edit listing content">
                                <Button
                                    icon={<EditOutlined />}
                                    onClick={handleRequestEditAccess}
                                    loading={isRequestingEditAccess}
                                >
                                    Request Edit Access
                                </Button>
                            </Tooltip>
                        )
                    )}
                    {/* {onShare && (
                        <Button icon={<ShareAltOutlined />} onClick={onShare}>
                            Share
                        </Button>
                    )} */}
                    {/* {onGenerateExpose && (
                        <Button
                            icon={<FilePdfOutlined />}
                            onClick={onGenerateExpose}
                        >
                            Generate Expose
                        </Button>
                    )} */}
                    {permissions.canEdit && (
                        <Button
                            type="primary"
                            icon={<EditOutlined />}
                            onClick={onEdit}
                        >
                            {permissions.canEditPublicFieldsOnly
                                ? "Edit Listing"
                                : "Edit Property"}
                        </Button>
                    )}
                </div>
            </div>

            {/* Publish/Unpublish Confirmation Modal */}
            <ConfirmationModal
                open={confirmModal.open}
                onClose={handleCloseConfirmModal}
                onSubmit={{
                    fn: handleConfirmAction,
                    loading: isPublishing || isUnpublishing,
                }}
                title={
                    confirmModal.action === "publish"
                        ? "Publish Property?"
                        : "Unpublish Property?"
                }
                description={
                    confirmModal.action === "publish"
                        ? "This property will become visible to all agents. Are you sure you want to publish?"
                        : "This property will only be visible to you and admins. Are you sure you want to unpublish?"
                }
                icon={
                    confirmModal.action === "publish" ? (
                        <GlobalOutlined className="text-green-500 text-2xl" />
                    ) : (
                        <EyeInvisibleOutlined className="text-orange-500 text-2xl" />
                    )
                }
                confirmText={
                    confirmModal.action === "publish" ? "Publish" : "Unpublish"
                }
                confirmType="primary"
                confirmDanger={confirmModal.action === "unpublish"}
            />

            {/* Check Availability Modal */}
            <Modal
                title="Check Property Availability"
                open={availabilityModal}
                onOk={handleSubmitAvailabilityRequest}
                onCancel={() => {
                    if (!isRequestingAvailability) {
                        setAvailabilityModal(false);
                        setAvailabilityMessage("");
                    }
                }}
                confirmLoading={isRequestingAvailability}
                okText="Send Request"
                cancelText="Cancel"
            >
                <div className="py-2">
                    <p className="mb-3 text-gray-600">
                        Before presenting this property to your customer, you
                        must request an availability check from the responsible
                        agent. They will be notified and have 8 business hours
                        to respond.
                    </p>
                    <p className="mb-2 font-medium">
                        Property: {property.display_title || property.title}
                    </p>
                    {property.reference_code && (
                        <p className="mb-3 text-gray-500 text-sm">
                            Reference: {property.reference_code}
                        </p>
                    )}
                    <Input.TextArea
                        placeholder="Optional message to the responsible agent (e.g., customer details, urgency)"
                        value={availabilityMessage}
                        onChange={(e) => setAvailabilityMessage(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        showCount
                    />
                </div>
            </Modal>

            {/* Request Edit Access Modal */}
            <Modal
                title="Request Edit Access"
                open={editAccessModal}
                onOk={handleSubmitEditAccessRequest}
                onCancel={() => {
                    if (!isRequestingEditAccess) {
                        setEditAccessModal(false);
                        setEditAccessMessage("");
                    }
                }}
                confirmLoading={isRequestingEditAccess}
                okText="Send Request"
                cancelText="Cancel"
            >
                <div className="py-2">
                    <p className="mb-3 text-gray-600">
                        Use this when you need to update the property listing
                        (description, photos, features, or price). This is
                        different from an availability check before showing the
                        property to a client.
                    </p>
                    <p className="mb-2 font-medium">
                        Property: {property.display_title || property.title}
                    </p>
                    {property.reference_code && (
                        <p className="mb-3 text-gray-500 text-sm">
                            Reference: {property.reference_code}
                        </p>
                    )}
                    <Input.TextArea
                        placeholder="Optional message explaining why you need edit access"
                        value={editAccessMessage}
                        onChange={(e) => setEditAccessMessage(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        showCount
                    />
                </div>
            </Modal>

            {/* Request Publishing Modal */}
            <Modal
                title="Request Property Publishing"
                open={publishRequestModal}
                onOk={handleSubmitPublishRequest}
                onCancel={() => {
                    if (!isSubmittingPublishRequest) {
                        setPublishRequestModal(false);
                        setPublishRequestMessage("");
                    }
                }}
                confirmLoading={isSubmittingPublishRequest}
                okText="Submit Request"
                cancelText="Cancel"
            >
                <div className="py-2">
                    <p className="mb-3 text-gray-600">
                        Your property will be reviewed by a Sales Manager before
                        being published. You will be notified when your request
                        is approved or rejected.
                    </p>
                    <p className="mb-2 font-medium">
                        Property: {property.display_title || property.title}
                    </p>
                    {property.reference_code && (
                        <p className="mb-3 text-gray-500 text-sm">
                            Reference: {property.reference_code}
                        </p>
                    )}
                    <Input.TextArea
                        placeholder="Optional message to the Sales Manager (e.g., why this property should be published)"
                        value={publishRequestMessage}
                        onChange={(e) =>
                            setPublishRequestMessage(e.target.value)
                        }
                        rows={3}
                        maxLength={1000}
                        showCount
                    />
                </div>
            </Modal>
        </div>
    );
}

export default PropertyHeader;
