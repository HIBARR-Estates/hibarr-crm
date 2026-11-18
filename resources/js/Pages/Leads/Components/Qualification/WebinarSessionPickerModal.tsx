import React, { useEffect, useState } from "react";
import { Modal, List, Spin, Empty, message } from "antd";
import { formatCompanyDateTime } from "@/lib/companyDateTime";
import { WebinarSession } from "@/Types/qualification";
import { RegistrationService } from "@/Services/RegistrationService";
import { useTd } from "@/Hooks/useDynamicTranslation";

interface WebinarSessionPickerModalProps {
    open: boolean;
    webinarId: string;
    registrationService: RegistrationService;
    onClose: () => void;
    onSelect: (sessionId: string, sessionLabel: string) => void;
}

const WebinarSessionPickerModal: React.FC<WebinarSessionPickerModalProps> = ({
    open,
    webinarId,
    registrationService,
    onClose,
    onSelect,
}) => {
    const { td } = useTd();
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
                message.error(td("Failed to load webinar sessions", { source: "en" }));
            } finally {
                setLoading(false);
            }
        };

        load();
    }, [open, webinarId, registrationService]);

    const handleConfirm = () => {
        if (!selectedId) {
            message.warning(td("Please select a session", { source: "en" }));
            return;
        }
        const selected = sessions.find((session) => session.id === selectedId);
        if (!selected) {
            message.warning(td("Please select a session", { source: "en" }));
            return;
        }

        const sessionLabel = `${selected.title} · ${formatCompanyDateTime(selected.startsAt)}`;
        onSelect(selectedId, sessionLabel);
    };

    return (
        <Modal
            open={open}
            title={td("Select webinar session", { source: "en" })}
            onCancel={onClose}
            onOk={handleConfirm}
            okText={td("Register & complete", { source: "en" })}
            okButtonProps={{ disabled: !selectedId }}
            width={520}
        >
            {loading ? (
                <div className="flex justify-center py-8">
                    <Spin />
                </div>
            ) : sessions.length === 0 ? (
                <Empty description={td("No upcoming sessions", { source: "en" })} />
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
                                    {formatCompanyDateTime(session.startsAt)}
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
