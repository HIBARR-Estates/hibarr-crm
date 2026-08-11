import { useRef, type ChangeEvent } from "react";
import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useLeadImageUpload from "../../hooks/useLeadImageUpload";

interface LeadAvatarButtonProps {
    name: string;
    /** Custom uploaded image filename — when set, show image_url. */
    image?: string | null;
    imageUrl?: string | null;
    initials: string;
    /** Requires edit_lead access for this lead (same as uploadImage). */
    canUpload?: boolean;
}

/**
 * Header avatar with optional camera upload. Upload controls only render when
 * canUpload is true; otherwise the avatar is display-only.
 */
export default function LeadAvatarButton({
    name,
    image,
    imageUrl,
    initials,
    canUpload = false,
}: LeadAvatarButtonProps) {
    const { td } = useTd();
    const inputRef = useRef<HTMLInputElement>(null);
    const { uploadImage, uploading } = useLeadImageUpload();

    const hasCustomImage = Boolean(image && imageUrl);
    const displayUrl = hasCustomImage ? imageUrl : null;
    const label = displayUrl
        ? td("Change photo", { source: "en" })
        : td("Upload photo", { source: "en" });

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !canUpload) return;
        void uploadImage(file);
    };

    const openPicker = () => {
        if (!canUpload || uploading) return;
        inputRef.current?.click();
    };

    return (
        <div className="v2-lead-avatar-wrap">
            {canUpload ? (
                <button
                    type="button"
                    className={`v2-lead-avatar${uploading ? " is-uploading" : ""}`}
                    onClick={openPicker}
                    disabled={uploading}
                    title={label}
                    aria-label={`${label} ${name}`.trim()}
                >
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt=""
                            className="v2-lead-avatar__img"
                        />
                    ) : (
                        <span className="v2-lead-avatar__initials">
                            {initials}
                        </span>
                    )}
                    <span className="v2-lead-avatar__badge" aria-hidden="true">
                        {uploading ? (
                            <span className="v2-lead-avatar__spinner" />
                        ) : (
                            <Icon name="camera" size={12} />
                        )}
                    </span>
                </button>
            ) : (
                <div
                    className="v2-lead-avatar is-readonly"
                    aria-label={name}
                    title={name}
                >
                    {displayUrl ? (
                        <img
                            src={displayUrl}
                            alt=""
                            className="v2-lead-avatar__img"
                        />
                    ) : (
                        <span className="v2-lead-avatar__initials">
                            {initials}
                        </span>
                    )}
                </div>
            )}
            {canUpload ? (
                <>
                    <button
                        type="button"
                        className="v2-lead-avatar__action"
                        onClick={openPicker}
                        disabled={uploading}
                    >
                        {uploading ? td("Uploading…", { source: "en" }) : label}
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp"
                        hidden
                        onChange={handleFileChange}
                    />
                </>
            ) : null}
        </div>
    );
}
