import { Modal, Form, Input, Button, ColorPicker } from "antd";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface Props {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddTaskLabelModal({ open, onClose, onSuccess }: Props) {
    const { td } = useTd();
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
            title={td("Add Task Label", { source: "en" })}
            open={open}
            onCancel={onClose}
            footer={null}
            destroyOnClose
        >
            <Form form={form} layout="vertical" onFinish={handleSubmit}>
                <Form.Item
                    name="label_name"
                    label={td("Label Name", { source: "en" })}
                    rules={[
                        { required: true, message: "Please enter label name" },
                    ]}
                >
                    <Input placeholder={td("Enter label name", { source: "en" })} />
                </Form.Item>
                <Form.Item name="description" label={td("Description", { source: "en" })}>
                    <Input.TextArea placeholder={td("Enter description", { source: "en" })} />
                </Form.Item>
                <Form.Item name="color" label={td("Color", { source: "en" })} initialValue="#1d82f5">
                    <ColorPicker showText />
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
