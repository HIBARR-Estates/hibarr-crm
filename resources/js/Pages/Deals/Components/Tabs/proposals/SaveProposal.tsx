import React, { useState, useEffect } from "react";
import {
    Modal,
    Form,
    Input,
    Select,
    DatePicker,
    Button,
    Row,
    Col,
    message,
    Checkbox,
    Divider,
    InputNumber,
    Space,
    Table,
    Card,
    Drawer,
} from "antd";
import {
    PlusOutlined,
    DeleteOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import { router } from "@inertiajs/react";
import dayjs from "dayjs";
import { Deal } from "@/Types/api/deals";
import { Proposal } from "@/Types/api/proposal";

const { TextArea } = Input;
const { Option } = Select;

interface SaveProposalProps {
    visible: boolean;
    onClose: () => void;
    deal?: Deal;
    proposal?: Proposal | null;
    mode: "create" | "edit";
    onSuccess?: () => void;
}

interface ProposalItem {
    id?: number;
    item_name: string;
    item_summary: string;
    type: string;
    quantity: number;
    cost_per_item: number;
    amount: number;
    tax?: string[];
    hsn_sac_code?: string;
}

interface FormData {
    deal_id?: number;
    lead_contact?: number;
    valid_till: string;
    currency_id: number;
    calculate_tax: "after_discount" | "before_discount";
    description: string;
    require_signature: boolean;
    items: ProposalItem[];
    sub_total: number;
    discount_type: "fixed" | "percent";
    discount_value: number;
    total: number;
    note?: string;
}

export default function SaveProposal({
    visible,
    onClose,
    deal,
    proposal,
    mode,
    onSuccess,
}: SaveProposalProps) {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [items, setItems] = useState<ProposalItem[]>([]);
    const [showProductCategory, setShowProductCategory] = useState(false);
    const [subTotal, setSubTotal] = useState(0);
    const [discountType, setDiscountType] = useState<"fixed" | "percent">(
        "fixed"
    );
    const [discountValue, setDiscountValue] = useState(0);
    const [total, setTotal] = useState(0);

    // Mock data - In real implementation, these would come from props or API
    const currencies = [
        { id: 1, currency_code: "USD", currency_symbol: "$" },
        { id: 2, currency_code: "EUR", currency_symbol: "€" },
        { id: 3, currency_code: "GBP", currency_symbol: "£" },
    ];

    const products = [
        { id: 1, name: "Web Development", price: 1000 },
        { id: 2, name: "Mobile App Development", price: 2000 },
        { id: 3, name: "UI/UX Design", price: 500 },
    ];

    const categories = [
        { id: 1, category_name: "Development" },
        { id: 2, category_name: "Design" },
        { id: 3, category_name: "Marketing" },
    ];

    const taxes = [
        { id: 1, tax_name: "VAT", rate_percent: 20 },
        { id: 2, tax_name: "GST", rate_percent: 18 },
    ];

    useEffect(() => {
        if (visible) {
            if (mode === "edit" && proposal) {
                // Populate form with proposal data
                form.setFieldsValue({
                    deal_id: proposal.deal_id,
                    valid_till: dayjs(proposal.valid_till),
                    currency_id: proposal.currency_id,
                    calculate_tax: proposal.calculate_tax,
                    description: proposal.description,
                    require_signature: proposal.signature_approval === 1,
                    discount_type: proposal.discount_type,
                    discount_value: proposal.discount,
                    note: proposal.note,
                });

                // Set proposal items if available
                // setItems(proposal.items || []);
                setDiscountType(proposal.discount_type as "fixed" | "percent");
                setDiscountValue(proposal.discount);
                setSubTotal(proposal.sub_total);
                setTotal(proposal.total);
            } else {
                // Set default values for create mode
                form.setFieldsValue({
                    deal_id: deal?.id,
                    valid_till: dayjs().add(30, "days"),
                    currency_id: 1, // Default currency
                    calculate_tax: "after_discount",
                    require_signature: true,
                    discount_type: "fixed",
                    discount_value: 0,
                });
                setItems([]);
                setSubTotal(0);
                setDiscountValue(0);
                setTotal(0);
            }
        }
    }, [visible, mode, proposal, deal, form]);

    const calculateTotal = () => {
        const itemsTotal = items.reduce((sum, item) => sum + item.amount, 0);
        setSubTotal(itemsTotal);

        let finalTotal = itemsTotal;
        if (discountType === "fixed") {
            finalTotal = itemsTotal - discountValue;
        } else {
            finalTotal = itemsTotal - (itemsTotal * discountValue) / 100;
        }

        setTotal(Math.max(0, finalTotal));
    };

    useEffect(() => {
        calculateTotal();
    }, [items, discountType, discountValue]);

    const handleAddItem = () => {
        const newItem: ProposalItem = {
            item_name: "",
            item_summary: "",
            type: "item",
            quantity: 1,
            cost_per_item: 0,
            amount: 0,
            tax: [],
        };
        setItems([...items, newItem]);
    };

    const handleRemoveItem = (index: number) => {
        const newItems = items.filter((_, i) => i !== index);
        setItems(newItems);
    };

    const handleItemChange = (
        index: number,
        field: keyof ProposalItem,
        value: any
    ) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Calculate amount when quantity or cost changes
        if (field === "quantity" || field === "cost_per_item") {
            newItems[index].amount =
                newItems[index].quantity * newItems[index].cost_per_item;
        }

        setItems(newItems);
    };

    const handleAddProduct = (productId: number) => {
        const product = products.find((p) => p.id === productId);
        if (product) {
            const newItem: ProposalItem = {
                item_name: product.name,
                item_summary: "",
                type: "item",
                quantity: 1,
                cost_per_item: product.price,
                amount: product.price,
                tax: [],
            };
            setItems([...items, newItem]);
        }
    };

    const handleSubmit = async (values: any) => {
        try {
            setLoading(true);

            const formData = {
                ...values,
                deal_id: deal?.id || values.deal_id,
                valid_till: values.valid_till.format("YYYY-MM-DD"),
                items: items,
                sub_total: subTotal,
                discount_type: discountType,
                discount_value: discountValue,
                total: total,
                require_signature: values.require_signature ? 1 : 0,
            };

            const url =
                mode === "create"
                    ? route("proposals.store")
                    : route("proposals.update", proposal?.id);

            const method = mode === "create" ? "post" : "put";

            router[method](url, formData, {
                onSuccess: () => {
                    message.success(
                        `Proposal ${
                            mode === "create" ? "created" : "updated"
                        } successfully`
                    );
                    onClose();
                    onSuccess?.();
                },
                onError: (errors) => {
                    console.error("Proposal save error:", errors);
                    message.error("Failed to save proposal");
                },
                onFinish: () => setLoading(false),
            });
        } catch (error) {
            console.error("Error saving proposal:", error);
            message.error("Failed to save proposal");
            setLoading(false);
        }
    };

    const itemColumns = [
        {
            title: "Item & Description",
            dataIndex: "item_name",
            key: "item_name",
            width: "30%",
            render: (text: string, record: ProposalItem, index: number) => (
                <div className="flex flex-col gap-y-2">
                    <Input
                        placeholder="Item name"
                        value={record.item_name}
                        onChange={(e) =>
                            handleItemChange(index, "item_name", e.target.value)
                        }
                        className="mb-2"
                    />
                    <TextArea
                        placeholder="Item description"
                        value={record.item_summary}
                        onChange={(e) =>
                            handleItemChange(
                                index,
                                "item_summary",
                                e.target.value
                            )
                        }
                        rows={2}
                    />
                </div>
            ),
        },
        {
            title: "Qty",
            dataIndex: "quantity",
            key: "quantity",
            width: "10%",
            render: (text: number, record: ProposalItem, index: number) => (
                <InputNumber
                    min={1}
                    value={record.quantity}
                    onChange={(value) =>
                        handleItemChange(index, "quantity", value || 1)
                    }
                    style={{ width: "100%" }}
                />
            ),
        },
        {
            title: "Unit Price",
            dataIndex: "cost_per_item",
            key: "cost_per_item",
            width: "15%",
            render: (text: number, record: ProposalItem, index: number) => (
                <InputNumber
                    min={0}
                    step={0.01}
                    value={record.cost_per_item}
                    onChange={(value) =>
                        handleItemChange(index, "cost_per_item", value || 0)
                    }
                    style={{ width: "100%" }}
                    formatter={(value) =>
                        `$ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                    }
                    parser={(value) => {
                        if (!value) return 0;
                        const numericValue = value.replace(/\$\s?|(,*)/g, "");
                        return parseFloat(numericValue) || 0;
                    }}
                />
            ),
        },
        {
            title: "Tax",
            dataIndex: "tax",
            key: "tax",
            width: "15%",
            render: (text: string[], record: ProposalItem, index: number) => (
                <Select
                    mode="multiple"
                    placeholder="Select tax"
                    value={record.tax}
                    onChange={(value) => handleItemChange(index, "tax", value)}
                    style={{ width: "100%" }}
                >
                    {taxes.map((tax) => (
                        <Option key={tax.id} value={tax.id.toString()}>
                            {tax.tax_name} ({tax.rate_percent}%)
                        </Option>
                    ))}
                </Select>
            ),
        },
        {
            title: "Amount",
            dataIndex: "amount",
            key: "amount",
            width: "15%",
            render: (text: number, record: ProposalItem) => (
                <div className="text-right font-semibold">
                    ${record.amount.toFixed(2)}
                </div>
            ),
        },
        {
            title: "Action",
            key: "action",
            width: "10%",
            render: (text: any, record: ProposalItem, index: number) => (
                <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveItem(index)}
                />
            ),
        },
    ];

    return (
        <Drawer
            title={`${mode === "create" ? "Create" : "Edit"} Proposal`}
            open={visible}
            onClose={onClose}
            width={1200}
        >
            <Form
                form={form}
                layout="vertical"
                onFinish={handleSubmit}
                className="proposal-form"
            >
                <Row gutter={16}>
                    {!deal && (
                        <Col xs={24} sm={12} md={8}>
                            <Form.Item
                                name="deal_id"
                                label="Deal"
                                rules={[
                                    {
                                        required: true,
                                        message: "Please select a deal",
                                    },
                                ]}
                            >
                                <Select placeholder="Select deal" showSearch>
                                    {/* Deal options would be loaded from props */}
                                    <Option value={1}>Sample Deal</Option>
                                </Select>
                            </Form.Item>
                        </Col>
                    )}

                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="valid_till"
                            label="Valid Till"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select valid till date",
                                },
                            ]}
                        >
                            <DatePicker style={{ width: "100%" }} />
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} md={8}>
                        <Form.Item
                            name="currency_id"
                            label="Currency"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select currency",
                                },
                            ]}
                        >
                            <Select placeholder="Select currency">
                                {currencies.map((currency) => (
                                    <Option
                                        key={currency.id}
                                        value={currency.id}
                                    >
                                        {currency.currency_code} (
                                        {currency.currency_symbol})
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col xs={24} sm={12} md={8}>
                        <Form.Item name="calculate_tax" label="Calculate Tax">
                            <Select defaultValue="after_discount">
                                <Option value="after_discount">
                                    After Discount
                                </Option>
                                <Option value="before_discount">
                                    Before Discount
                                </Option>
                            </Select>
                        </Form.Item>
                    </Col>
                </Row>

                <Row>
                    <Col span={24}>
                        <Form.Item name="description" label="Description">
                            <TextArea
                                rows={4}
                                placeholder="Proposal description"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row>
                    <Col span={12}>
                        <Form.Item
                            name="require_signature"
                            valuePropName="checked"
                        >
                            <Checkbox>Require Signature</Checkbox>
                        </Form.Item>
                    </Col>
                </Row>

                <Divider />

                {/* Products Section */}
                <div className="mb-4">
                    <div className="flex justify-between items-center mb-4">
                        <h4>Items</h4>
                        <Space>
                            <Button
                                icon={<FilterOutlined />}
                                onClick={() =>
                                    setShowProductCategory(!showProductCategory)
                                }
                            >
                                Filter by Category
                            </Button>
                            <Select
                                placeholder="Add Product"
                                style={{ width: 200 }}
                                onSelect={(value) =>
                                    handleAddProduct(Number(value))
                                }
                                value={undefined}
                            >
                                {products.map((product) => (
                                    <Option key={product.id} value={product.id}>
                                        {product.name}
                                    </Option>
                                ))}
                            </Select>
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={handleAddItem}
                            >
                                Add Item
                            </Button>
                        </Space>
                    </div>

                    {showProductCategory && (
                        <div className="mb-4">
                            <Select
                                placeholder="Filter by category"
                                style={{ width: 200 }}
                                allowClear
                            >
                                {categories.map((category) => (
                                    <Option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.category_name}
                                    </Option>
                                ))}
                            </Select>
                        </div>
                    )}

                    <Table
                        dataSource={items}
                        columns={itemColumns}
                        pagination={false}
                        rowKey={(record, index) => index?.toString() || "0"}
                        locale={{
                            emptyText:
                                'No items added yet. Click "Add Item" to get started.',
                        }}
                    />
                </div>

                <Divider />

                {/* Totals Section */}
                <Card size="small" className="mb-4">
                    <Row gutter={24}>
                        <Col xs={24} sm={12}>
                            <div className="flex flex-col gap-y-2">
                                <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold">
                                        ${subTotal.toFixed(2)}
                                    </span>
                                </div>

                                <div className="flex items-center gap-x-2">
                                    <span>Discount:</span>
                                    <Select
                                        value={discountType}
                                        onChange={setDiscountType}
                                        style={{ width: 80 }}
                                        size="small"
                                    >
                                        <Option value="fixed">$</Option>
                                        <Option value="percent">%</Option>
                                    </Select>
                                    <InputNumber
                                        value={discountValue}
                                        onChange={(value) =>
                                            setDiscountValue(value || 0)
                                        }
                                        min={0}
                                        style={{ width: 100 }}
                                        size="small"
                                    />
                                </div>

                                <div className="flex justify-between text-lg font-bold">
                                    <span>Total:</span>
                                    <span>${total.toFixed(2)}</span>
                                </div>
                            </div>
                        </Col>
                        <Col xs={24} sm={12}>
                            <Form.Item name="note" label="Note">
                                <TextArea
                                    rows={4}
                                    placeholder="Additional notes"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>
                <Divider />

                {/* Form Actions */}
                <div className="flex justify-end space-x-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button type="primary" htmlType="submit" loading={loading}>
                        {mode === "create"
                            ? "Create Proposal"
                            : "Update Proposal"}
                    </Button>
                </div>
            </Form>
        </Drawer>
    );
}
