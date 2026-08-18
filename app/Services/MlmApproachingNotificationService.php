<?php

namespace App\Services;

use App\Enums\EnrollmentStatus;
use App\Models\AgentCycleEnrollment;
use App\Models\Company;
use App\Models\LeadAgent;
use App\Models\MlmLevel;
use App\Models\MlmSetting;
use Illuminate\Support\Facades\Cache;

class MlmApproachingNotificationService
{
    public const LEVEL_PROGRESS_THRESHOLD = 80;

    public const CYCLE_DEADLINE_DAYS = 7;

    public function __construct(
        protected CycleService $cycleService,
        protected LevelService $levelService,
        protected MlmNotificationService $notifications,
    ) {
    }

    public function processCompany(int $companyId, string $today): array
    {
        $stats = ['level_approaching' => 0, 'cycle_deadline' => 0];

        if (! MlmSetting::query()->where('company_id', $companyId)->exists()) {
            return $stats;
        }

        $stats['level_approaching'] = $this->sendLevelApproachingForCompany($companyId, $today);
        $stats['cycle_deadline'] = $this->sendCycleDeadlineForCompany($companyId, $today);

        return $stats;
    }

    protected function sendLevelApproachingForCompany(int $companyId, string $today): int
    {
        $sent = 0;

        LeadAgent::query()
            ->where('company_id', $companyId)
            ->where('status', 'enabled')
            ->whereHas('user', fn ($q) => $q->where('users.status', 'active'))
            ->with(['user', 'currentLevelHistory.level'])
            ->chunkById(100, function ($agents) use ($companyId, $today, &$sent) {
                foreach ($agents as $agent) {
                    $currentLevel = $this->levelService->getCurrentLevel($agent);
                    $currentRank = $currentLevel?->rank ?? -1;
                    $nextLevel = $this->levelService->getNextVisibleLevel($companyId, $currentRank);

                    if (! $nextLevel) {
                        continue;
                    }

                    $metrics = $this->cycleService->getOrCreateCycleMetrics($agent)
                        ?? $agent->metrics;

                    if (! $metrics) {
                        continue;
                    }

                    if ($this->levelService->evaluateCriteria($metrics, $nextLevel->criteria)) {
                        continue;
                    }

                    $progress = $this->progressTowardLevel($metrics, $nextLevel);

                    if ($progress < self::LEVEL_PROGRESS_THRESHOLD) {
                        continue;
                    }

                    $cacheKey = "mlm_level_approaching:{$agent->id}:{$nextLevel->id}:{$today}";

                    if (Cache::has($cacheKey)) {
                        continue;
                    }

                    $this->notifications->notifyLevelCriteriaApproaching($agent, $nextLevel, $progress);
                    Cache::put($cacheKey, true, now()->addDay());
                    $sent++;
                }
            });

        return $sent;
    }

    protected function sendCycleDeadlineForCompany(int $companyId, string $today): int
    {
        $sent = 0;
        $todayDate = now()->parse($today)->startOfDay();

        AgentCycleEnrollment::query()
            ->where('company_id', $companyId)
            ->whereIn('status', [EnrollmentStatus::Active, EnrollmentStatus::Extended])
            ->with(['agent.user', 'cycle'])
            ->chunkById(100, function ($enrollments) use ($todayDate, $today, &$sent) {
                foreach ($enrollments as $enrollment) {
                    if (! $enrollment->agent || ! $enrollment->cycle) {
                        continue;
                    }

                    if ($enrollment->criteria_met_at) {
                        continue;
                    }

                    $deadline = $enrollment->status === EnrollmentStatus::Extended
                        ? $enrollment->max_overflow_date
                        : $enrollment->effective_end_date;

                    if (! $deadline) {
                        continue;
                    }

                    $daysRemaining = $todayDate->diffInDays($deadline->copy()->startOfDay(), false);

                    if ($daysRemaining < 0 || $daysRemaining > self::CYCLE_DEADLINE_DAYS) {
                        continue;
                    }

                    $currentLevel = $this->levelService->getCurrentLevel($enrollment->agent);

                    if ($currentLevel) {
                        $metrics = $this->cycleService->getOrCreateCycleMetrics($enrollment->agent);

                        if ($metrics && $this->levelService->evaluateCriteria($metrics, $currentLevel->criteria)) {
                            continue;
                        }
                    }

                    $cacheKey = "mlm_cycle_deadline:{$enrollment->id}:{$today}";

                    if (Cache::has($cacheKey)) {
                        continue;
                    }

                    $this->notifications->notifyCycleDeadlineApproaching(
                        $enrollment->agent,
                        $enrollment,
                        (int) $daysRemaining,
                    );
                    Cache::put($cacheKey, true, now()->addDay());
                    $sent++;
                }
            });

        return $sent;
    }

    protected function progressTowardLevel(object $metrics, MlmLevel $level): int
    {
        $level->loadMissing('criteria');

        if ($level->criteria->isEmpty()) {
            return 0;
        }

        $groups = $level->criteria->groupBy('logic_group');
        $groupProgress = [];

        foreach ($groups as $groupCriteria) {
            $best = 0;

            foreach ($groupCriteria as $criterion) {
                $threshold = (float) $criterion->threshold;

                if ($threshold <= 0) {
                    continue;
                }

                $value = $criterion->metric->resolveValue($metrics);
                $best = max($best, (int) min(100, round(($value / $threshold) * 100)));
            }

            $groupProgress[] = $best;
        }

        return $groupProgress === [] ? 0 : (int) min($groupProgress);
    }
}
