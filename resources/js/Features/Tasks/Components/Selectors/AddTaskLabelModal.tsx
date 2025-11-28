import { Modal, Form, Input, Button, ColorPicker } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddTaskLabelModal({ open, onClose, onSuccess }: Props) {
    const [form] = Form.useForm();

    const { mutate, isPending } = useApiMutate(
        route("task-label.store"),
        "POST",
        () => {
            form.resetFields();
            onSuccess();
            onClose();
        }
    );

    const handleSubmit = (values: any) => {
        // ColorPicker returns an object, we need hex string
        const color =
            typeof values.color === "string"
                ? values.color
                : values.color?.toHexString();
        mutate({ ...values, color });
    };

    return (
        <Modal
            title="Add Task Label"
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    name="label_name"
                    label="Label Name"
                    rules={[
                        { required: true, message: "Please enter label name" },
                    ]}
                >
                    <Input placeholder="Enter label name" />
                </Form.Item>
                <Form.Item name="description" label="Description">
                    <Input.TextArea placeholder="Enter description" />
                </Form.Item>
                <Form.Item name="color" label="Color" initialValue="#1d82f5">
                    <ColorPicker showText />
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
