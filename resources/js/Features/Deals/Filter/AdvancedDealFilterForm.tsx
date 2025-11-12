import React, { useState } from "react";
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
const { RangePicker } = DatePicker;

interface AdvancedDealFilterFormProps {
    /**
     * Current filter values
     */
    filters: TFilter;

    /**
     * Function to handle filter changes
     */
    onFilterChange: (key: keyof TFilter, value: any) => void;
}

const AdvancedDealFilterForm: React.FC<AdvancedDealFilterFormProps> = ({
    filters,
    onFilterChange,
}) => {
    const { props } = usePage<any>();
    const {
        leadPipelines = [],
        categories = [],
        employees = [],
        stages = [],
    } = props;

    const {
        search,
        lead_pipeline_id,
        pipeline_stage_id,
        category_id,
        start_date,
        end_date,
    } = filters;

    const [selectedPipelineId, setSelectedPipelineId] = useState<
        number | undefined
    >(lead_pipeline_id);

    // Filter stages based on selected pipeline
    const filteredStages = stages.filter((stage: any) =>
        selectedPipelineId
            ? stage.lead_pipeline_id === selectedPipelineId
            : false
    );

    const handlePipelineChange = (value: number | undefined) => {
        setSelectedPipelineId(value);
        onFilterChange("lead_pipeline_id", value);
        // Reset stage when pipeline changes
        if (pipeline_stage_id) {
            onFilterChange("pipeline_stage_id", undefined);
        }
    };

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
                            placeholder="Search deals by contact name, company, deal name..."
                            value={search}
                            onChange={(e) =>
                                onFilterChange("search", e.target.value)
                            }
                            allowClear
                        />
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Pipeline & Stage */}
            <div>
                <Title level={5} className="!mb-3">
                    Pipeline & Stage
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Pipeline
                        </label>
                        <Select
                            value={lead_pipeline_id || undefined}
                            onChange={handlePipelineChange}
                            placeholder="Select pipeline"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {leadPipelines?.map((pipeline: any) => (
                                <Select.Option
                                    key={pipeline.id}
                                    value={pipeline.id}
                                >
                                    {pipeline.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>

                    <Col span={12}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Stage
                        </label>
                        <Select
                            value={pipeline_stage_id || undefined}
                            onChange={(value) =>
                                onFilterChange("pipeline_stage_id", value)
                            }
                            placeholder="Select stage"
                            style={{ width: "100%" }}
                            allowClear
                            disabled={!selectedPipelineId}
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {filteredStages?.map((stage: any) => (
                                <Select.Option key={stage.id} value={stage.id}>
                                    <span className="flex items-center">
                                        <span
                                            className="inline-block w-2 h-2 rounded-full mr-2"
                                            style={{
                                                backgroundColor:
                                                    stage.label_color,
                                            }}
                                        ></span>
                                        {stage.name}
                                    </span>
                                </Select.Option>
                            ))}
                        </Select>
                    </Col>
                </Row>
            </div>

            <Divider />

            {/* Category */}
            <div>
                <Title level={5} className="!mb-3">
                    Categorization
                </Title>
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category
                        </label>
                        <Select
                            value={category_id || undefined}
                            onChange={(value) =>
                                onFilterChange("category_id", value)
                            }
                            placeholder="Select category"
                            style={{ width: "100%" }}
                            allowClear
                            showSearch
                            filterOption={(input, option) =>
                                (option?.children as unknown as string)
                                    ?.toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                        >
                            {categories?.map((category: any) => (
                                <Select.Option
                                    key={category.id}
                                    value={category.id}
                                >
                                    {category.category_name}
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

export default AdvancedDealFilterForm;
