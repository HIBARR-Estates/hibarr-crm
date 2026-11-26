import { Modal, Form, Input, Button } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
    const { td } = useTd();
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
            title={td("Add Task Category", { source: "en" })}
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    name="category_name"
                    label={td("Category Name", { source: "en" })}
                    rules={[
                        {
                            required: true,
                            message: "Please enter category name",
                        },
                    ]}
                >
                    <Input placeholder={td("Enter category name", { source: "en" })} />
                </Form.Item>
                <div className="flex justify-end space-x-2">
                    <Button onClick={onClose}>{td("Cancel", { source: "en" })}</Button>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={isPending}
                    >
                        {td("Save", { source: "en" })}
                    </Button>
                </div>
            </Form>
        </Modal>
    );
}
