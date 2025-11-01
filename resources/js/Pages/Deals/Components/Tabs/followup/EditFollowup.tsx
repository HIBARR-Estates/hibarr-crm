import { Deal } from "@/Types/api/deals";
import { DealFollowup } from "@/Types/api/deal-followup";
import { IModalProps } from "@/Types/common";
import { router, useForm } from "@inertiajs/react";
import { Drawer, message } from "antd";
import { useState, useEffect } from "react";
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
    id?: number;
}

interface Props extends IModalProps {
    deal: Deal;
    followup: DealFollowup;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onFollowupUpdated?: () => void;
}

const EditFollowup: React.FC<Props> = ({
    deal,
    followup,
    meetingTypes,
    onClose,
    open,
    onFollowupUpdated,
}) => {
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);

    const {
        data,
        setData,
        put,
        processing,
        errors: formErrors,
        reset,
    } = useForm<SaveFollowupFormData>({
        next_follow_up_date: followup.next_follow_up_date,
        start_time: followup.next_follow_up_date, // Assuming this contains both date and time
        meeting_type_id: followup.meetingType?.id,
        location: followup.location || "office",
        meeting_link: followup.meeting_link || "",
        send_reminder: false, // This would need to be added to the interface
        remind_time: 15,
        remind_type: "minute",
        remark: followup.remark || "",
        deal_id: deal.id,
        id: followup.id,
    });

    // Update form when followup changes
    useEffect(() => {
        if (followup) {
            setData({
                next_follow_up_date: followup.next_follow_up_date,
                start_time: followup.next_follow_up_date,
                meeting_type_id: followup.meetingType?.id,
                location: followup.location || "office",
                meeting_link: followup.meeting_link || "",
                send_reminder: false,
                remind_time: 15,
                remind_type: "minute",
                remark: followup.remark || "",
                deal_id: deal.id,
                id: followup.id,
            });
        }
    }, [followup, setData, deal.id]);

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
            id: followup.id,
        });

        // Use setTimeout to ensure setData has updated the form
        setTimeout(() => {
            put(route("deals.follow_up_update"), {
                onSuccess: () => {
                    message.success("Follow-up updated successfully");
                    setSaving(false);
                    onClose();
                    // Refresh the page to show the updated follow-up
                    router.reload();
                    if (onFollowupUpdated) {
                        onFollowupUpdated();
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
            title="Edit Follow-up"
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnClose
        >
            <SaveFollowup
                deal={deal}
                followup={followup}
                meetingTypes={meetingTypes}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                loading={processing || saving}
                errors={allErrors}
            />
        </Drawer>
    );
};

export default EditFollowup;
