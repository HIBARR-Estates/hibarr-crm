import { useCallback, useState } from "react";
import axios from "axios";
import { message } from "antd";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useLeadWorkspace } from "../context/LeadWorkspaceContext";

/**
 * Persist a lead avatar upload and patch LeadWorkspaceContext — no page reload.
 */
export default function useLeadImageUpload() {
    const { lead, setLead } = useLeadWorkspace();
    const { td } = useTd();
    const [uploading, setUploading] = useState(false);

    const uploadImage = useCallback(
        async (file: File): Promise<string | null> => {
            if (!file.type.startsWith("image/")) {
                message.error(td("Please choose an image file"));
                return null;
            }

            setUploading(true);
            try {
                const body = new FormData();
                body.append("image", file);

                const response = await axios.post(
                    route("lead-contact.upload-image", {
                        lead_contact: lead.id,
                    }),
                    body,
                    {
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "multipart/form-data",
                        },
                    },
                );

                const updated = response.data?.data?.lead as
                    | { image?: string | null; image_url?: string }
                    | undefined;

                if (response.data?.status !== "success" || !updated?.image_url) {
                    throw new Error(
                        response.data?.message || "Failed to update photo",
                    );
                }

                setLead((prev) => ({
                    ...prev,
                    image: updated.image ?? prev.image,
                    image_url: updated.image_url,
                }));

                message.success(td("Lead photo updated"));
                return updated.image_url;
            } catch (error: unknown) {
                const detail =
                    (error as { response?: { data?: { message?: string } } })
                        ?.response?.data?.message ||
                    (error as Error)?.message ||
                    td("Failed to update lead photo");
                message.error(detail);
                return null;
            } finally {
                setUploading(false);
            }
        },
        [lead.id, setLead, td],
    );

    return { uploadImage, uploading };
}
