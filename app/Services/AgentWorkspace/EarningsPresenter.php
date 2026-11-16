<?php

namespace App\Services\AgentWorkspace;

use App\Enums\MlmCommissionStatus;
use App\Enums\MlmCommissionType;
use App\Models\LeadAgent;
use App\Models\MlmCommission;
use App\Models\MlmCommissionDispute;
use Illuminate\Support\Collection;

/**
 * Shapes the agent's commissions and network the way the Earnings screens read
 * them. The numbers are the MLM module's own (commissions, disputes, levels,
 * cycles, the agent hierarchy); nothing here is computed from anything else.
 */
class EarningsPresenter
{
    /** Relations a commission row needs, so a list loads them in one go. */
    public static function commissionRelations(): array
    {
        return [
            'deal:id,name,lead_id',
            'deal.contact:id,client_name',
            'package:id,name',
            'sourceAgent.user:id,name',
        ];
    }

    /**
     * One commission line. $disputes is the latest dispute per commission id.
     *
     * A partner-only account never sees a client's name, only the deal's.
     *
     * @param  Collection<int, MlmCommissionDispute>  $disputes
     */
    public static function commission(MlmCommission $commission, Collection $disputes, bool $partnerOnly): array
    {
        $dispute = $disputes->get($commission->id);
        $open = $dispute?->status === MlmCommissionDispute::STATUS_OPEN;
        $status = $commission->status instanceof MlmCommissionStatus ? $commission->status->value : (string) $commission->status;
        $type = $commission->type instanceof MlmCommissionType ? $commission->type->value : (string) $commission->type;
        $own = $type === MlmCommissionType::Agent->value;

        return [
            'id' => $commission->id,
            'status' => $status,
            'disputed' => $open,
            'own' => $own,
            'amount' => (float) $commission->amount,
            'created_at' => $commission->created_at?->toIso8601String(),
            'deal_id' => $commission->deal_id,
            'deal_name' => $commission->deal?->name,
            'lead_id' => $commission->deal?->lead_id,
            'person' => $partnerOnly ? null : $commission->deal?->contact?->client_name,
            'package' => $commission->package?->name,
            'from_agent' => $own ? null : $commission->sourceAgent?->user?->name,
            'dispute' => $dispute ? self::dispute($dispute) : null,
            // The board offers a dispute on the agent's own pending lines only.
            'can_dispute' => $own && $status === MlmCommissionStatus::Pending->value && ! $open,
        ];
    }

    public static function dispute(MlmCommissionDispute $dispute): array
    {
        return [
            'id' => $dispute->id,
            'status' => $dispute->status,
            'reason' => $dispute->reason,
            'message' => $dispute->message,
            'created_at' => $dispute->created_at?->toIso8601String(),
            'resolved_at' => $dispute->resolved_at?->toIso8601String(),
            'resolution_note' => $dispute->resolution_note,
        ];
    }

    /**
     * The newest dispute for each of the given commissions.
     *
     * @param  Collection<int, MlmCommission>  $commissions
     * @return Collection<int, MlmCommissionDispute>
     */
    public static function latestDisputes(Collection $commissions): Collection
    {
        if ($commissions->isEmpty()) {
            return collect();
        }

        return MlmCommissionDispute::query()
            ->whereIn('commission_id', $commissions->pluck('id'))
            ->orderBy('id')
            ->get()
            ->keyBy('commission_id');
    }

    /** The company currency symbol, as the Deals screens read it. */
    public static function currencySymbol(): string
    {
        $company = company();

        return (is_object($company) ? $company->currency?->currency_symbol : null) ?? '€';
    }

    /** The agent's own LeadAgent row, or null for someone who is not an agent. */
    public static function agentFor($user): ?LeadAgent
    {
        return LeadAgent::query()
            ->where('user_id', $user->id)
            ->where('company_id', $user->company_id)
            ->first();
    }
}
