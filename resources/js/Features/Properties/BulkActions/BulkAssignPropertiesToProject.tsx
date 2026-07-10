import { pluralOrSingular, formatLocationNameForDisplay } from "@/lib/utils";
import { IndexProps } from "@/Pages/Properties/Index";
import { IModalProps } from "@/Types/common";
import { router, usePage } from "@inertiajs/react";
import { Button, Form, message, Modal, Select } from "antd";
import { useState } from "react";
import type { DeveloperProjectOption } from "@/Types/developerProject";

interface Props extends IModalProps {
    ids: number[];
}

/**
 * Modal for bulk assigning properties to a Developer Project.
 *
 * Updated to use DeveloperProject model instead of legacy Project.
 * Developer selection is temporarily hidden (pinned for future implementation).
 */
const BulkAssignPropertiesToProject: React.FC<Props> = ({
    ids,
    open,
    onClose,
}) => {
    const { props } = usePage<IndexProps>();

    // Use developerProjects from props (updated in PropertyController)
    const developerProjects = (props?.developerProjects ||
        []) as DeveloperProjectOption[];

    const [assignProjectLoading, setAssignProjectLoading] = useState(false);
    const [projectForm] = Form.useForm();

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
                            "Properties assigned to project successfully",
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
                },
            );
        });
    };

    return (
        <Modal
            title="Assign Properties to Developer Project"
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
                    to a developer project.
                </p>
                <p className="text-gray-500 text-sm mt-1">
                    Note: Properties can only belong to one project at a time.
                </p>
            </div>
            <Form form={projectForm} layout="vertical">
                <Form.Item
                    name="project_id"
                    label="Select Developer Project"
                    rules={[
                        {
                            required: true,
                            message: "Please select a project",
                        },
                    ]}
                >
                    <Select
                        placeholder="Choose a developer project"
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label as string)
                                ?.toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        options={developerProjects.map((project) => ({
                            label: project.location
                                ? `${project.name} (${formatLocationNameForDisplay(project.location.name)})`
                                : project.name,
                            value: project.id,
                        }))}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default BulkAssignPropertiesToProject;
