import { useTd } from "@/Hooks/useDynamicTranslation";
import { Button, EmptyState } from "@/Components/Redesign";

/**
 * PENDING: real lead-file support — files are deal-scoped in Worksuite today.
 * This tab mirrors the mockup shell (toolbar + dropzone + card list) until
 * a lead-level upload endpoint exists.
 */
export default function FilesTab() {
    const { td } = useTd();

    return (
        <div>
            <div className="mb-4 flex items-center justify-between gap-2">
                <span className="text-xs text-[#6b7280]">
                    {td("Files are deal-scoped — upload from a linked deal.")}
                </span>
                <Button variant="ghost" disabled>
                    {td("Upload")}
                </Button>
            </div>

            <div className="v2-dropzone mb-4 opacity-60" aria-disabled="true">
                <p className="text-sm font-medium text-[#1a1f2e]">
                    {td("Drop files here")}
                </p>
                <p className="mt-1 text-xs text-[#6b7280]">
                    {td("Not available for leads yet")}
                </p>
            </div>

            <EmptyState
                title={td("No files")}
                description={td(
                    "When lead-level files are supported, they will appear here.",
                )}
            />
        </div>
    );
}
