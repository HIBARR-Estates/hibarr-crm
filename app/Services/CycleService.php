<?php

namespace App\Services;

use App\Enums\CycleStatus;
use App\Enums\EnrollmentStatus;
use App\Models\AgentCycleEnrollment;
use App\Models\AgentCycleMetric;
use App\Models\Company;
use App\Models\LeadAgent;
use App\Models\MlmCycle;
use App\Models\MlmCycleConfig;
use App\Models\MlmLevel;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CycleService
{
    /**
     * Get or create the currently active cycle for a company.
     * If no active cycle exists but auto_generate is enabled, generates one.
     */
    public function getOrCreateCurrentCycle(int $companyId): ?MlmCycle
    {
        // First try to find an already-active cycle
        $activeCycle = MlmCycle::where('company_id', $companyId)
            ->active()
            ->first();

        if ($activeCycle) {
            return $activeCycle;
        }

        // Check if there's an upcoming cycle that should now be active
        $today = now()->startOfDay();
        $upcomingNowActive = MlmCycle::where('company_id', $companyId)
            ->upcoming()
            ->where('start_date', '<=', $today)
            ->where('end_date', '>=', $today)
            ->first();

        if ($upcomingNowActive) {
            $upcomingNowActive->update(['status' => CycleStatus::Active]);
            return $upcomingNowActive;
        }

        // Auto-generate if config allows
        $config = MlmCycleConfig::where('company_id', $companyId)->first();

        if (!$config || !$config->auto_generate) {
            return null;
        }

        return $this->generateNextCycle($config);
    }

    /**
     * Generate the next cycle based on the config.
     * Starts from the last cycle's end date + 1 day, or from the anchor_date if no cycles exist.
     */
    public function generateNextCycle(MlmCycleConfig $config): MlmCycle
    {
        $lastCycle = MlmCycle::where('cycle_config_id', $config->id)
            ->orderByDesc('cycle_number')
            ->first();

        if ($lastCycle) {
            $startDate = $lastCycle->end_date->copy()->addDay();
            $nextNumber = $lastCycle->cycle_number + 1;
        } else {
            $startDate = $config->anchor_date->copy();
            $nextNumber = 1;
        }

        $endDate = $config->calculateEndDate($startDate);
        $today = now()->startOfDay();

        // Determine initial status based on dates
        $status = CycleStatus::Upcoming;
        if ($today->between($startDate, $endDate)) {
            $status = CycleStatus::Active;
        } elseif ($today->gt($endDate)) {
            $status = CycleStatus::Completed;
        }

        $cycle = MlmCycle::create([
            'company_id' => $config->company_id,
            'cycle_config_id' => $config->id,
            'cycle_number' => $nextNumber,
            'start_date' => $startDate,
            'end_date' => $endDate,
            'status' => $status,
        ]);

        Log::info("CycleService: Generated cycle #{$nextNumber} for company {$config->company_id} ({$startDate->format('Y-m-d')} to {$endDate->format('Y-m-d')})");

        return $cycle;
    }

    /**
     * Enroll an agent into a cycle.
     *
     * @param LeadAgent $agent
     * @param MlmCycle $cycle
     * @param Carbon|null $effectiveStart - Override start date (for mid-cycle joiners). Defaults to cycle start_date.
     * @return AgentCycleEnrollment
     */
    public function enrollAgent(LeadAgent $agent, MlmCycle $cycle, ?Carbon $effectiveStart = null): AgentCycleEnrollment
    {
        $startDate = $effectiveStart ?? $cycle->start_date;

        // Calculate effective end date
        // For mid-cycle joiners: their cycle runs for the same duration as the full cycle
        // regardless of when they join
        $isMidCycleJoiner = $startDate->gt($cycle->start_date);

        if ($isMidCycleJoiner) {
            // Mid-cycle joiner gets the same duration as the cycle from their start date
            $config = $cycle->config;
            $effectiveEndDate = $config->calculateEndDate($startDate);
        } else {
            // Aligned with cycle
            $effectiveEndDate = $cycle->end_date;
        }

        // Calculate max overflow date
        $config = $cycle->config;
        $overflowDays = $config->max_overflow_days;

        $enrollment = AgentCycleEnrollment::create([
            'company_id' => $agent->company_id,
            'agent_id' => $agent->id,
            'cycle_id' => $cycle->id,
            'effective_start_date' => $startDate,
            'effective_end_date' => $effectiveEndDate,
            'status' => EnrollmentStatus::Active,
            'max_overflow_date' => $effectiveEndDate->copy()->addDays($overflowDays),
        ]);

        // Create the metrics row
        AgentCycleMetric::create([
            'company_id' => $agent->company_id,
            'enrollment_id' => $enrollment->id,
            'agent_id' => $agent->id,
            'nsa' => 0,
            'nsd' => 0,
            'vsa' => 0,
            'vsd' => 0,
        ]);

        Log::info("CycleService: Enrolled agent {$agent->id} in cycle #{$cycle->cycle_number} (start: {$startDate->format('Y-m-d')}, end: {$effectiveEndDate->format('Y-m-d')}, max_overflow: {$enrollment->max_overflow_date->format('Y-m-d')})");

        return $enrollment;
    }

    /**
     * Get the active enrollment for an agent (the one currently receiving metrics).
     * Returns null if the agent has no active or extended enrollment.
     */
    public function getActiveEnrollment(LeadAgent $agent): ?AgentCycleEnrollment
    {
        return AgentCycleEnrollment::where('agent_id', $agent->id)
            ->receiving()
            ->with('metrics')
            ->latest('effective_start_date')
            ->first();
    }

    /**
     * Complete an enrollment when criteria are met.
     * Optionally records the level achieved and auto-enrolls in the current company cycle.
     */
    public function completeEnrollment(AgentCycleEnrollment $enrollment, ?MlmLevel $levelAchieved = null): ?AgentCycleEnrollment
    {
        $enrollment->update([
            'status' => EnrollmentStatus::Completed,
            'criteria_met_at' => now(),
            'effective_end_date' => now()->startOfDay(),
            'level_achieved_id' => $levelAchieved?->id,
        ]);

        Log::info("CycleService: Completed enrollment {$enrollment->id} for agent {$enrollment->agent_id}" .
            ($levelAchieved ? " (level: {$levelAchieved->name})" : ''));

        // Auto-enroll in the current company cycle
        return $this->autoEnrollInCurrentCycle($enrollment->agent);
    }

    /**
     * Force-complete an enrollment when max overflow is reached without meeting criteria.
     * Agent is moved to the current cycle with metrics reset to zero.
     */
    public function forceCompleteEnrollment(AgentCycleEnrollment $enrollment): ?AgentCycleEnrollment
    {
        $enrollment->update([
            'status' => EnrollmentStatus::ForceCompleted,
            'effective_end_date' => now()->startOfDay(),
        ]);

        Log::info("CycleService: Force-completed enrollment {$enrollment->id} for agent {$enrollment->agent_id} (max overflow reached)");

        // Auto-enroll in the current company cycle
        return $this->autoEnrollInCurrentCycle($enrollment->agent);
    }

    /**
     * Auto-enroll an agent in the currently active company cycle.
     * Called after an enrollment is completed or force-completed.
     */
    protected function autoEnrollInCurrentCycle(LeadAgent $agent): ?AgentCycleEnrollment
    {
        $currentCycle = $this->getOrCreateCurrentCycle($agent->company_id);

        if (!$currentCycle) {
            Log::warning("CycleService: No active cycle found for company {$agent->company_id}. Cannot auto-enroll agent {$agent->id}.");
            return null;
        }

        // Check if already enrolled in this cycle
        $existingEnrollment = AgentCycleEnrollment::where('agent_id', $agent->id)
            ->where('cycle_id', $currentCycle->id)
            ->first();

        if ($existingEnrollment) {
            Log::info("CycleService: Agent {$agent->id} already enrolled in cycle #{$currentCycle->cycle_number}");
            return $existingEnrollment;
        }

        // Enroll with today as the effective start (mid-cycle join)
        return $this->enrollAgent($agent, $currentCycle, now()->startOfDay());
    }

    /**
     * Transition cycle statuses based on dates (run by scheduler).
     *
     * - upcoming → active (when start_date is today or past)
     * - active → completed (when end_date is past)
     * - active enrollments → extended (when cycle ends but criteria not met)
     * - extended enrollments past max_overflow_date → force_completed
     */
    public function transitionCycleStatuses(int $companyId): array
    {
        $today = now()->startOfDay();
        $stats = ['cycles_activated' => 0, 'cycles_completed' => 0, 'enrollments_extended' => 0, 'enrollments_force_completed' => 0, 'enrollments_auto_enrolled' => 0];

        // 1. Activate upcoming cycles where start_date <= today
        $activatedCount = MlmCycle::where('company_id', $companyId)
            ->where('status', CycleStatus::Upcoming)
            ->where('start_date', '<=', $today)
            ->update(['status' => CycleStatus::Active]);

        $stats['cycles_activated'] = $activatedCount;

        // 2. Complete active cycles where end_date < today
        $completedCycleIds = MlmCycle::where('company_id', $companyId)
            ->where('status', CycleStatus::Active)
            ->where('end_date', '<', $today)
            ->pluck('id');

        if ($completedCycleIds->isNotEmpty()) {
            MlmCycle::whereIn('id', $completedCycleIds)
                ->update(['status' => CycleStatus::Completed]);

            $stats['cycles_completed'] = $completedCycleIds->count();

            // 3. Move active enrollments in completed cycles to extended
            $extendedCount = AgentCycleEnrollment::whereIn('cycle_id', $completedCycleIds)
                ->where('status', EnrollmentStatus::Active)
                ->update([
                    'status' => EnrollmentStatus::Extended,
                    'overflow_start_date' => $today,
                ]);

            $stats['enrollments_extended'] = $extendedCount;
        }

        // 4. Force-complete extended enrollments past max_overflow_date
        $expiredEnrollments = AgentCycleEnrollment::where('company_id', $companyId)
            ->where('status', EnrollmentStatus::Extended)
            ->where('max_overflow_date', '<', $today)
            ->get();

        foreach ($expiredEnrollments as $enrollment) {
            $newEnrollment = $this->forceCompleteEnrollment($enrollment);
            $stats['enrollments_force_completed']++;
            if ($newEnrollment) {
                $stats['enrollments_auto_enrolled']++;
            }
        }

        // 5. Auto-generate next cycle if needed
        $config = MlmCycleConfig::where('company_id', $companyId)->first();
        if ($config && $config->auto_generate) {
            $latestCycle = MlmCycle::where('company_id', $companyId)
                ->orderByDesc('cycle_number')
                ->first();

            // Generate if the latest cycle has already started (ensure we always have a future cycle)
            if ($latestCycle && $latestCycle->start_date->lte($today)) {
                // Check if the next cycle already exists
                $nextStartDate = $latestCycle->end_date->copy()->addDay();
                $existsAlready = MlmCycle::where('company_id', $companyId)
                    ->where('start_date', $nextStartDate)
                    ->exists();

                if (!$existsAlready) {
                    $this->generateNextCycle($config);
                }
            }
        }

        Log::info("CycleService: Transition complete for company {$companyId}", $stats);

        return $stats;
    }

    /**
     * Ensure an agent has an active enrollment.
     * If not, enroll them in the current cycle.
     * Returns the enrollment that should receive metrics.
     */
    public function ensureEnrollment(LeadAgent $agent): ?AgentCycleEnrollment
    {
        $existing = $this->getActiveEnrollment($agent);

        if ($existing) {
            return $existing;
        }

        $currentCycle = $this->getOrCreateCurrentCycle($agent->company_id);

        if (!$currentCycle) {
            return null;
        }

        return $this->enrollAgent($agent, $currentCycle, now()->startOfDay());
    }

    /**
     * Get the cycle metrics for an agent's active enrollment.
     * Creates enrollment if needed.
     */
    public function getOrCreateCycleMetrics(LeadAgent $agent): ?AgentCycleMetric
    {
        $enrollment = $this->ensureEnrollment($agent);

        if (!$enrollment) {
            return null;
        }

        return $enrollment->metrics ?? AgentCycleMetric::create([
            'company_id' => $agent->company_id,
            'enrollment_id' => $enrollment->id,
            'agent_id' => $agent->id,
            'nsa' => 0,
            'nsd' => 0,
            'vsa' => 0,
            'vsd' => 0,
        ]);
    }
}
