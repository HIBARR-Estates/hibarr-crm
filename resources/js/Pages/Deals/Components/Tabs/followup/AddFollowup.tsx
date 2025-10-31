import { Deal } from "@/Types/api/deals";
import { IModalProps } from "@/Types/common";
import { router, useForm } from "@inertiajs/react";
import { Drawer, message } from "antd";
import { useState } from "react";
import SaveFollowup from "./SaveFollowup";

interface SaveFollowupFormData {
    next_follow_up_date: string;
    start_time: string;
    meeting_type_id?: number;
    location: string;
    meeting_link?: string;
    send_reminder?: boolean;
    remind_time?: number;
    remind_type?: string;
    remark?: string;
    deal_id: number;
}

interface Props extends IModalProps {
    deal: Deal;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onFollowupAdded?: () => void;
}

const AddFollowup: React.FC<Props> = ({
    deal,
    meetingTypes,
    onClose,
    open,
    onFollowupAdded,
}) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const {
        data,
        setData,
        post,
        processing,
        errors: formErrors,
        reset,
    } = useForm<SaveFollowupFormData>({
        next_follow_up_date: "",
        start_time: "",
        meeting_type_id: undefined,
        location: "office",
        meeting_link: "",
        send_reminder: false,
        remind_time: 15,
        remind_type: "minute",
        remark: "",
        deal_id: deal.id,
    });

    const handleSubmit = (formData: SaveFollowupFormData) => {
        setSaving(true);
        setErrors([]);

        // Update the form data first
        setData({
            next_follow_up_date: formData.next_follow_up_date,
            start_time: formData.start_time,
            meeting_type_id: formData.meeting_type_id,
            location: formData.location,
            meeting_link: formData.meeting_link,
            send_reminder: formData.send_reminder,
            remind_time: formData.remind_time,
            remind_type: formData.remind_type,
            remark: formData.remark,
            deal_id: deal.id,
        });

        // Use setTimeout to ensure setData has updated the form
        setTimeout(() => {
            post(route("deals.follow_up_store"), {
                onSuccess: () => {
                    message.success("Follow-up created successfully");
                    reset();
                    setSaving(false);
                    onClose();
                    // Refresh the page to show the new follow-up
                    router.reload();
                    if (onFollowupAdded) {
                        onFollowupAdded();
                    }
                },
                onError: (errors: any) => {
                    setSaving(false);
                    const errorMessages = Object.values(errors)
                        .flat()
                        .map(String);
                    setErrors(errorMessages);
                    message.error("Please check the form for errors");
                },
            });
        }, 0);
    };

    const handleCancel = () => {
        reset();
        setErrors([]);
        onClose();
    };

    // Combine form errors with manual errors
    const allErrors = [
        ...errors,
        ...Object.values(formErrors).flat().map(String),
    ];

    return (
        <Drawer
            title="Add Follow-up"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
        >
            <SaveFollowup
                deal={deal}
                meetingTypes={meetingTypes}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing || saving}
                errors={allErrors}
            />
        </Drawer>
    );
};

export default AddFollowup;
