import { App, Input } from "antd";
import { useRef, useState, forwardRef, useImperativeHandle } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import type { Lead } from "@/Types/api/leads";
import type { LeadNote } from "@/Types/api/lead-note";
import DealButton from "@/Pages/Deals/Redesign/components/primitives/DealButton";
import LeadIcon from "../primitives/LeadIcon";

interface SaveNoteFormData {
    title: string;
    details: string;
    lead_id: number;
}

export interface QuickNoteCardHandle {
    focus: () => void;
}

export interface QuickNoteCardProps {
    lead: Lead;
    latestNote?: LeadNote | null;
    onNoteCreated?: (note: LeadNote) => void;
}

const QuickNoteCard = forwardRef<QuickNoteCardHandle, QuickNoteCardProps>(
    function QuickNoteCard({ lead, latestNote, onNoteCreated }, ref) {
        const { t } = useTranslation();
        const { message } = App.useApp();
        const inputRef = useRef<HTMLTextAreaElement>(null);
        const [noteText, setNoteText] = useState("");

        useImperativeHandle(ref, () => ({
            focus: () => {
                inputRef.current?.focus();
                inputRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                });
            },
        }));

        const addNoteMutation = useApiMutate<
            SaveNoteFormData,
            LeadNote,
            ApiResponse<LeadNote>
        >(route("lead-notes.store"), "POST", (response) => {
            if (response?.status === "success") {
                message.success(
                    t("pages.leads.notes.created_success") || "Note saved",
                );
                setNoteText("");
                if (response.data) {
                    onNoteCreated?.(response.data);
                }
            }
        });

        const handleSave = () => {
            const trimmed = noteText.trim();
            if (!trimmed) return;

            addNoteMutation.mutate(
                {
                    title: trimmed.slice(0, 80),
                    details: `<p>${trimmed}</p>`,
                    lead_id: lead.id,
                },
                {
                    onError: (errorResponse) => {
                        const errors =
                            errorFormatter(errorResponse)?.errors || [];
                        message.error(
                            Object.values(errors).flat().join(", ") ||
                                "Failed to save note",
                        );
                    },
                },
            );
        };

        const previewText = latestNote?.details
            ? latestNote.details
                  .replace(/<[^>]*>/g, "")
                  .replace(/&nbsp;/g, " ")
                  .trim()
            : null;

        return (
            <div className="section-card">
                <header className="flex items-center gap-2 border-b border-[#eef1f5] px-4 py-3">
                    <LeadIcon name="file-text" size={15} color="#1a6bb5" />
                    <h3 className="text-sm font-semibold text-[#1a1f2e]">
                        Quick note
                    </h3>
                </header>
                <div className="flex flex-col gap-y-3 p-4">
                    <Input.TextArea
                        ref={inputRef as any}
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Log a quick note from your call..."
                        rows={3}
                        className="text-sm"
                    />
                    <div className="flex justify-end">
                        <DealButton
                            variant="primary"
                            onClick={handleSave}
                            disabled={
                                !noteText.trim() || addNoteMutation.isPending
                            }
                        >
                            Save note
                        </DealButton>
                    </div>
                    {previewText && (
                        <div className="rounded-md border border-[#edf1f5] bg-[#fbfcfd] p-3">
                            <p className="text-[10px] font-medium uppercase tracking-wide text-[#9ca3af]">
                                Latest note
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-[#4b5563]">
                                {previewText}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        );
    },
);

export default QuickNoteCard;
