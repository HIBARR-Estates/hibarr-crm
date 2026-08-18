<?php

namespace App\Enums;

enum MlmNotificationEvent: string
{
    case CommissionEarned = 'mlm_commission_earned';
    case CommissionPaid = 'mlm_commission_paid';
    case CommissionClawback = 'mlm_commission_clawback';
    case CommissionDisputed = 'mlm_commission_disputed';
    case AgentLevelUpgraded = 'mlm_agent_level_upgraded';
    case AgentLevelDowngraded = 'mlm_agent_level_downgraded';
    case AgentLevelCriteriaApproaching = 'mlm_agent_level_criteria_approaching';
    case AgentCommissionProfileChanged = 'mlm_agent_commission_profile_changed';
    case CycleStarted = 'mlm_cycle_started';
    case CycleCompleted = 'mlm_cycle_completed';
    case CycleCriteriaMet = 'mlm_cycle_criteria_met';
    case CycleDeadlineApproaching = 'mlm_cycle_deadline_approaching';
    case ReferralCodeUsed = 'mlm_referral_code_used';
    case NewRecruitAdded = 'mlm_new_recruit_added';
    case PartnerNetworkJoined = 'mlm_partner_network_joined';
    case ReferralConvertedToDeal = 'mlm_referral_converted_to_deal';

    public function emailSettingSlug(): string
    {
        return 'mlm-partner-network-notification';
    }

    public function icon(): string
    {
        return match ($this) {
            self::CommissionEarned, self::CommissionPaid => 'dollar-sign',
            self::CommissionClawback, self::CommissionDisputed => 'alert-triangle',
            self::AgentLevelUpgraded, self::AgentLevelDowngraded, self::AgentLevelCriteriaApproaching => 'trending-up',
            self::AgentCommissionProfileChanged => 'percent',
            self::CycleStarted, self::CycleCompleted, self::CycleCriteriaMet, self::CycleDeadlineApproaching => 'calendar',
            self::ReferralCodeUsed, self::ReferralConvertedToDeal => 'user-plus',
            self::NewRecruitAdded, self::PartnerNetworkJoined => 'users',
        };
    }

    public function langKey(): string
    {
        return 'email.mlm.'.$this->value;
    }
}
