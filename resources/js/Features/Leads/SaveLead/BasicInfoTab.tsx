import React, { useEffect } from "react";
import {
    Form,
    Input,
    Select,
    Row,
    Col,
    Checkbox,
    Card,
    Divider,
    Button,
    DatePicker,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import { LeadFormProps } from "./LeadForm";
import LeadDealCreation from "./LeadDealCreation";
import dayjs from "dayjs";
import FormDataSelector from "@/Components/FormDataSelector";
import PhoneInput from "antd-phone-input";

interface BasicInfoTabProps
    extends Pick<
        LeadFormProps,
        | "onCancel"
        | "loading"
        | "submitText"
        | "cancelText"
        | "data"
        | "onSubmit"
        | "setErrors"
        | "onErrorsClear"
    > {
    setLead?: (lead: Lead | undefined) => void;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText = "Save Contact",
    cancelText = "Cancel",
    onErrorsClear,
    setErrors,
    setLead,
}) => {
    const { props } = usePage<any>();
    const {
        salutations,
        sources,
        categories,
        employees,
        permissions,
        countries,
        languages = [],
        featureFlags,
    } = props;
    const useLeadCoreFields =
        featureFlags?.["crm.lead-language-core-field"] === true;
    const [form] = Form.useForm();
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const isEditing = data ? true : false;
    // Populate form when data changes
    useEffect(() => {
        if (data) {
            const formData = {
                ...data,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                date_of_birth: data.date_of_birth ? dayjs(data.date_of_birth) : null,
                deal_watcher: data.deal_watcher || [],
                product_id: data.product_id || [],
            };
            form.setFieldsValue(formData);
        }
    }, [data, form]);

    // watch create_deal and create_client checkboxes to update form values
    const createDeal = Form.useWatch("create_deal", form);
    const createClient = Form.useWatch("create_client", form);

    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
        const formData = {
            ...values,
            close_date: values.close_date
                ? values.close_date.format("YYYY-MM-DD")
                : "",
            date_of_birth: values.date_of_birth
                ? values.date_of_birth.format("YYYY-MM-DD")
                : null,
            deal_watcher: values.deal_watcher || [],
            product_id: values.product_id || [],
            strategy_accepted: values.strategy_accepted || false,
            downpayment_confirmed: values.downpayment_confirmed || false,
            create_deal: createDeal,
        };

        onSubmit(formData);
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat()
                );
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <div className="space-y-4">
                <Card title="Contact Information" size="small">
                    <Row gutter={[24, 16]}>
                        <Col span={8}>
                            <Form.Item label="Salutation" name="salutation">
                                <FormDataSelector
                                    type="salutations"
                                    placeholder="Salutation"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Gender" name="gender">
                                <FormDataSelector
                                    type="genders"
                                    placeholder="Gender"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                label="Name"
                                name={"client_name"}
                                rules={[
                                    {
                                        required: true,
                                        message: "Name is required",
                                    },
                                ]}
                            >
                                <Input placeholder="Enter full name" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Email" name={"client_email"}>
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Mobile" name="mobile">
                                <PhoneInput 
                                    enableSearch 
                                    placeholder="Enter mobile number"
                                    country=""
                                />
                            </Form.Item>
                        </Col>

                        {permissions?.view_lead_sources !== "none" && (
                            <Col span={8}>
                                <Form.Item
                                    label="Lead Source"
                                    name={"source_id"}
                                >
                                    <FormDataSelector
                                        type="sources"
                                        placeholder="Lead Source"
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        {permissions?.add_lead === "all" && (
                            <Col span={8}>
                                <Form.Item label="Added By" name={"added_by"}>
                                    <FormDataSelector
                                        type="employees"
                                        placeholder="Added By"
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        <Col span={8}>
                            <Form.Item label="Lead Owner" name={"lead_owner"}>
                                <FormDataSelector
                                    type="employees"
                                    placeholder="Lead Owner"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {/* Deal Creation Options */}
                    {isEditing && (
                        <Row gutter={[24, 16]} className="mt-4">
                            {["all", "added"].includes(
                                permissions?.add_deals
                            ) && (
                                <Col span={12}>
                                    <Form.Item name={"create_deal"}>
                                        <Checkbox value={"on"}>
                                            Create Deal
                                        </Checkbox>
                                    </Form.Item>
                                </Col>
                            )}

                            <Col span={12}>
                                <Form.Item name={"create_client"}>
                                    <Checkbox value={true}>
                                        Auto Convert lead to client when deal
                                        stage is set to 'Win'
                                    </Checkbox>
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    {createDeal && <LeadDealCreation />}
                </Card>

                {useLeadCoreFields && (
                    <Card title="Personal Details" size="small">
                        <Row gutter={[24, 16]}>
                            <Col span={12}>
                                <Form.Item label="Languages" name="languages">
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        placeholder="Select languages"
                                        options={(languages || []).map(
                                            (lang: {
                                                language_code: string;
                                                language_name: string;
                                            }) => ({
                                                value: lang.language_code,
                                                label: lang.language_name,
                                            }),
                                        )}
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    label="Date of Birth"
                                    name="date_of_birth"
                                >
                                    <DatePicker className="w-full" />
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item
                                    label="Nationality"
                                    name="nationality"
                                >
                                    <Select
                                        placeholder="Select nationality"
                                        allowClear
                                        showSearch
                                        optionFilterProp="label"
                                    >
                                        {(countries || []).map(
                                            (country: {
                                                iso: string;
                                                nicename: string;
                                            }) => (
                                                <Select.Option
                                                    key={country.iso}
                                                    value={country.nicename}
                                                    label={country.nicename}
                                                >
                                                    {country.nicename}
                                                </Select.Option>
                                            ),
                                        )}
                                    </Select>
                                </Form.Item>
                            </Col>
                            <Col span={12}>
                                <Form.Item label="Occupation" name="occupation">
                                    <Input placeholder="Enter occupation" />
                                </Form.Item>
                            </Col>
                        </Row>
                    </Card>
                )}

                {/* Address Information */}
                <Card title="Address Information" size="small">
                    <Row gutter={[24, 16]}>
                        <Col span={24}>
                            <Form.Item label="Address" name="address">
                                <Input.TextArea
                                    rows={2}
                                    placeholder="Enter street address"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Postal Code" name="postal_code">
                                <Input placeholder="Enter postal code" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="City" name="city">
                                <Input placeholder="Enter city" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="State/Province" name="state">
                                <Input placeholder="Enter state or province" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Country" name="country">
                                <Select
                                    placeholder="Select country"
                                    allowClear
                                    showSearch
                                    optionFilterProp="label"
                                    filterOption={(input, option) => {
                                        const searchText = input.toLowerCase();
                                        const countryValue = option?.value as string;
                                        const country = (countries || []).find(
                                            (c: {
                                                iso: string;
                                                nicename: string;
                                                name?: string;
                                                iso3?: string;
                                                nationality?: string;
                                            }) => c.nicename === countryValue,
                                        );

                                        if (!country) return false;

                                        return (
                                            country.nicename
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.name
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.iso
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.iso3
                                                ?.toLowerCase()
                                                .includes(searchText) ||
                                            country.nationality
                                                ?.toLowerCase()
                                                .includes(searchText)
                                        );
                                    }}
                                >
                                    {(countries || []).map(
                                        (country: {
                                            iso: string;
                                            nicename: string;
                                        }) => (
                                            <Select.Option
                                                key={country.iso}
                                                value={country.nicename}
                                                label={country.nicename}
                                            >
                                                <span
                                                    className={`flag-icon flag-icon-${country.iso.toLowerCase()} mr-2`}
                                                />
                                                {country.nicename}
                                            </Select.Option>
                                        ),
                                    )}
                                </Select>
                            </Form.Item>
                        </Col>
                    </Row>
                </Card>

                <Divider />

                <Row justify="end" gutter={8} style={{ marginTop: 24 }}>
                    <Col>
                        <Button onClick={onCancel}>{cancelText}</Button>
                    </Col>
                    <Col>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={loading}
                            icon={<SaveOutlined />}
                        >
                            {submitText}
                        </Button>
                    </Col>
                </Row>
            </div>
        </Form>
    );
};

export default BasicInfoTab;
