import React from "react";
import { Form, Select, InputNumber, Row, Col } from "antd";

interface StepPackagesProps {
    form: any;
    packages: any[];
    products: any[];
    defaultCurrencySymbol: string;
}

const StepPackages: React.FC<StepPackagesProps> = ({
    form,
    packages,
    products,
    defaultCurrencySymbol,
}) => {
    const calculateTotalValue = (currentPackageIds?: number[]) => {
        let total = 0;
        const packageIds =
            currentPackageIds || form.getFieldValue("package_id");

        if (Array.isArray(packageIds)) {
            packageIds.forEach((id) => {
                const selectedPackage = packages.find((p: any) => p.id === id);
                if (selectedPackage) {
                    total += parseFloat(selectedPackage.value);
                }
            });
        }
        // Optional: Auto-update value? The original code had it commented out.
        // form.setFieldValue("value", total);
    };

    const handlePackageChange = (packageIds: number[]) => {
        calculateTotalValue(packageIds);
    };

    return (
        <div className="step-packages">
            <h4 className="text-lg font-medium mb-4">
                Packages, Properties & Value
            </h4>
            <Row gutter={16}>
                <Col span={24}>
                    <Form.Item name="package_id" label="Packages">
                        <Select
                            mode="multiple"
                            placeholder="Select Packages"
                            onChange={handlePackageChange}
                            optionFilterProp="children"
                        >
                            {packages.map((pkg) => (
                                <Select.Option key={pkg.id} value={pkg.id}>
                                    {pkg.name} ({defaultCurrencySymbol}
                                    {pkg.value})
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item name="product_id" label="Properties (Products)">
                        <Select
                            mode="multiple"
                            placeholder="Select Properties"
                            optionFilterProp="children"
                        >
                            {products.map((product) => (
                                <Select.Option
                                    key={product.id}
                                    value={product.id}
                                >
                                    {product.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item
                        name="value"
                        label="Deal Value"
                        rules={[
                            {
                                required: false,
                                message: "Please enter deal value",
                            },
                        ]}
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            placeholder="Enter Value"
                            min={0}
                            prefix={defaultCurrencySymbol}
                            formatter={(value) =>
                                `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
                            }
                            // parser={(value) =>
                            //     value?.replace(
                            //         /\$\s?|(,*)/g,
                            //         ""
                            //     ) as unknown as number
                            // }
                        />
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default StepPackages;
