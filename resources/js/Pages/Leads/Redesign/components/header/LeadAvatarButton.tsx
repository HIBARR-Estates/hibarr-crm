import { useId, useRef, useState, type ChangeEvent } from "react";
import { Icon } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import LeadV2Modal, {
    LeadV2ModalFooter,
    LeadV2ModalHeader,
} from "../qualification/LeadV2Modal";
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
 * Header avatar with optional camera upload. Clicking the avatar opens a photo
 * preview; upload only runs from the camera badge, action link, or modal CTA.
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
    const [previewOpen, setPreviewOpen] = useState(false);
    const previewTitleId = useId();

    const hasCustomImage = Boolean(image && imageUrl);
    const displayUrl = hasCustomImage ? imageUrl : null;
    const label = displayUrl
        ? td("Change photo", { source: "en" })
        : td("Upload photo", { source: "en" });
    const viewLabel = td("View photo", { source: "en" });
    const previewTitle = td("Lead photo", { source: "en" });

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

    const openPreview = () => {
        if (uploading) return;
        setPreviewOpen(true);
    };

    const avatarClassName = [
        "v2-lead-avatar",
        uploading ? "is-uploading" : "",
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <div className="v2-lead-avatar-wrap">
            <div className="v2-lead-avatar-shell">
                <button
                    type="button"
                    className={avatarClassName}
                    onClick={openPreview}
                    disabled={uploading}
                    title={viewLabel}
                    aria-label={`${viewLabel} ${name}`.trim()}
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
                </button>

                {canUpload ? (
                    <button
                        type="button"
                        className="v2-lead-avatar__badge"
                        onClick={openPicker}
                        disabled={uploading}
                        title={label}
                        aria-label={label}
                    >
                        {uploading ? (
                            <span className="v2-lead-avatar__spinner" />
                        ) : (
                            <Icon name="camera" size={12} />
                        )}
                    </button>
                ) : null}
            </div>

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

            <LeadV2Modal
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                labelledBy={previewTitleId}
                maxWidth={440}
            >
                <LeadV2ModalHeader
                    title={previewTitle}
                    titleId={previewTitleId}
                    onClose={() => setPreviewOpen(false)}
                />
                <div className="v2-modal-body">
                    <div className="v2-lead-avatar-preview">
                        {displayUrl ? (
                            <img
                                src={displayUrl}
                                alt={name}
                                className="v2-lead-avatar-preview__img"
                            />
                        ) : (
                            <div
                                className="v2-lead-avatar-preview__placeholder"
                                aria-hidden="true"
                            >
                                <span>{initials}</span>
                            </div>
                        )}
                    </div>
                </div>
                {canUpload ? (
                    <LeadV2ModalFooter>
                        <button
                            type="button"
                            className="v2-btn v2-btn-primary"
                            onClick={openPicker}
                            disabled={uploading}
                        >
                            {uploading
                                ? td("Uploading…", { source: "en" })
                                : label}
                        </button>
                    </LeadV2ModalFooter>
                ) : null}
            </LeadV2Modal>
        </div>
    );
}
