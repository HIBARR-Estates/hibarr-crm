<?php

namespace App\Console\Commands;

use App\Models\DeveloperProject;
use Illuminate\Console\Command;

class RecoverProjectFacilities extends Command
{
    protected $signature = 'developer-projects:recover-facilities
        {--company= : Restrict to one company_id}
        {--project= : Restrict to one developer project id}
        {--apply : Persist changes (default is dry-run)}';

    protected $description = 'Recover missing developer project facilities from related property interior/exterior features.';

    public function handle(): int
    {
        $apply = (bool) $this->option('apply');
        $companyId = $this->option('company');
        $projectId = $this->option('project');

        $mode = $apply ? 'APPLY' : 'DRY-RUN';
        $this->info("Running facilities recovery ({$mode})...");

        $query = DeveloperProject::query()
            ->with(['properties:id,developer_project_id,exterior_features,interior_features'])
            ->when($companyId, fn ($q) => $q->where('company_id', (int) $companyId))
            ->when($projectId, fn ($q) => $q->where('id', (int) $projectId));

        $projects = $query->get();

        if ($projects->isEmpty()) {
            $this->warn('No projects found for the selected scope.');
            return Command::SUCCESS;
        }

        $stats = [
            'scanned' => 0,
            'eligible_empty' => 0,
            'recoverable' => 0,
            'updated' => 0,
            'skipped_non_empty' => 0,
            'skipped_no_derived' => 0,
        ];

        foreach ($projects as $project) {
            $stats['scanned']++;

            $currentFacilities = is_array($project->facilities) ? $project->facilities : [];
            if (!empty($currentFacilities)) {
                $stats['skipped_non_empty']++;
                continue;
            }

            $stats['eligible_empty']++;

            $derivedFacilities = collect();
            foreach ($project->properties as $property) {
                $exterior = is_array($property->exterior_features) ? $property->exterior_features : [];
                $interior = is_array($property->interior_features) ? $property->interior_features : [];

                $derivedFacilities = $derivedFacilities->merge($exterior)->merge($interior);
            }

            $derivedFacilities = $derivedFacilities
                ->filter(fn ($slug) => is_string($slug) && trim($slug) !== '')
                ->map(fn (string $slug) => trim($slug))
                ->unique()
                ->values()
                ->all();

            if (empty($derivedFacilities)) {
                $stats['skipped_no_derived']++;
                continue;
            }

            $stats['recoverable']++;
            $this->line("Project #{$project->id} {$project->name} -> " . implode(', ', $derivedFacilities));

            if ($apply) {
                $project->update(['facilities' => $derivedFacilities]);
                $stats['updated']++;
            }
        }

        $this->line('');
        $this->info('Summary');
        $this->line('  Projects scanned: ' . $stats['scanned']);
        $this->line('  Empty facilities projects: ' . $stats['eligible_empty']);
        $this->line('  Recoverable from property features: ' . $stats['recoverable']);
        $this->line('  Skipped (already had facilities): ' . $stats['skipped_non_empty']);
        $this->line('  Skipped (no derived features): ' . $stats['skipped_no_derived']);

        if ($apply) {
            $this->line('  Updated projects: ' . $stats['updated']);
        } else {
            $this->line('  Dry-run only. Re-run with --apply to persist changes.');
        }

        return Command::SUCCESS;
    }
}
