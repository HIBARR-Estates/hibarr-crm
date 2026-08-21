<?php

namespace App\Services;

use App\Enums\CycleStatus;
use App\Enums\EnrollmentStatus;
use App\Models\AgentCycleEnrollment;
use App\Models\AgentCycleMetric;
use App\Models\Company;
use App\Models\LeadAgent;
use App\Models\MlmCycle;
use App\Models\MlmSetting;
use App\Models\MlmLevel;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CycleService
{
    protected CycleLevelSnapshotService $snapshotService;

    public function __construct(CycleLevelSnapshotService $snapshotService)
    {
        $this->snapshotService = $snapshotService;
    }

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
            $this->snapshotService->snapshotForCycle($upcomingNowActive);
            app(MlmNotificationService::class)->afterCommit(
                fn () => app(MlmNotificationService::class)->notifyCycleStarted($upcomingNowActive->fresh())
            );

            return $upcomingNowActive;
        }

        // Auto-generate if settings allow
        $settings = MlmSetting::where('company_id', $companyId)->first();

        if (!$settings || !$settings->auto_generate_cycles) {
            return null;
        }

        return $this->generateNextCycle($companyId);
    }

    /**
     * Generate the next cycle based on company settings.
     * Starts from the last cycle's end date + 1 day, or from today if no cycles exist.
     */
    public function generateNextCycle(int $companyId): MlmCycle
    {
        $settings = MlmSetting::forCompany($companyId);

        $lastCycle = MlmCycle::where('company_id', $companyId)
            ->orderByDesc('cycle_number')
            ->first();

        if ($lastCycle) {
            $startDate = $lastCycle->end_date->copy()->addDay();
            $nextNumber = $lastCycle->cycle_number + 1;
        } else {
            $startDate = now()->startOfDay();
            $nextNumber = 1;
        }

        $endDate = $settings->calculateDefaultEndDate($startDate);
        $today = now()->startOfDay();

        // Determine initial status based on dates
        $status = CycleStatus::Upcoming;
        if ($today->between($startDate, $endDate)) {
            $status = CycleStatus::Active;
        } elseif ($today->gt($endDate)) {
            $status = CycleStatus::Completed;
        }

        $cycle = MlmCycle::create([
            'company_id' => $companyId,
            'cycle_number' => $nextNumber,
            'name' => "Cycle #{$nextNumber}",
            'start_date' => $startDate,
            'end_date' => $endDate,
            'status' => $status,
            'max_overflow_multiplier' => $settings->default_overflow_multiplier,
        ]);

        // If the cycle is immediately active, snapshot levels
        if ($status === CycleStatus::Active) {
            $this->snapshotService->snapshotForCycle($cycle);
            app(MlmNotificationService::class)->afterCommit(
                fn () => app(MlmNotificationService::class)->notifyCycleStarted($cycle->fresh())
            );
        }

        Log::info("CycleService: Generated cycle #{$nextNumber} for company {$companyId} ({$startDate->format('Y-m-d')} to {$endDate->format('Y-m-d')})");;

        return $cycle;
    }

    /**
     * Validate that a cycle's date range does not overlap with existing cycles for the same company.
     *
     * @return string|null Error message if overlap exists, null if valid.
     */
    public function validateNoOverlap(int $companyId, Carbon $startDate, Carbon $endDate, ?int $excludeCycleId = null): ?string
    {
        $query = MlmCycle::where('company_id', $companyId)
            ->where(function ($q) use ($startDate, $endDate) {
                // Overlap: existing.start <= new.end AND existing.end >= new.start
                $q->where('start_date', '<=', $endDate)
                  ->where('end_date', '>=', $startDate);
            });

        if ($excludeCycleId) {
            $query->where('id', '!=', $excludeCycleId);
        }

        $overlapping = $query->first();

        if ($overlapping) {
            return "Date range overlaps with Cycle #{$overlapping->cycle_number} ({$overlapping->start_date->format('Y-m-d')} to {$overlapping->end_date->format('Y-m-d')}).";
        }

        return null;
    }

    /**
     * Enroll an agent into a cycle.
     */
    public function enrollAgent(LeadAgent $agent, MlmCycle $cycle, ?Carbon $effectiveStart = null): AgentCycleEnrollment
    {
        $startDate = $effectiveStart ?? $cycle->start_date;
        $effectiveEndDate = $cycle->end_date;

        // Calculate max overflow date using the cycle's own multiplier
        $overflowDays = $cycle->max_overflow_days;

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

        $agent = $enrollment->agent()->first();
        $cycle = $enrollment->cycle()->first();

        if ($agent && $cycle) {
            app(MlmNotificationService::class)->afterCommit(
                fn () => app(MlmNotificationService::class)->notifyCycleCriteriaMet(
                    $agent->fresh(),
                    $cycle->fresh(),
                    $levelAchieved,
                )
            );
        }

        // Auto-enroll in the current company cycle
        return $this->autoEnrollInCurrentCycle($enrollment->agent);
    }

    /**
     * Force-complete an enrollment when max overflow is reached without meeting criteria.
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
     */
    public function transitionCycleStatuses(int $companyId): array
    {
        $today = now()->startOfDay();
        $stats = ['cycles_activated' => 0, 'cycles_completed' => 0, 'enrollments_extended' => 0, 'enrollments_force_completed' => 0, 'enrollments_auto_enrolled' => 0];

        // 1. Activate upcoming cycles where start_date <= today
        $cyclesToActivate = MlmCycle::where('company_id', $companyId)
            ->where('status', CycleStatus::Upcoming)
            ->where('start_date', '<=', $today)
            ->get();

        foreach ($cyclesToActivate as $cycle) {
            $cycle->update(['status' => CycleStatus::Active]);
            $this->snapshotService->snapshotForCycle($cycle);
            app(MlmNotificationService::class)->afterCommit(
                fn () => app(MlmNotificationService::class)->notifyCycleStarted($cycle->fresh())
            );
        }

        $stats['cycles_activated'] = $cyclesToActivate->count();

        // 2. Complete active cycles where end_date < today
        $completedCycleIds = MlmCycle::where('company_id', $companyId)
            ->where('status', CycleStatus::Active)
            ->where('end_date', '<', $today)
            ->pluck('id');

        if ($completedCycleIds->isNotEmpty()) {
            $completedCycles = MlmCycle::whereIn('id', $completedCycleIds)->get();

            MlmCycle::whereIn('id', $completedCycleIds)
                ->update(['status' => CycleStatus::Completed]);

            $stats['cycles_completed'] = $completedCycleIds->count();

            foreach ($completedCycles as $cycle) {
                app(MlmNotificationService::class)->afterCommit(
                    fn () => app(MlmNotificationService::class)->notifyCycleCompleted($cycle->fresh())
                );
            }

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
        $settings = MlmSetting::where('company_id', $companyId)->first();
        if ($settings && $settings->auto_generate_cycles) {
            $latestCycle = MlmCycle::where('company_id', $companyId)
                ->orderByDesc('cycle_number')
                ->first();

            // Generate if the latest cycle has already started (ensure we always have a future cycle)
            if ($latestCycle && $latestCycle->start_date->lte($today)) {
                $nextStartDate = $latestCycle->end_date->copy()->addDay();
                $existsAlready = MlmCycle::where('company_id', $companyId)
                    ->where('start_date', $nextStartDate)
                    ->exists();

                if (!$existsAlready) {
                    $this->generateNextCycle($companyId);
                }
            }
        }

        Log::info("CycleService: Transition complete for company {$companyId}", $stats);

        return $stats;
    }

    /**
     * Ensure an agent has an active enrollment.
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
