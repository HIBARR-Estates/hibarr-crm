import React, { useState, useEffect } from 'react';
import { 
    Row, 
    Col, 
    Input, 
    Upload, 
    Typography,
    Form,
    Select
} from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { Lead, Country } from '@/Types';
import PhoneInput from '@/Components/PhoneInput';

const { Title } = Typography;
const { TextArea } = Input;

interface Props {
    form: any;
    lead?: Lead;
    countries: Country[];
    employees: any[];
    permissions: {
        add_clients: string;
        manage_client_category: string;
        manage_client_subcategory: string;
        add_client_note: string;
    };
}

const CompanyDetailsTab: React.FC<Props> = ({
    form,
    lead,
    countries,
    employees,
    permissions
}) => {
    const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);

    // Find country by name if lead has country
    useEffect(() => {
        if (lead?.country && countries) {
            const country = countries.find(c => c.nicename === lead.country);
            if (country) {
                setSelectedCountry(country);
            }
        }
    }, [lead, countries]);

    return (
        <div>
            <Title level={4} className="mb-6">Company Details</Title>
            
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item
                        name="company_name"
                        label="Company Name"
                    >
                        <Input placeholder="Enter company name" />
                    </Form.Item>
                </Col>
                
                <Col span={8}>
                    <Form.Item
                        name="website"
                        label="Website"
                    >
                        <Input placeholder="Enter website URL" />
                    </Form.Item>
                </Col>
                
                <Col span={8}>
                    <Form.Item
                        name="tax_name"
                        label="Tax Name"
                    >
                        <Input placeholder="Enter tax name (GST/VAT)" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item
                        name="gst_number"
                        label="GST Number"
                    >
                        <Input placeholder="Enter GST number" />
                    </Form.Item>
                </Col>
                
                <Col span={8}>
                    <Form.Item
                        name="office"
                        label="Office Phone Number"
                    >
                        <PhoneInput 
                            countries={countries}
                            defaultCountry={selectedCountry}
                            fieldName="office"
                        />
                    </Form.Item>
                </Col>
                
                <Col span={8}>
                    <Form.Item
                        name="city"
                        label="City"
                    >
                        <Input placeholder="Enter city" />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item
                        name="state"
                        label="State"
                    >
                        <Input placeholder="Enter state" />
                    </Form.Item>
                </Col>
                
                <Col span={8}>
                    <Form.Item
                        name="postal_code"
                        label="Postal Code"
                    >
                        <Input placeholder="Enter postal code" />
                    </Form.Item>
                </Col>
                
                <Col span={8}>
                    <Form.Item
                        name="country_company"
                        label="Country"
                    >
                        <Select
                            placeholder="Select country"
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                            }
                            options={countries.map(country => ({
                                value: country.id,
                                label: country.nicename,
                            }))}
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row gutter={[16, 16]}>
                <Col span={12}>
                    <Form.Item
                        name="address"
                        label="Company Address"
                    >
                        <TextArea 
                            rows={4} 
                            placeholder="Enter company address"
                        />
                    </Form.Item>
                </Col>
                
                <Col span={12}>
                    <Form.Item
                        name="shipping_address"
                        label="Shipping Address"
                    >
                        <TextArea 
                            rows={4} 
                            placeholder="Enter shipping address"
                        />
                    </Form.Item>
                </Col>
            </Row>

            <Row>
                <Col span={24}>
                    <Form.Item
                        name="company_logo"
                        label="Company Logo"
                    >
                        <Upload
                            listType="picture-card"
                            maxCount={1}
                            accept=".png,.jpg,.jpeg,.svg,.bmp"
                            beforeUpload={() => false} // Prevent auto upload
                        >
                            <div>
                                <PlusOutlined />
                                <div className="mt-2">Upload Logo</div>
                            </div>
                        </Upload>
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default CompanyDetailsTab;