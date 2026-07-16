import { LockOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import { useState } from "react";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import useTranslation from "@/Hooks/useTranslation";
import type { Deal } from "@/Types/api/deals";
import DealAddTaskModal from "../workspace/DealAddTaskModal";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealInfoToolbarProps {
    deal: Deal;
    canDelete: boolean;
    isLocked: boolean;
}

export default function DealInfoToolbar({
    deal,
    canDelete,
    isLocked,
}: DealInfoToolbarProps) {
    const { t } = useTranslation();
    const [taskModalOpen, setTaskModalOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    return (
        <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <DealButton
                    variant="ghost"
                    icon={<DealIcon name="check-square" size={12} />}
                    onClick={() => setTaskModalOpen(true)}
                >
                    {t("pages.deals.actions.add_task")}
                </DealButton>
                {canDelete && (
                    <DealButton
                        variant="ghost"
                        icon={<DealIcon name="trash" size={12} />}
                        onClick={() => setDeleteOpen(true)}
                        style={{ color: T.RED, borderColor: T.RED_MID }}
                    >
                        {t("pages.deals.info.actions.delete")}
                    </DealButton>
                )}
                {isLocked && (
                    <span className="dr-pill dr-pill-amber">
                        <LockOutlined />
                        {t("pages.deals.info.locked")}
                    </span>
                )}
            </div>

            <DealAddTaskModal
                open={taskModalOpen}
                onClose={() => setTaskModalOpen(false)}
                dealId={deal.id}
            />

            <DeleteDeal
                open={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                deal={deal}
                handleSuccessCallback={() => router.visit(route("deals.index"))}
            />
        </>
    );
}
