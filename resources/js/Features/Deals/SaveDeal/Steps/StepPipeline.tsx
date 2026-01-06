import React, { useEffect, useState } from "react";
import { Form, Select, Row, Col } from "antd";

interface StepPipelineProps {
    form: any;
    leadPipelines: any[];
    stages: any[];
}

const StepPipeline: React.FC<StepPipelineProps> = ({
    form,
    leadPipelines,
    stages,
}) => {
    const [filteredStages, setFilteredStages] = useState<any[]>([]);
    const pipelineId = Form.useWatch("pipeline", form);

    useEffect(() => {
        if (pipelineId) {
            const newStages = stages.filter(
                (stage) => stage.lead_pipeline_id === pipelineId
            );
            setFilteredStages(newStages);

            // If current stage is not in new pipeline, reset it
            const currentStage = form.getFieldValue("stage_id");
            if (currentStage && !newStages.find((s) => s.id === currentStage)) {
                form.setFieldValue("stage_id", undefined);
            }
        } else {
            setFilteredStages([]);
        }
    }, [pipelineId, stages, form]);

    return (
        <div className="step-pipeline">
            <Row gutter={16}>
                <Col span={12}>
                    <Form.Item
                        name="pipeline"
                        label="Pipeline"
                        rules={[
                            {
                                required: false,
                                message: "Please select a pipeline",
                            },
                        ]}
                    >
                        <Select placeholder="Select Pipeline">
                            {leadPipelines.map((pipeline) => (
                                <Select.Option
                                    key={pipeline.id}
                                    value={pipeline.id}
                                >
                                    {pipeline.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
                <Col span={12}>
                    <Form.Item
                        name="stage_id"
                        label="Stage"
                        rules={[
                            {
                                required: false,
                                message: "Please select a stage",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Select Stage"
                            disabled={!pipelineId}
                        >
                            {filteredStages.map((stage) => (
                                <Select.Option key={stage.id} value={stage.id}>
                                    <div className="flex items-center">
                                        <span
                                            className="w-2 h-2 rounded-full mr-2"
                                            style={{
                                                backgroundColor:
                                                    stage.label_color,
                                            }}
                                        />
                                        {stage.name}
                                    </div>
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>
            </Row>
        </div>
    );
};

export default StepPipeline;
