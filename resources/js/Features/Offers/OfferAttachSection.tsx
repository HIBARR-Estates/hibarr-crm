import React, { useState } from "react";
import { Card, Tag, Button, Select, Empty, Space, Switch, List } from "antd";
import { GiftOutlined, LinkOutlined } from "@ant-design/icons";
import { useApiQuery } from "@/lib/api/client";
import type { Offer, OfferablePivot } from "@/Types/api/offers";
import dayjs from "dayjs";

type OfferWithPivot = Offer & { pivot?: OfferablePivot };

interface OfferAttachSectionProps {
    /** All attached offers (including disabled ones) */
    offers?: OfferWithPivot[];
    /** The type of the offerable model */
    offerableType: "developer_project" | "unit_type";
    /** The ID of the offerable model */
    offerableId: number;
    /** Called after successful action to refresh data */
    onRefresh: () => void;
}

const csrfHeaders = () => ({
    "Content-Type": "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-CSRF-TOKEN":
        document
            .querySelector('meta[name="csrf-token"]')
            ?.getAttribute("content") ?? "",
    Accept: "application/json",
});

const OfferAttachSection: React.FC<OfferAttachSectionProps> = ({
    offers = [],
    offerableType,
    offerableId,
    onRefresh,
}) => {
    const [attaching, setAttaching] = useState(false);
    const [selectedOfferId, setSelectedOfferId] = useState<number | null>(null);
    const [loading, setLoading] = useState<number | null>(null); // track by offer ID
    const [attachLoading, setAttachLoading] = useState(false);

    // Fetch available offers for the Select dropdown (only when attaching)
    const { data: availableOffersData, isLoading: offersLoading } =
        useApiQuery<{ status: string; data: { offers: { data: Offer[] } } }>({
            path: route("offers.index"),
            params: { active_only: true, per_page: 100 },
            options: { enabled: attaching },
        });

    const availableOffers = availableOffersData?.data?.offers?.data ?? [];
    // Filter out already-attached offers
    const attachedIds = new Set(offers.map((o) => o.id));
    const selectableOffers = availableOffers.filter(
        (o) => !attachedIds.has(o.id),
    );

    const handleAttach = async () => {
        if (!selectedOfferId) return;
        setAttachLoading(true);
        try {
            const res = await fetch(route("offers.attach", selectedOfferId), {
                method: "POST",
                headers: csrfHeaders(),
                body: JSON.stringify({
                    offerable_type: offerableType,
                    offerable_ids: [offerableId],
                }),
            });
            const data = await res.json();
            if (data.status === "success") {
                setAttaching(false);
                setSelectedOfferId(null);
                onRefresh();
            } else {
                alert(data.message || "Failed to attach offer");
            }
        } finally {
            setAttachLoading(false);
        }
    };

    const handleToggle = async (offer: OfferWithPivot, enable: boolean) => {
        setLoading(offer.id);
        try {
            const endpoint = enable
                ? route("offers.enable", offer.id)
                : route("offers.disable", offer.id);
            await fetch(endpoint, {
                method: "POST",
                headers: csrfHeaders(),
                body: JSON.stringify({
                    offerable_type: offerableType,
                    offerable_id: offerableId,
                }),
            });
            onRefresh();
        } finally {
            setLoading(null);
        }
    };

    return (
        <Card size="small" className="mb-4">
            {offers.length > 0 ? (
                <List
                    size="small"
                    dataSource={offers}
                    renderItem={(offer) => {
                        const pivotActive = offer.pivot?.is_active !== false;
                        return (
                            <List.Item
                                key={offer.id}
                                actions={[
                                    <Switch
                                        key="toggle"
                                        size="small"
                                        checked={pivotActive}
                                        loading={loading === offer.id}
                                        onChange={(checked) =>
                                            handleToggle(offer, checked)
                                        }
                                    />,
                                ]}
                            >
                                <List.Item.Meta
                                    avatar={
                                        <GiftOutlined
                                            className={`text-lg ${pivotActive ? "text-green-600" : "text-gray-400"}`}
                                        />
                                    }
                                    title={
                                        <Space size={4}>
                                            <span
                                                className={
                                                    !pivotActive
                                                        ? "text-gray-400"
                                                        : ""
                                                }
                                            >
                                                {offer.name}
                                            </span>
                                            {!pivotActive && (
                                                <Tag color="default">
                                                    Disabled
                                                </Tag>
                                            )}
                                        </Space>
                                    }
                                    description={
                                        <Space size={8} className="text-xs">
                                            <Tag
                                                color={
                                                    offer.type === "percentage"
                                                        ? "blue"
                                                        : offer.type === "perks"
                                                          ? "purple"
                                                          : "green"
                                                }
                                                className="text-xs"
                                            >
                                                {offer.type === "perks"
                                                    ? "Perk"
                                                    : offer.type ===
                                                        "percentage"
                                                      ? `${offer.value}%`
                                                      : Number(
                                                            offer.value,
                                                        ).toLocaleString(
                                                            "en-GB",
                                                        )}
                                            </Tag>
                                            {offer.max_discount_amount && (
                                                <span>
                                                    Cap:{" "}
                                                    {Number(
                                                        offer.max_discount_amount,
                                                    ).toLocaleString("en-GB")}
                                                </span>
                                            )}
                                            {offer.starts_at && (
                                                <span>
                                                    {dayjs(
                                                        offer.starts_at,
                                                    ).format("MMM DD")}
                                                    {offer.ends_at
                                                        ? ` → ${dayjs(offer.ends_at).format("MMM DD")}`
                                                        : "+"}
                                                </span>
                                            )}
                                        </Space>
                                    }
                                />
                            </List.Item>
                        );
                    }}
                />
            ) : (
                <Empty
                    description="No offers attached"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    className="my-2"
                />
            )}

            {/* Attach new offer */}
            {attaching ? (
                <div className="flex items-center gap-3 mt-3">
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
                        options={selectableOffers.map((o) => ({
                            label: `${o.name} (${o.type === "perks" ? "Perk" : o.type === "percentage" ? `${o.value}%` : o.value})`,
                            value: o.id,
                        }))}
                        value={selectedOfferId}
                        onChange={setSelectedOfferId}
                    />
                    <Button
                        type="primary"
                        size="small"
                        onClick={handleAttach}
                        loading={attachLoading}
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
            ) : (
                <div className="mt-3">
                    <Button
                        type="link"
                        size="small"
                        icon={<LinkOutlined />}
                        onClick={() => setAttaching(true)}
                    >
                        Attach Offer
                    </Button>
                </div>
            )}
        </Card>
    );
};

export default OfferAttachSection;
