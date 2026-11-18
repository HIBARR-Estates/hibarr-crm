import React from "react";
import { Form, Input, Select, Row, Col } from "antd";
import { CreateLeadFormData } from "@/Types/api/leads";
import PhoneInput from "antd-phone-input";
import { useCountries } from "@/Hooks/useFormData";
import { useTranslation } from "@/Hooks/useTranslation";

interface ContactDetailsTabProps {
    data: CreateLeadFormData;
    setData: (key: keyof CreateLeadFormData, value: any) => void;
    errors: Record<string, string>;
}

const ContactDetailsTab: React.FC<ContactDetailsTabProps> = ({
    data,
    setData,
    errors,
}) => {
    const { t } = useTranslation();
    const { countries } = useCountries();
    return (
        <div className="space-y-6">
            <Row gutter={[24, 16]}>
                <Col span={12}>
                    <Form.Item
                        label={t("pages.leads.save_form.company_name")}
                        validateStatus={errors.company_name ? "error" : ""}
                        help={errors.company_name}
                    >
                        <Input
                            placeholder={t("pages.leads.save_form.enter_company_name")}
                            value={data.company_name}
                            onChange={(e) =>
                                setData("company_name", e.target.value)
                            }
                        />
                    </Form.Item>
                </Col>

                <Col span={12}>
                    <Form.Item
                        label={t("pages.leads.save_form.website")}
                        validateStatus={errors.website ? "error" : ""}
                        help={errors.website}
                    >
                        <Input
                            placeholder={t("pages.leads.save_form.enter_website")}
                            value={data.website}
                            onChange={(e) => setData("website", e.target.value)}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label={t("pages.leads.save_form.cell_phone")}
                        validateStatus={errors.cell ? "error" : ""}
                        help={errors.cell}
                    >
                        <PhoneInput
                            enableSearch
                            placeholder={t("pages.leads.save_form.enter_cell_phone")}
                            value={data.cell}
                            onChange={(val) => {
                                // Convert PhoneInput object to string format
                                if (val && typeof val === 'object') {
                                    const parts = [
                                        val.countryCode,
                                        val.areaCode,
                                        val.phoneNumber
                                    ].filter(Boolean);
                                    setData("cell", parts.length > 0 ? `+${parts.join('')}` : '');
                                } else {
                                    setData("cell", val || '');
                                }
                            }}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label={t("pages.leads.save_form.office_phone")}
                        validateStatus={errors.office ? "error" : ""}
                        help={errors.office}
                    >
                        <PhoneInput
                            enableSearch
                            placeholder={t("pages.leads.save_form.enter_office_phone")}
                            value={data.office}
                            onChange={(val) => {
                                // Convert PhoneInput object to string format
                                if (val && typeof val === 'object') {
                                    const parts = [
                                        val.countryCode,
                                        val.areaCode,
                                        val.phoneNumber
                                    ].filter(Boolean);
                                    setData("office", parts.length > 0 ? `+${parts.join('')}` : '');
                                } else {
                                    setData("office", val || '');
                                }
                            }}
                        />
                    </Form.Item>
                </Col>


                <Col span={24}>
                    <Form.Item
                        label={t("pages.leads.save_form.address")}
                        validateStatus={errors.address ? "error" : ""}
                        help={errors.address}
                    >
                        <Input.TextArea
                            placeholder={t("pages.leads.save_form.enter_full_address")}
                            value={data.address}
                            onChange={(e) => setData("address", e.target.value)}
                            rows={3}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label={t("pages.leads.save_form.postal_code")}
                        validateStatus={errors.postal_code ? "error" : ""}
                        help={errors.postal_code}
                    >
                        <Input
                            placeholder={t("pages.leads.save_form.enter_postal_code")}
                            value={data.postal_code}
                            onChange={(e) =>
                                setData("postal_code", e.target.value)
                            }
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label={t("pages.leads.save_form.city")}
                        validateStatus={errors.city ? "error" : ""}
                        help={errors.city}
                    >
                        <Input
                            placeholder={t("pages.leads.save_form.enter_city")}
                            value={data.city}
                            onChange={(e) => setData("city", e.target.value)}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label={t("pages.leads.save_form.state_province_short")}
                        validateStatus={errors.state ? "error" : ""}
                        help={errors.state}
                    >
                        <Input
                            placeholder={t("pages.leads.save_form.enter_state_province")}
                            value={data.state}
                            onChange={(e) => setData("state", e.target.value)}
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        label={t("pages.leads.save_form.country")}
                        validateStatus={errors.country ? "error" : ""}
                        help={errors.country}
                    >
                        <Select
                            placeholder={t("pages.leads.save_form.select_country")}
                            value={data.country}
                            onChange={(value) => setData("country", value)}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {countries.map(
                                (country: {
                                    iso: string;
                                    nicename: string;
                                }) => (
                                    <Select.Option
                                        key={country.iso}
                                        value={country.nicename}
                                    >
                                        <span
                                            className={`flag-icon flag-icon-${country.iso.toLowerCase()} mr-2`}
                                        />
                                        {country.nicename}
                                    </Select.Option>
                                )
                            )}
                        </Select>
                    </Form.Item>
                </Col>   
            </Row>
        </div>
    );
};

export default ContactDetailsTab;
