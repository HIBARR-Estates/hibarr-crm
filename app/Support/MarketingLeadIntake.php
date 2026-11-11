<?php

namespace App\Support;

use App\Models\LeadOrigin;
use App\Models\LeadSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Who may use the marketing lead flow, and which origin it stamps.
 *
 * Access is department based: an admin picks departments in Lead settings,
 * and anyone whose department (employee_details.department_id) or extra team
 * membership (employee_teams) is one of them gets the flow. No departments
 * picked means nobody has it. Partner-only accounts never do.
 *
 * Answers are kept on the request so the shared Inertia prop, the page and
 * the store endpoint cost one lookup between them.
 */
final class MarketingLeadIntake
{
    private const REQUEST_KEY = 'marketing_lead_intake.allows';

    /**
     * @return array<int, int>
     */
    public static function departmentIds(?int $companyId = null): array
    {
        $companyId ??= company()?->id;
        if ($companyId === null) {
            return [];
        }

        $raw = LeadSetting::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->value('marketing_intake_department_ids');

        $ids = is_string($raw) ? json_decode($raw, true) : $raw;

        return is_array($ids)
            ? array_values(array_unique(array_map('intval', array_filter($ids, 'is_numeric'))))
            : [];
    }

    /** The origin the flow stamps: the configured one, else "Marketing". */
    public static function originId(?int $companyId = null): int
    {
        $companyId ??= (int) company()->id;

        $configured = LeadSetting::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->value('marketing_intake_origin_id');

        if ($configured !== null) {
            $exists = LeadOrigin::withoutGlobalScopes()
                ->where('company_id', $companyId)
                ->whereKey((int) $configured)
                ->exists();

            if ($exists) {
                return (int) $configured;
            }
        }

        return (int) LeadOrigin::marketingFor($companyId)->id;
    }

    public static function allows(?User $user): bool
    {
        if ($user === null || $user->company_id === null) {
            return false;
        }

        $request = app()->bound('request') ? request() : null;
        $cached = $request?->attributes->get(self::REQUEST_KEY);
        if (is_array($cached) && array_key_exists($user->id, $cached)) {
            return $cached[$user->id];
        }

        $allowed = self::resolve($user);

        $answers = is_array($cached) ? $cached : [];
        $answers[$user->id] = $allowed;
        $request?->attributes->set(self::REQUEST_KEY, $answers);

        return $allowed;
    }

    /**
     * Persist the access departments and stamped origin for a company.
     *
     * @param  array<int, int>  $departmentIds
     */
    public static function save(int $companyId, int $userId, array $departmentIds, ?int $originId): void
    {
        $row = LeadSetting::withoutGlobalScopes()->where('company_id', $companyId)->first();

        if (! $row) {
            $row = new LeadSetting;
            $row->company_id = $companyId;
            $row->user_id = $userId;
        }

        $row->marketing_intake_department_ids = json_encode(array_values(array_unique(array_map('intval', $departmentIds))));
        $row->marketing_intake_origin_id = $originId;
        $row->save();
    }

    private static function resolve(User $user): bool
    {
        // Settings first: with no departments picked nobody has the flow, and
        // that answer costs one query.
        $departmentIds = self::departmentIds((int) $user->company_id);
        if ($departmentIds === []) {
            return false;
        }

        if (PartnerRole::isPartnerOnly($user)) {
            return false;
        }

        $inDepartment = DB::table('employee_details')
            ->where('user_id', $user->id)
            ->whereIn('department_id', $departmentIds)
            ->exists();

        if ($inDepartment) {
            return true;
        }

        return DB::table('employee_teams')
            ->where('user_id', $user->id)
            ->whereIn('team_id', $departmentIds)
            ->exists();
    }
}
