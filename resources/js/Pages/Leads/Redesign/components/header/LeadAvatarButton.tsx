import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/Components/Redesign";

interface LeadAvatarButtonProps {
    name: string;
    imageUrl?: string | null;
    initials: string;
}

/**
 * 42×42 avatar trigger — shows server image_url or initials.
 * Gravatar-only on server — preview does NOT persist (no upload endpoint).
 */
export default function LeadAvatarButton({
    name,
    imageUrl,
    initials,
}: LeadAvatarButtonProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);

    const displayUrl = previewUrl ?? imageUrl ?? null;

    const revokePreview = useCallback((url: string | null) => {
        if (url?.startsWith("blob:")) {
            URL.revokeObjectURL(url);
        }
    }, []);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !file.type.startsWith("image/")) return;

        const url = URL.createObjectURL(file);
        setPreviewUrl((prev) => {
            revokePreview(prev);
            return url;
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => inputRef.current?.click()}
                title={displayUrl ? "Change photo" : "Upload photo"}
                aria-label={
                    displayUrl ? `Change photo for ${name}` : `Upload photo for ${name}`
                }
                style={{
                    width: 42,
                    height: 42,
                    borderRadius: "50%",
                    background: "var(--lr-blue)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    color: "var(--lr-white)",
                    flexShrink: 0,
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    overflow: "hidden",
                    position: "relative",
                }}
            >
                {displayUrl ? (
                    <img
                        src={displayUrl}
                        alt=""
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                        }}
                    />
                ) : (
                    initials
                )}
            </button>
            <input
                ref={inputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleFileChange}
            />
        </>
    );
}
