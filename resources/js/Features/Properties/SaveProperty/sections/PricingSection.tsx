import React, { useMemo } from "react";
import { Form, Switch, Input, Row, Col, Typography } from "antd";
import type { FormInstance } from "antd/lib/form";
import type { PrimaryCategory } from "@/Types";
import CurrencyInput from "@/Components/CurrencyInput";

const { Text } = Typography;
const { TextArea } = Input;

// 1 Dönüm = 1,338 m²
const DONUM_TO_SQM = 1338;

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$",
    EUR: "€",
    GBP: "£",
    TRY: "₺",
};

interface PricingSectionProps {
    form: FormInstance;
    primaryCategory: PrimaryCategory;
    selectedCurrency?: string;
}

const PricingSection: React.FC<PricingSectionProps> = ({
    form,
    primaryCategory,
    selectedCurrency,
}) => {
    const openToSwap = Form.useWatch("open_to_swap", form);
    const isLand = primaryCategory === "land";

    return (
        <Row gutter={[16, 0]}>
            {/* Price */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="price"
                    label="Price"
                    rules={[
                        { required: true, message: "Please enter the price" },
                    ]}
                >
                    <CurrencyInput
                        noFormItem
                        placeholder="Enter price"
                        defaultCurrency={selectedCurrency}
                    />
                </Form.Item>
            </Col>

            {/* Price per m² (and per dönüm for land) — informational, computed */}
            <Col xs={24} md={12}>
                <Form.Item
                    shouldUpdate={(prev, cur) =>
                        prev.price !== cur.price ||
                        prev.gross_sqm !== cur.gross_sqm ||
                        prev.living_area_sqm !== cur.living_area_sqm ||
                        prev.land_size !== cur.land_size
                    }
                    noStyle
                >
                    {() => {
                        const price = form.getFieldValue("price");
                        const grossSqm = form.getFieldValue("gross_sqm");
                        const livingSqm = form.getFieldValue("living_area_sqm");
                        const landSize = form.getFieldValue("land_size");

                        // Parse price amount and currency
                        let priceAmount: number | null = null;
                        let currency = "";
                        if (price) {
                            if (typeof price === "number") {
                                priceAmount = price;
                            } else if (
                                typeof price === "object" &&
                                price?.amount
                            ) {
                                priceAmount = Number(price.amount);
                                currency = price.currency || "";
                            } else if (typeof price === "string") {
                                try {
                                    const parsed = JSON.parse(price);
                                    priceAmount = parsed?.amount
                                        ? Number(parsed.amount)
                                        : Number(price);
                                    currency = parsed?.currency || "";
                                } catch {
                                    priceAmount = Number(price);
                                }
                            }
                        }

                        const currencySymbol =
                            CURRENCY_SYMBOLS[currency] || currency || "";

                        const area = isLand ? landSize : grossSqm || livingSqm;

                        const pricePerSqm =
                            priceAmount && area && Number(area) > 0
                                ? Math.round(priceAmount / Number(area))
                                : null;

                        // For land, also calculate price per dönüm
                        const pricePerDonum =
                            isLand &&
                            priceAmount &&
                            landSize &&
                            Number(landSize) > 0
                                ? Math.round(
                                      priceAmount /
                                          (Number(landSize) / DONUM_TO_SQM),
                                  )
                                : null;

                        return (
                            <Form.Item
                                label={
                                    isLand ? "Price / m² & Dönüm" : "Price / m²"
                                }
                            >
                                <div className="bg-gray-50 rounded-md px-3 py-2 border border-gray-200 min-h-[32px] flex items-center gap-4">
                                    {pricePerSqm !== null ? (
                                        <>
                                            <Text strong>
                                                {currencySymbol}
                                                {pricePerSqm.toLocaleString()}
                                                <Text
                                                    type="secondary"
                                                    className="ml-1 text-xs font-normal"
                                                >
                                                    / m²
                                                </Text>
                                            </Text>
                                            {pricePerDonum !== null && (
                                                <>
                                                    <Text
                                                        type="secondary"
                                                        className="text-xs"
                                                    >
                                                        |
                                                    </Text>
                                                    <Text strong>
                                                        {currencySymbol}
                                                        {pricePerDonum.toLocaleString()}
                                                        <Text
                                                            type="secondary"
                                                            className="ml-1 text-xs font-normal"
                                                        >
                                                            / dönüm
                                                        </Text>
                                                    </Text>
                                                </>
                                            )}
                                        </>
                                    ) : (
                                        <Text
                                            type="secondary"
                                            className="text-xs italic"
                                        >
                                            Enter price and area to calculate
                                        </Text>
                                    )}
                                </div>
                            </Form.Item>
                        );
                    }}
                </Form.Item>
            </Col>

            {/* Swap toggle */}
            <Col xs={24} md={12}>
                <Form.Item
                    name="open_to_swap"
                    label="Open to Swap"
                    valuePropName="checked"
                    tooltip="Is the owner open to swapping/exchanging this property?"
                >
                    <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
            </Col>

            {/* Swap notes — conditional */}
            {openToSwap && (
                <Col xs={24} md={12}>
                    <Form.Item
                        name="swap_notes"
                        label="Swap Notes"
                        tooltip="What type of swap/exchange is the owner interested in?"
                    >
                        <TextArea
                            rows={2}
                            placeholder="e.g., Would swap for apartment in Kyrenia..."
                        />
                    </Form.Item>
                </Col>
            )}
        </Row>
    );
};

export default PricingSection;
