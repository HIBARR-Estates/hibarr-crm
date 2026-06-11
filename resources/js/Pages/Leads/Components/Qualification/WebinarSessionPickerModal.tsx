import React, { useEffect, useState } from "react";
import { Modal, List, Spin, Empty, message } from "antd";
import dayjs from "dayjs";
import { WebinarSession } from "@/Types/qualification";
import { RegistrationService } from "@/Services/RegistrationService";

interface WebinarSessionPickerModalProps {
    open: boolean;
    webinarId: string;
    registrationService: RegistrationService;
    onClose: () => void;
    onSelect: (sessionId: string) => void;
}

const WebinarSessionPickerModal: React.FC<WebinarSessionPickerModalProps> = ({
    open,
    webinarId,
    registrationService,
    onClose,
    onSelect,
}) => {
    const [loading, setLoading] = useState(false);
    const [sessions, setSessions] = useState<WebinarSession[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    useEffect(() => {
        if (!open || !webinarId) return;

        const load = async () => {
            setLoading(true);
            try {
                const response =
                    await registrationService.getNextWebinarSessions(webinarId);
                setSessions(response.data ?? []);
            } catch {
                message.error("Failed to load webinar sessions");
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [open, webinarId, registrationService]);

    const handleConfirm = () => {
        if (!selectedId) {
            message.warning("Please select a session");
            return;
        }
        onSelect(selectedId);
    };

    return (
        <Modal
            open={open}
            title="Select webinar session"
            onCancel={onClose}
            onOk={handleConfirm}
            okText="Register & complete"
            okButtonProps={{ disabled: !selectedId }}
            width={520}
        >
            {loading ? (
                <div className="flex justify-center py-8">
                    <Spin />
                </div>
            ) : sessions.length === 0 ? (
                <Empty description="No upcoming sessions" />
            ) : (
                <List
                    dataSource={sessions}
                    renderItem={(session) => (
                        <List.Item
                            className={`cursor-pointer rounded-lg px-3 transition-colors ${
                                selectedId === session.id
                                    ? "bg-blue-50 border border-blue-200"
                                    : "hover:bg-gray-50"
                            }`}
                            onClick={() => setSelectedId(session.id)}
                        >
                            <div>
                                <div className="font-medium">{session.title}</div>
                                <div className="text-sm text-gray-500">
                                    {dayjs(session.startsAt).format(
                                        "ddd, MMM D, YYYY · h:mm A",
                                    )}
                                    {session.timezone
                                        ? ` (${session.timezone})`
                                        : ""}
                                </div>
                            </div>
                        </List.Item>
                    )}
                />
            )}
        </Modal>
    );
};

export default WebinarSessionPickerModal;
