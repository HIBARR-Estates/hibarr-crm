import { Modal, Form, Input, Button } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddTaskCategoryModal({
    open,
    onClose,
    onSuccess,
}: Props) {
    const [form] = Form.useForm();

    const { mutate, isPending } = useApiMutate(
        route("taskCategory.store"),
        "POST",
        () => {
            form.resetFields();
            onSuccess();
            onClose();
        }
    );

    const handleSubmit = (values: any) => {
        mutate(values);
    };

    return (
        <Modal
            title="Add Task Category"
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    name="category_name"
                    label="Category Name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter category name",
                        },
                    ]}
                >
                    <Input placeholder="Enter category name" />
                </Form.Item>
                <div className="flex justify-end space-x-2">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isPending}
                    >
                        Save
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
