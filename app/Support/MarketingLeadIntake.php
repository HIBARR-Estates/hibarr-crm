<?php

namespace App\Support;

use App\Models\LeadAgent;
use App\Models\LeadOrigin;
use App\Models\LeadSetting;
use App\Models\User;
use Illuminate\Support\Facades\DB;

/**
 * Who may use the marketing lead flow, which origin it stamps, and which
 * lead owner it suggests.
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

    /**
     * People who can own a lead: active users with an enabled lead agent
     * record (the lead page's owner picker lists the same people), by name.
     *
     * @return array<int, array{id: int, name: string}>
     */
    public static function ownerOptions(?int $companyId = null): array
    {
        $companyId ??= (int) company()->id;

        return LeadAgent::withoutGlobalScopes()
            ->join('users', 'users.id', '=', 'lead_agents.user_id')
            ->where('lead_agents.company_id', $companyId)
            ->where('lead_agents.status', 'enabled')
            ->where('users.status', 'active')
            ->orderBy('users.name')
            ->get(['users.id', 'users.name'])
            ->unique('id')
            ->map(fn ($row) => ['id' => (int) $row->id, 'name' => (string) $row->name])
            ->values()
            ->all();
    }

    /** The configured default owner (a user id) while they can still own leads, else null. */
    public static function ownerId(?int $companyId = null): ?int
    {
        $companyId ??= (int) company()->id;

        $configured = LeadSetting::withoutGlobalScopes()
            ->where('company_id', $companyId)
            ->value('marketing_intake_owner_id');

        if ($configured === null) {
            return null;
        }

        return self::canOwn((int) $configured, $companyId) ? (int) $configured : null;
    }

    public static function canOwn(int $userId, ?int $companyId = null): bool
    {
        $companyId ??= (int) company()->id;

        return LeadAgent::withoutGlobalScopes()
            ->join('users', 'users.id', '=', 'lead_agents.user_id')
            ->where('lead_agents.company_id', $companyId)
            ->where('lead_agents.status', 'enabled')
            ->where('users.status', 'active')
            ->where('users.id', $userId)
            ->exists();
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
     * Persist the access departments, stamped origin and default owner for a company.
     *
     * @param  array<int, int>  $departmentIds
     */
    public static function save(int $companyId, int $userId, array $departmentIds, ?int $originId, ?int $ownerId = null): void
    {
        $row = LeadSetting::withoutGlobalScopes()->where('company_id', $companyId)->first();

        if (! $row) {
            $row = new LeadSetting;
            $row->company_id = $companyId;
            $row->user_id = $userId;
        }

        $row->marketing_intake_department_ids = json_encode(array_values(array_unique(array_map('intval', $departmentIds))));
        $row->marketing_intake_origin_id = $originId;
        $row->marketing_intake_owner_id = $ownerId;
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
