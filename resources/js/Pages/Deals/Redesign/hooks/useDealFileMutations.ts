import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFile } from "@/Types/api/file";
import { useDealWorkspace } from "../context/DealWorkspaceContext";

/**
 * Rename / replace for a deal's loose file attachments — the two mutations
 * the Files tab runs against `deal-files.update`. Wraps the requests, patches
 * DealWorkspaceContext from the response, and exposes per-file in-flight
 * state, so the tab holds no axios/notification/state-patching logic of its
 * own (see the Deals/Redesign rules in CLAUDE.md).
 *
 * Both actions surface their own error toast and then RETHROW: the caller
 * (AttachmentFileCard) keeps its editor open and its draft intact when a
 * rename fails, which it can only do if the rejection reaches it.
 */
export default function useDealFileMutations() {
    const { t } = useTranslation();
    const { setFiles } = useDealWorkspace();
    const [renamingId, setRenamingId] = useState<number | null>(null);
    const [replacingId, setReplacingId] = useState<number | null>(null);

    const rename = useCallback(
        async (file: DealFile, label: string): Promise<void> => {
            setRenamingId(file.id);
            try {
                const res = await axios.put(
                    route("deal-files.update", file.id),
                    { description: label },
                    { headers: { Accept: "application/json" } },
                );

                if (!res.data?.data) {
                    message.error(
                        res.data?.message ||
                            t("pages.deals.workspace.files.messages.rename_failed"),
                    );
                    throw new Error("rename_failed");
                }

                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === file.id ? { ...f, description: label } : f,
                    ),
                );
                message.success(t("pages.deals.workspace.files.messages.renamed"));
            } catch (error: any) {
                if (error?.message !== "rename_failed") {
                    message.error(
                        error?.response?.data?.message ||
                            t("pages.deals.workspace.files.messages.rename_failed"),
                    );
                }
                throw error;
            } finally {
                setRenamingId(null);
            }
        },
        [setFiles, t],
    );

    const replace = useCallback(
        async (file: DealFile, newFile: File): Promise<void> => {
            setReplacingId(file.id);
            try {
                const formData = new FormData();
                // PHP doesn't parse multipart bodies on a real PUT — spoof it.
                formData.append("_method", "PUT");
                formData.append("file", newFile);

                const res = await axios.post(
                    route("deal-files.update", file.id),
                    formData,
                    { headers: { Accept: "application/json" } },
                );

                if (!res.data?.data) {
                    message.error(
                        res.data?.message ||
                            t("pages.deals.workspace.files.messages.replace_failed"),
                    );
                    throw new Error("replace_failed");
                }

                setFiles((prev) =>
                    prev.map((f) =>
                        f.id === file.id ? { ...f, ...res.data.data } : f,
                    ),
                );
                message.success(t("pages.deals.workspace.files.messages.replaced"));
            } catch (error: any) {
                if (error?.message !== "replace_failed") {
                    message.error(
                        error?.response?.data?.message ||
                            t("pages.deals.workspace.files.messages.replace_failed"),
                    );
                }
                throw error;
            } finally {
                setReplacingId(null);
            }
        },
        [setFiles, t],
    );

    return {
        rename,
        replace,
        isRenaming: (fileId: number) => renamingId === fileId,
        isReplacing: (fileId: number) => replacingId === fileId,
    };
}
