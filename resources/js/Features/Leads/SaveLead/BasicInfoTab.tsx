import React, { useEffect, useMemo, useRef } from "react";
import {
    Form,
    Input,
    InputNumber,
    Select,
    Row,
    Col,
    Checkbox,
    Divider,
    Button,
    DatePicker,
} from "antd";
import { Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import { LeadFormProps } from "./LeadForm";
import LeadDealCreation from "./LeadDealCreation";
import dayjs from "dayjs";
import FormDataSelector from "@/Components/FormDataSelector";
import PhoneInput from "antd-phone-input";
import {
    computeAgeFieldsFromDateOfBirth,
    computeAgeRangeFromAge,
    getLeadAgeFieldVisibility,
} from "@/lib/leadAge";

interface BasicInfoTabProps
    extends Pick
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
    onUserEdit?: () => void;
    formId?: string;
    hideFooter?: boolean;
    languageOptions?: Array<{ value: string; label: string }>;
    languagesLoading?: boolean;
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
    onUserEdit,
    formId,
    hideFooter = false,
    languageOptions = [],
    languagesLoading = false,
}) => {
    const { props } = usePage<any>();
    const {
        salutations,
        sources,
        categories,
        employees,
        permissions,
        countries,
        featureFlags,
    } = props;
    const useLeadCoreFields =
        featureFlags?.["crm.lead-language-core-field"] === true;
    const [form] = Form.useForm();
    const isPopulatingRef = useRef(false);
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const isEditing = data ? true : false;

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            isPopulatingRef.current = true;
            const computedAgeFields = data.date_of_birth
                ? computeAgeFieldsFromDateOfBirth(data.date_of_birth)
                : {
                      age: data.age ?? null,
                      age_range: data.age_range ?? null,
                  };
            const formData = {
                ...data,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                date_of_birth: data.date_of_birth ? dayjs(data.date_of_birth) : null,
                age: computedAgeFields.age ?? data.age ?? null,
                age_range: computedAgeFields.age_range ?? data.age_range ?? null,
                deal_watcher: data.deal_watcher || [],
                product_id: data.product_id || [],
            };
            form.setFieldsValue(formData);
            queueMicrotask(() => {
                isPopulatingRef.current = false;
            });
        }
    }, [data, form]);

    // watch create_deal and create_client checkboxes to update form values
    const createDeal = Form.useWatch("create_deal", form);
    const createClient = Form.useWatch("create_client", form);
    const dateOfBirth = Form.useWatch("date_of_birth", form);
    const watchedAge = Form.useWatch("age", form);
    const watchedAgeRange = Form.useWatch("age_range", form);

    const ageFieldVisibility = useMemo(
        () =>
            getLeadAgeFieldVisibility({
                dateOfBirth:
                    dateOfBirth === undefined
                        ? data?.date_of_birth ?? null
                        : dateOfBirth
                          ? dateOfBirth.format("YYYY-MM-DD")
                          : null,
                age: watchedAge ?? data?.age ?? null,
                ageRange: watchedAgeRange ?? data?.age_range ?? null,
            }),
        [dateOfBirth, watchedAge, watchedAgeRange, data],
    );

    useEffect(() => {
        if (isPopulatingRef.current) {
            return;
        }

        if (dateOfBirth) {
            const { age, age_range } =
                computeAgeFieldsFromDateOfBirth(dateOfBirth);
            form.setFieldsValue({ age, age_range });
            return;
        }

        if (watchedAge != null) {
            form.setFieldsValue({
                age_range: computeAgeRangeFromAge(Number(watchedAge)),
            });
        }
    }, [dateOfBirth, watchedAge, form]);

    const handleSubmit = (values: any) => {
        const computedAgeFields = values.date_of_birth
            ? computeAgeFieldsFromDateOfBirth(values.date_of_birth)
            : {
                  age:
                      values.age === null || values.age === undefined
                          ? null
                          : Number(values.age),
                  age_range: values.age_range || null,
              };

        // Transform the values to match the API expectations
        const formData = {
            ...values,
            close_date: values.close_date
                ? values.close_date.format("YYYY-MM-DD")
                : "",
            date_of_birth: values.date_of_birth
                ? values.date_of_birth.format("YYYY-MM-DD")
                : null,
            age: computedAgeFields.age,
            age_range: computedAgeFields.age_range,
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
            id={formId}
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onValuesChange={() => {
                if (!isPopulatingRef.current) {
                    onUserEdit?.();
                }
            }}
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
            <div className="space-y-1">
                <section className="save-lead-form__section">
                    <h3 className="save-lead-form__section-title">
                        Contact information
                    </h3>
                    <Row gutter={[24, 16]}>
                        <Col xs={24} md={8}>
                            <Form.Item label="Salutation" name="salutation">
                                <FormDataSelector
                                    type="salutations"
                                    placeholder="—"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item label="Gender" name="gender">
                                <FormDataSelector
                                    type="genders"
                                    placeholder="—"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item
                                label="Name"
                                name="client_name"
                                required
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

                        <Col xs={24} md={8}>
                            <Form.Item label="Email" name="client_email">
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={8}>
                            <Form.Item label="Mobile" name="mobile">
                                <PhoneInput
                                    enableSearch
                                    placeholder="—"
                                    country=""
                                />
                            </Form.Item>
                        </Col>

                        {permissions?.view_lead_sources !== "none" && (
                            <Col xs={24} md={8}>
                                <Form.Item label="Lead source" name="source_id">
                                    <FormDataSelector
                                        type="sources"
                                        placeholder="Lead source"
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        {permissions?.view_lead_categories !== "none" && (
                            <Col xs={24} md={8}>
                                <Form.Item label="Lead category" name="category_id">
                                    <FormDataSelector
                                        type="categories"
                                        placeholder="Lead category"
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        {permissions?.add_lead === "all" && (
                            <Col xs={24} md={8}>
                                <Form.Item label="Added By" name="added_by">
                                    <FormDataSelector
                                        type="employees"
                                        placeholder="Added By"
                                    />
                                </Form.Item>
                            </Col>
                        )}

                        <Col xs={24} md={8}>
                            <Form.Item label="Lead Owner" name="lead_owner">
                                <FormDataSelector
                                    type="employees"
                                    placeholder="Lead Owner"
                                />
                            </Form.Item>
                        </Col>
                    </Row>

                    {isEditing && (
                        <>
                            {["all", "added"].includes(
                                permissions?.add_deals,
                            ) && (
                                    <Row gutter={[24, 16]} className="mt-2">
                                        <Col span={24}>
                                            <Form.Item name="create_deal">
                                                <Checkbox>Create Deal</Checkbox>
                                            </Form.Item>
                                        </Col>
                                    </Row>
                                )}

                            <div className="save-lead-form__auto-convert">
                                <Form.Item name="create_client">
                                    <Checkbox>
                                        Auto-convert lead to client when deal
                                        stage is set to{" "}
                                        <strong>Won</strong>
                                    </Checkbox>
                                </Form.Item>
                            </div>
                        </>
                    )}

                    {createDeal && <LeadDealCreation />}
                </section>

                {useLeadCoreFields && (
                    <section className="save-lead-form__section">
                        <h3 className="save-lead-form__section-title">
                            Personal information
                        </h3>
                        <Row gutter={[24, 16]}>
                            <Col span={12}>
                                <Form.Item label="Languages" name="languages">
                                    <Select
                                        mode="multiple"
                                        allowClear
                                        placeholder="Select languages"
                                        options={languageOptions}
                                        loading={languagesLoading}
                                        showSearch
                                        optionFilterProp="label"
                                    />
                                </Form.Item>
                            </Col>
                            <Col span={24}>
                                <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_minmax(0,1fr)] gap-3 w-full">
                                    <Form.Item label="DOB" name="date_of_birth">
                                        <DatePicker
                                            className="w-full"
                                            format="DD MMM YYYY"
                                            placeholder="Select date"
                                        />
                                    </Form.Item>
                                    <Form.Item label="Age" name="age">
                                        <InputNumber
                                            className="!w-full"
                                            min={0}
                                            max={300}
                                            placeholder="Enter age"
                                            disabled={
                                                ageFieldVisibility.ageAndRangeReadOnly
                                            }
                                        />
                                    </Form.Item>
                                    <Form.Item
                                        label="Age Range"
                                        name="age_range"
                                    >
                                        <FormDataSelector
                                            type="age-ranges"
                                            placeholder="Select age range"
                                            disabled={
                                                ageFieldVisibility.ageAndRangeReadOnly
                                            }
                                        />
                                    </Form.Item>
                                </div>
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
                    </section>
                )}

                <section className="save-lead-form__section">
                    <h3 className="save-lead-form__section-title">
                        Address information
                    </h3>
                    <Row gutter={[24, 16]}>
                        <Col span={24}>
                            <Form.Item label="Street address" name="address">
                                <Input placeholder="Enter street address" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label="Postcode" name="postal_code">
                                <Input placeholder="Enter postcode" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label="City" name="city">
                                <Input placeholder="Enter city" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item
                                label="State / Province"
                                name="state"
                            >
                                <Input placeholder="Enter state or province" />
                            </Form.Item>
                        </Col>

                        <Col xs={24} md={12}>
                            <Form.Item label="Country" name="country">
                                <Select
                                    placeholder="— Select country —"
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
                </section>

                {!hideFooter && (
                    <>
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
                                >
                                    {submitText}
                                </Button>
                            </Col>
                        </Row>
                    </>
                )}
            </div>
        </Form>
    );
};

export default BasicInfoTab;