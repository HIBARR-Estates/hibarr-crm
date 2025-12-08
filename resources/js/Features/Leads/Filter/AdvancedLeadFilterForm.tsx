import React from "react";
import {
    Form,
    Select,
    DatePicker,
    Input,
    Row,
    Col,
    Divider,
    Typography,
} from "antd";
import { usePage } from "@inertiajs/react";
import { TFilter } from "@/Types/common";
import dayjs from "dayjs";

const { Title } = Typography;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

interface AdvancedLeadFilterFormProps {
    /**
     * Current filter values
     */
    filters: TFilter;

    /**
     * Function to handle filter changes
     */
    onFilterChange: (key: keyof TFilter, value: any) => void;
}

const AdvancedLeadFilterForm: React.FC<AdvancedLeadFilterFormProps> = ({
    filters,
    onFilterChange,
}) => {
    const { props } = usePage<any>();
    const { sources = [], employees = [], categories = [] } = props;

    const {
        search,
        lead_type,
        start_date,
        end_date,
        lead_source,
        lead_owner_id,
        added_by_id,
    } = filters;

    return (
        <div className="space-y-6">
            {/* Basic Search */}
            <div>
                <Title level={5} className="!mb-3">
                    Search & General
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Search
                        </label>
                        <Input.Search
                            placeholder="Search leads by contact name, email, company..."
                            value={search}
                            onChange={(e) =>
                                onFilterChange("search", e.target.value)
                            }
                            allowClear
                        />
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lead Type
                        </label>
                        <Select
                            value={lead_type || undefined}
                            onChange={(value) =>
                                onFilterChange("lead_type", value)
                            }
                            placeholder="Select lead type"
                            style={{ width: "100%" }}
                            allowClear
                            options={[
                                { label: "Lead", value: "lead" },
                                { label: "Client", value: "client" },
                            ]}
                        />
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lead Source
                        </label>
                        <Select
                            value={lead_source || undefined}
                            onChange={(value) =>
                                onFilterChange("lead_source", value)
                            }
                            placeholder="Select lead source"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {sources?.map((source: any) => (
                                <Select.Option
                                    key={source.id}
                                    value={source.id}
                                >
                                    {source.type}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Assignment & Ownership */}
            <div>
                <Title level={5} className="!mb-3">
                    Assignment & Ownership
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Lead Owner
                        </label>
                        <Select
                            value={lead_owner_id || undefined}
                            onChange={(value) =>
                                onFilterChange("lead_owner_id", value)
                            }
                            placeholder="Select lead owner"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {employees?.map((employee: any) => (
                                <Select.Option
                                    key={employee.id}
                                    value={employee.id}
                                >
                                    {employee.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Added By
                        </label>
                        <Select
                            value={added_by_id || undefined}
                            onChange={(value) =>
                                onFilterChange("added_by_id", value)
                            }
                            placeholder="Select who added"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {employees?.map((employee: any) => (
                                <Select.Option
                                    key={employee.id}
                                    value={employee.id}
                                >
                                    {employee.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Date Filters */}
            <div>
                <Title level={5} className="!mb-3">
                    Date Range
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Created Date Range
                        </label>
                        <RangePicker
                            value={[
                                start_date ? dayjs(start_date) : null,
                                end_date ? dayjs(end_date) : null,
                            ]}
                            onChange={(dates, dateStrings) => {
                                onFilterChange(
                                    "start_date",
                                    dateStrings[0] || undefined
                                );
                                onFilterChange(
                                    "end_date",
                                    dateStrings[1] || undefined
                                );
                            }}
                            style={{ width: "100%" }}
                            format="YYYY-MM-DD"
                        />
                    </Col>
                </Row>
            </div>
        </div>
    );
};

export default AdvancedLeadFilterForm;
