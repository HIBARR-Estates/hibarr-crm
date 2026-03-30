import { useEffect } from "react";
import { Button, Form, Input, Modal, Select } from "antd";
import type { DeveloperProject, ProjectLocationOption } from "@/Types/developerProject";
import type { CreateDeveloperProjectInput } from "@/Types/developerProject";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";

export interface ProjectFormModalProps {
    open: boolean;
    onClose: () => void;
    project?: DeveloperProject | null;
    locations: ProjectLocationOption[];
    locationsLoading: boolean;
    onSuccess: () => void;
}

const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
    open,
    onClose,
    project,
    locations,
    locationsLoading,
    onSuccess,
}) => {
    const [form] = Form.useForm();
    const isEditing = !!project;

    const createMutation = useApiMutate<
        CreateDeveloperProjectInput,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(route("developer-projects.store"), "POST", () => {
        form.resetFields();
        onClose();
        onSuccess();
    });

    const updateMutation = useApiMutate<
        CreateDeveloperProjectInput,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(
        project ? route("developer-projects.update", project.id) : "",
        "PUT",
        () => {
            form.resetFields();
            onClose();
            onSuccess();
        },
    );

    const isLoading = createMutation.isPending || updateMutation.isPending;

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            const payload: CreateDeveloperProjectInput = {
                name: values.name,
                description: values.description,
                project_location_id: values.project_location_id,
            };

            if (isEditing) {
                updateMutation.mutate(payload);
            } else {
                createMutation.mutate(payload);
            }
        });
    };

    useEffect(() => {
        if (open) {
            form.setFieldsValue({
                name: project?.name || "",
                description: project?.description || "",
                project_location_id: project?.project_location_id || undefined,
            });
        } else {
            form.resetFields();
        }
    }, [open, project, form]);

    return (
        <Modal
            title={isEditing ? "Edit Project" : "Create Project"}
            open={open}
            onCancel={() => !isLoading && onClose()}
            footer={[
                <Button key="cancel" onClick={onClose} disabled={isLoading}>
                    Cancel
                </Button>,
                <Button
                    key="submit"
                    type="primary"
                    loading={isLoading}
                    onClick={handleSubmit}
                >
                    {isEditing ? "Update" : "Create"}
                </Button>,
            ]}
            destroyOnClose
        >
            <Form form={form} layout="vertical" className="mt-4">
                <Form.Item
                    name="name"
                    label="Project Name"
                    rules={[
                        { required: true, message: "Please enter project name" },
                        { max: 255, message: "Name cannot exceed 255 characters" },
                    ]}
                >
                    <Input placeholder="Enter project name" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <Input.TextArea
                        placeholder="Enter project description (optional)"
                        rows={3}
                    />
                </Form.Item>

                <Form.Item name="project_location_id" label="Location">
                    <Select
                        placeholder="Select a location"
                        allowClear
                        showSearch
                        optionFilterProp="children"
                        loading={locationsLoading}
                        options={locations.map((loc) => ({
                            value: loc.id,
                            label: `${loc.name}${loc.city ? ` (${loc.city})` : ""}`,
                        }))}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
};

export default ProjectFormModal;
