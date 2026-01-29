import { SaveOutlined } from "@ant-design/icons";
import { Form, Select, Card, Row, Col, Button } from "antd";
import { PropertyFormProps } from "./PropertyForm";
import { Property } from "@/Types";
import { useEffect } from "react";

const EXTERIOR_FEATURES = [
    { label: "Balcony", value: "Balcony" },
    { label: "Garden", value: "Garden" },
    { label: "Swimming Pool", value: "Swimming Pool" },
    { label: "Terrace", value: "Terrace" },
    { label: "Garage", value: "Garage" },
    { label: "Parking", value: "Parking" },
    { label: "Fenced Yard", value: "Fenced Yard" },
    { label: "Outdoor Kitchen", value: "Outdoor Kitchen" },
    // Add 12 more
    { label: "Fire Pit", value: "Fire Pit" },
    { label: "Deck", value: "Deck" },
    { label: "Patio", value: "Patio" },
    { label: "Lawn", value: "Lawn" },
    { label: "Irrigation System", value: "Irrigation System" },
    { label: "Playground", value: "Playground" },
    { label: "Tennis Court", value: "Tennis Court" },
    { label: "Basketball Court", value: "Basketball Court" },
    { label: "Sauna", value: "Sauna" },
    { label: "Hot Tub", value: "Hot Tub" },
    { label: "Outdoor Lighting", value: "Outdoor Lighting" },
    { label: "Storage Shed", value: "Storage Shed" },
    { label: "Greenhouse", value: "Greenhouse" },
];

const INTERIOR_FEATURES = [
    { label: "Fireplace", value: "Fireplace" },
    { label: "Hardwood Floors", value: "Hardwood Floors" },
    { label: "Granite Countertops", value: "Granite Countertops" },
    //add 17 more
    { label: "Walk-in Closet", value: "Walk-in Closet" },
    { label: "Central Air Conditioning", value: "Central Air Conditioning" },
    {
        label: "Stainless Steel Appliances",
        value: "Stainless Steel Appliances",
    },
    { label: "Vaulted Ceilings", value: "Vaulted Ceilings" },
    { label: "Recessed Lighting", value: "Recessed Lighting" },
    { label: "Crown Molding", value: "Crown Molding" },
    { label: "Built-in Shelving", value: "Built-in Shelving" },
    { label: "Smart Home Features", value: "Smart Home Features" },
    { label: "Laundry Room", value: "Laundry Room" },
    { label: "Breakfast Nook", value: "Breakfast Nook" },
    { label: "Home Office", value: "Home Office" },
    { label: "Wet Bar", value: "Wet Bar" },
    { label: "Skylights", value: "Skylights" },
    { label: "Tile Flooring", value: "Tile Flooring" },
    { label: "Carpeted Floors", value: "Carpeted Floors" },
    { label: "Open Floor Plan", value: "Open Floor Plan" },
    { label: "Security System", value: "Security System" },
];

const LOCATION_FEATURES = [
    { label: "Near Public Transport", value: "Near Public Transport" },
    { label: "Close to Schools", value: "Close to Schools" },
    { label: "Shopping Nearby", value: "Shopping Nearby" },
    //add 17 more
    { label: "Parks and Recreation", value: "Parks and Recreation" },
    { label: "Waterfront", value: "Waterfront" },
    { label: "Mountain Views", value: "Mountain Views" },
    { label: "Downtown Access", value: "Downtown Access" },
    { label: "Quiet Neighborhood", value: "Quiet Neighborhood" },
    { label: "Gated Community", value: "Gated Community" },
    { label: "Golf Course Nearby", value: "Golf Course Nearby" },
    { label: "Hiking Trails", value: "Hiking Trails" },
    { label: "Bike Paths", value: "Bike Paths" },
    { label: "Cultural Attractions", value: "Cultural Attractions" },
    { label: "Restaurants and Cafes", value: "Restaurants and Cafes" },
    { label: "Medical Facilities", value: "Medical Facilities" },
    { label: "Entertainment Venues", value: "Entertainment Venues" },
    { label: "Airport Proximity", value: "Airport Proximity" },
    { label: "Public Services", value: "Public Services" },
    { label: "Community Events", value: "Community Events" },
];

const ADD_ONS = [
    { label: "Furnished", value: "Furnished" },
    { label: "Utilities Included", value: "Utilities Included" },
    { label: "Pet Friendly", value: "Pet Friendly" },
    //add 17 more
    { label: "Washer/Dryer", value: "Washer/Dryer" },
    { label: "Cable/Satellite TV", value: "Cable/Satellite TV" },
    { label: "Internet Included", value: "Internet Included" },
    { label: "Cleaning Service", value: "Cleaning Service" },
    { label: "Gym Membership", value: "Gym Membership" },
    { label: "Pool Access", value: "Pool Access" },
    { label: "Parking Space", value: "Parking Space" },
    { label: "Storage Unit", value: "Storage Unit" },
];

type Props = Pick<
    PropertyFormProps,
    | "onCancel"
    | "loading"
    | "submitText"
    | "cancelText"
    | "data"
    | "onSubmit"
    | "setErrors"
    | "onErrorsClear"
>;

export default function FeaturesAndAddOnsTab({
    onCancel,
    cancelText,
    loading,
    submitText,
    data,
    onSubmit,
    onErrorsClear,
    setErrors,
}: Props) {
    const [form] = Form.useForm<Omit<Property, "id">>();

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            // Transform the data to handle null values properly
            const formData: any = {
                ...data,
                exterior_features: data.exterior_features || [],
                interior_features: data.interior_features || [],
                location_features: data.location_features || [],
                photos: data.photos || [],
                add_ons: data.add_ons || [],
            };
            form.setFieldsValue(formData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);
    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
        const formData = {
            ...values,
            within_site: values.within_site || false,
            // Handle array fields
            exterior_features: values.exterior_features || [],
            interior_features: values.interior_features || [],
            location_features: values.location_features || [],
            photos: values.photos || [],
            add_ons: values.add_ons || [],
        };

        onSubmit(formData);
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
                // console.log("Form validation failed:", errorInfo);
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat(),
                );
                // Extract validation errors and add to errors list
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <Card title="Features & Add Ons" size="small">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Form.Item
                            name="exterior_features"
                            label="Exterior Features"
                        >
                            <Select
                                mode="multiple"
                                placeholder="Select exterior features"
                                options={EXTERIOR_FEATURES}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item
                            name="interior_features"
                            label="Interior Features"
                        >
                            <Select
                                mode="multiple"
                                placeholder="Select interior features"
                                options={INTERIOR_FEATURES}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item
                            name="location_features"
                            label="Location Features"
                        >
                            <Select
                                mode="multiple"
                                placeholder="Select location features"
                                options={LOCATION_FEATURES}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item name="add_ons" label="Add-Ons">
                            <Select
                                mode="multiple"
                                placeholder="Select add-ons"
                                options={ADD_ONS}
                            />
                        </Form.Item>
                    </Col>
                </Row>
                <Row justify="end" gutter={8}>
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
            </Card>
        </Form>
    );
}
