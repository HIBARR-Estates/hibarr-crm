import React, { useState } from "react";
import {
    Card,
    Tag,
    Button,
    Select,
    Popconfirm,
    Empty,
    Space,
    Spin,
} from "antd";
import {
    GiftOutlined,
    LinkOutlined,
    DisconnectOutlined,
} from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Offer } from "@/Types/api/offers";
import dayjs from "dayjs";

interface OfferAttachSectionProps {
    /** The currently attached offer (if any) */
    currentOffer?: Offer | null;
    /** The type of the offerable model */
    offerableType: "developer_project" | "unit_type";
    /** The ID of the offerable model */
    offerableId: number;
    /** Called after successful attach/detach to refresh data */
    onRefresh: () => void;
}

const OfferAttachSection: React.FC<OfferAttachSectionProps> = ({
    currentOffer,
    offerableType,
    offerableId,
    onRefresh,
}) => {
    const [attaching, setAttaching] = useState(false);
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
    const [loading, setLoading] = useState(false);

    // Fetch available offers for the Select dropdown (only when attaching)
    const { data: availableOffersData, isLoading: offersLoading } =
        useApiQuery<{ status: string; data: { offers: { data: Offer[] } } }>({
            path: route("offers.index"),
            params: { active_only: true, per_page: 100 },
            options: { enabled: attaching },
        });

    const availableOffers = availableOffersData?.data?.offers?.data ?? [];

    const handleAttach = async () => {
        if (!selectedOfferId) return;
        setLoading(true);
        try {
            const res = await fetch(route("offers.attach", selectedOfferId), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    offerable_type: offerableType,
                    offerable_id: offerableId,
                }),
            });
            const data = await res.json();
            if (data.status === "success") {
                setAttaching(false);
                setSelectedOfferId(null);
                onRefresh();
            } else {
                // Show error (the API returns error messages)
                const { App: AntApp } = await import("antd");
                // Fallback: use alert for simplicity since we can't use hooks here dynamically
                alert(data.message || "Failed to attach offer");
            }
        } finally {
            setLoading(false);
        }
    };

    const handleDetach = async () => {
        if (!currentOffer) return;
        setLoading(true);
        try {
            await fetch(route("offers.detach", currentOffer.id), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                    "X-CSRF-TOKEN":
                        document
                            .querySelector('meta[name="csrf-token"]')
                            ?.getAttribute("content") ?? "",
                    Accept: "application/json",
                },
                body: JSON.stringify({
                    offerable_type: offerableType,
                    offerable_id: offerableId,
                }),
            });
            onRefresh();
        } finally {
            setLoading(false);
        }
    };

    if (currentOffer) {
        return (
            <Card size="small" className="mb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <GiftOutlined className="text-lg text-green-600" />
                        <div>
                            <div className="font-medium">
                                {currentOffer.name}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                                <Tag
                                    color={
                                        currentOffer.type === "percentage"
                                            ? "blue"
                                            : "green"
                                    }
                                    className="text-xs"
                                >
                                    {currentOffer.type === "percentage"
                                        ? `${currentOffer.value}%`
                                        : `${Number(currentOffer.value).toLocaleString("en-GB")}`}
                                </Tag>
                                {currentOffer.max_discount_amount && (
                                    <span>
                                        Cap:{" "}
                                        {Number(
                                            currentOffer.max_discount_amount,
                                        ).toLocaleString("en-GB")}
                                    </span>
                                )}
                                {currentOffer.starts_at && (
                                    <span>
                                        {dayjs(currentOffer.starts_at).format(
                                            "MMM DD",
                                        )}
                                        {currentOffer.ends_at
                                            ? ` → ${dayjs(currentOffer.ends_at).format("MMM DD")}`
                                            : "+"}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <Popconfirm
                        title="Detach this offer?"
                        onConfirm={handleDetach}
                        okText="Detach"
                        okType="danger"
                    >
                        <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DisconnectOutlined />}
                            loading={loading}
                        >
                            Detach
                        </Button>
                    </Popconfirm>
                </div>
            </Card>
        );
    }

    if (attaching) {
        return (
            <Card size="small" className="mb-4">
                <div className="flex items-center gap-3">
                    <Select
                        className="flex-1"
                        placeholder="Select an offer..."
                        loading={offersLoading}
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? "")
                                .toString()
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        options={availableOffers.map((o) => ({
                            label: `${o.name} (${o.type === "percentage" ? `${o.value}%` : o.value})`,
                            value: o.id,
                        }))}
                        value={selectedOfferId}
                        onChange={setSelectedOfferId}
                    />
                    <Button
                        type="primary"
                        size="small"
                        onClick={handleAttach}
                        loading={loading}
                        disabled={!selectedOfferId}
                    >
                        Attach
                    </Button>
                    <Button
                        size="small"
                        onClick={() => {
                            setAttaching(false);
                            setSelectedOfferId(null);
                        }}
                    >
                        Cancel
                    </Button>
                </div>
            </Card>
        );
    }

    return (
        <Card size="small" className="mb-4">
            <div className="flex items-center justify-between">
                <span className="text-gray-400 text-sm">No offer attached</span>
                <Button
                    type="link"
                    size="small"
                    icon={<LinkOutlined />}
                    onClick={() => setAttaching(true)}
                >
                    Attach Offer
                </Button>
            </div>
        </Card>
    );
};

export default OfferAttachSection;
