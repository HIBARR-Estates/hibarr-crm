import DealButton from "../primitives/DealButton";

interface DealInfoSectionShellProps {
    title: string;
    subtitle: string;
}

export default function DealInfoSectionShell({ title, subtitle }: DealInfoSectionShellProps) {
    return (
        <section className="rounded-[12px] border border-[#e2e5ea] bg-white p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-medium text-[#0f172a]">{title}</h3>
                    <p className="mt-1 text-xs text-[#6b7280]">{subtitle}</p>
                </div>
                <DealButton
                    variant="ghost"
                    disabled
                    style={{ fontSize: 11, padding: "5px 10px", opacity: 0.7, cursor: "not-allowed" }}
                    title="Field editing is out of scope in this phase"
                >
                    Edit fields
                </DealButton>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-[8px] border border-dashed border-[#d5dae4] bg-[#fafbfc] p-4">
                {Array.from({ length: 8 }).map((_, idx) => (
                    <div key={idx} className="h-12 rounded-[6px] border border-[#e8ebf1] bg-white/80" />
                ))}
            </div>

            <p className="mt-3 text-xs text-[#8b95a7]">Field mapping coming soon.</p>
        </section>
    );
}
