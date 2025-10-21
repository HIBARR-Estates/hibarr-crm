import { pluralOrSingular } from "@/lib/utils";
import { IndexProps } from "@/Pages/Properties/Index";
import { IModalProps } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import { Button, Form, message, Modal, Select } from "antd";
import { useState } from "react";

interface Props extends IModalProps {
    ids: number[];
}

const BulkAssignPropertiesToProject: React.FC<Props> = ({
    ids,
    open,
    onClose,
}) => {
    const { props } = usePage<IndexProps>();

    const developers = props?.developers;
    const projects = props?.projects;

    const [assignProjectLoading, setAssignProjectLoading] = useState(false);
    const [projectForm] = Form.useForm();
    const [selectedDeveloper, setSelectedDeveloper] = useState<number | null>(
        null
    );

    const filteredProjects = selectedDeveloper
        ? projects.filter(
              (project) => project.project_admin?.id === selectedDeveloper
          )
        : projects;

    const handleAssignToProject = () => {
        projectForm.validateFields().then((values) => {
            setAssignProjectLoading(true);
            router.post(
                route("properties.bulk_action"),
                {
                    property_ids: ids,
                    action_type: "assign_to_project",
                    project_id: values.project_id,
                },
                {
                    onSuccess: () => {
                        message.success(
                            "Properties assigned to project successfully"
                        );

                        onClose(true);
                        projectForm.resetFields();
                        router.reload();
                    },
                    onError: () => {
                        message.error("Failed to assign properties to project");
                    },
                    onFinish: () => {
                        setAssignProjectLoading(false);
                    },
                }
            );
        });
    };

    return (
        <Modal
            title="Assign Properties to Project"
            open={open}
            onCancel={() => !assignProjectLoading && onClose()}
            footer={[
                <Button
                    key="cancel"
                    onClick={() => onClose()}
                    disabled={assignProjectLoading}
                >
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={assignProjectLoading}
                    onClick={handleAssignToProject}
                >
                    Assign to Project
                </Button>,
            ]}
        >
            <div className="mb-4">
                <p>
                    You are about to assign{" "}
                    {pluralOrSingular(ids.length, "a property", "properties")}{" "}
                    to a project.
                </p>
            </div>
            <Form form={projectForm} layout="vertical">
                <Form.Item
                    name="developer_id"
                    label="Select Developer"
                    rules={[
                        {
                            required: true,
                            message: "Please select a developer",
                        },
                    ]}
                >
                    <Select
                        placeholder="Choose a developer"
                        onChange={(value) => {
                            setSelectedDeveloper(value);
                            projectForm.setFieldsValue({
                                project_id: undefined,
                            });
                        }}
                        showSearch
                        // filterOption={(input, option) =>
                        //     (option?.children as string)
                        //         ?.toLowerCase()
                        //         .includes(input.toLowerCase())
                        // }
                        options={developers?.map((developer) => ({
                            label: `${developer.name} (${developer.email})`,
                            value: developer.id,
                        }))}
                    />
                </Form.Item>
                <Form.Item
                    name="project_id"
                    label="Select Project"
                    rules={[
                        {
                            required: true,
                            message: "Please select a project",
                        },
                    ]}
                >
                    <Select
                        placeholder="Choose a project"
                        disabled={!selectedDeveloper}
                        showSearch
                        // filterOption={(input, option) =>
                        //     (option?.children as string)
                        //         ?.toLowerCase()
                        //         .includes(input.toLowerCase())
                        // }

                        options={filteredProjects.map((project) => ({
                            label: project.project_name,
                            value: project.id,
                        }))}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default BulkAssignPropertiesToProject;
