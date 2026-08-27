<?php

namespace App\Console\Commands;

use App\Models\DeveloperProject;
use App\Models\ProjectLocation;
use App\Models\Property;
use Illuminate\Console\Command;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

class DeduplicateProjectLocations extends Command
{
    protected $signature = 'project-locations:deduplicate
        {--company= : Restrict to a single company_id}
        {--apply : Apply changes (default is dry-run)}';

    protected $description = 'Deduplicate project locations by normalized area+city, merge shared expose blobs, and rewire references without touching per-project map pins.';

    public function handle(): int
    {
        $companyOption = $this->option('company');
        $apply = (bool) $this->option('apply');

        $this->info($apply ? 'Running project location deduplication (APPLY mode)...' : 'Running project location deduplication (DRY-RUN mode)...');

        $companyIds = ProjectLocation::query()
            ->when($companyOption, fn ($q) => $q->where('company_id', (int) $companyOption))
            ->distinct()
            ->orderBy('company_id')
            ->pluck('company_id');

        if ($companyIds->isEmpty()) {
            $this->warn('No project locations found for the selected scope.');
            return Command::SUCCESS;
        }

        $totals = [
            'companies' => 0,
            'groups' => 0,
            'merged_groups' => 0,
            'projects_relinked' => 0,
            'properties_relinked' => 0,
            'locations_soft_deleted' => 0,
            'locations_renamed' => 0,
            'locations_blob_merged' => 0,
        ];

        foreach ($companyIds as $companyId) {
            $totals['companies']++;

            $locations = ProjectLocation::withTrashed()
                ->where('company_id', $companyId)
                ->orderBy('id')
                ->get();

            if ($locations->isEmpty()) {
                continue;
            }

            $projectCounts = DeveloperProject::withTrashed()
                ->where('company_id', $companyId)
                ->whereNotNull('project_location_id')
                ->select('project_location_id', DB::raw('COUNT(*) as total'))
                ->groupBy('project_location_id')
                ->pluck('total', 'project_location_id');

            $groups = $locations->groupBy(fn (ProjectLocation $location) => $this->locationGroupKey($location));
            $totals['groups'] += $groups->count();

            $this->line('');
            $this->info("Company {$companyId}: {$locations->count()} locations across {$groups->count()} normalized groups");

            foreach ($groups as $groupKey => $groupLocations) {
                $canonical = $this->selectCanonicalLocation($groupLocations, $projectCounts);

                $canonicalCity = $this->normalizeText($canonical->city);
                $canonicalArea = $this->normalizeText($canonical->area);
                $canonicalName = $this->formatLocationName($canonicalCity, $canonicalArea);

                $projectIds = DeveloperProject::withTrashed()
                    ->whereIn('project_location_id', $groupLocations->pluck('id'))
                    ->orderBy('id')
                    ->pluck('id')
                    ->all();

                $duplicateLocations = $groupLocations
                    ->filter(fn (ProjectLocation $location) => (int) $location->id !== (int) $canonical->id)
                    ->values();

                $duplicateIds = $duplicateLocations->pluck('id')->all();

                $needsRename = $canonicalName !== null && $canonical->name !== $canonicalName;
                $hasDuplicates = !empty($duplicateIds);
                $blobMerge = $this->buildExposeBlobMerge($canonical, $duplicateLocations);
                $needsBlobMerge = !empty($blobMerge);

                if (!$needsRename && !$hasDuplicates && !$needsBlobMerge) {
                    continue;
                }

                $totals['merged_groups']++;

                $this->line("- Group {$groupKey}");
                $this->line("  Canonical location #{$canonical->id}" . ($canonicalName ? " => {$canonicalName}" : ''));
                if (!empty($projectIds)) {
                    $this->line('  Developer project IDs: ' . implode(', ', $projectIds));
                }
                if (!empty($duplicateIds)) {
                    $this->line('  Duplicate location IDs: ' . implode(', ', $duplicateIds));
                }
                if ($needsBlobMerge) {
                    $this->line('  Will merge non-empty expose defaults onto canonical: ' . implode(', ', array_keys($blobMerge)));
                }
                $this->line('  Note: developer_projects map pins are left unchanged.');

                if (!$apply) {
                    continue;
                }

                DB::transaction(function () use (
                    $canonical,
                    $canonicalCity,
                    $canonicalArea,
                    $canonicalName,
                    $duplicateIds,
                    $blobMerge,
                    &$totals
                ) {
                    if ($canonical->trashed()) {
                        $canonical->restore();
                    }

                    $canonicalUpdates = $blobMerge;

                    if ($canonicalName !== null && $canonical->name !== $canonicalName) {
                        $canonicalUpdates['city'] = $canonicalCity;
                        $canonicalUpdates['area'] = $canonicalArea;
                        $canonicalUpdates['name'] = $canonicalName;
                        $totals['locations_renamed']++;
                    }

                    if (!empty($canonicalUpdates)) {
                        $canonical->update($canonicalUpdates);
                        if (!empty($blobMerge)) {
                            $totals['locations_blob_merged']++;
                        }
                    }

                    if (empty($duplicateIds)) {
                        return;
                    }

                    // Relink FKs only — do not touch developer_projects pin columns.
                    $projectsRelinked = DeveloperProject::withTrashed()
                        ->whereIn('project_location_id', $duplicateIds)
                        ->update(['project_location_id' => $canonical->id]);

                    $propertiesRelinked = Property::query()
                        ->whereIn('project_location_id', $duplicateIds)
                        ->update(['project_location_id' => $canonical->id]);

                    $softDeleted = ProjectLocation::query()
                        ->whereIn('id', $duplicateIds)
                        ->delete();

                    $totals['projects_relinked'] += $projectsRelinked;
                    $totals['properties_relinked'] += $propertiesRelinked;
                    $totals['locations_soft_deleted'] += $softDeleted;
                });
            }
        }

        $this->line('');
        $this->info('Summary');
        $this->line('  Companies processed: ' . $totals['companies']);
        $this->line('  Groups scanned: ' . $totals['groups']);
        $this->line('  Groups requiring cleanup: ' . $totals['merged_groups']);

        if ($apply) {
            $this->line('  Developer projects relinked: ' . $totals['projects_relinked']);
            $this->line('  Properties relinked: ' . $totals['properties_relinked']);
            $this->line('  Locations renamed: ' . $totals['locations_renamed']);
            $this->line('  Locations with expose defaults merged: ' . $totals['locations_blob_merged']);
            $this->line('  Duplicate locations soft-deleted: ' . $totals['locations_soft_deleted']);
        } else {
            $this->line('  Dry-run only. Re-run with --apply to persist changes.');
        }

        return Command::SUCCESS;
    }

    /**
     * Prefer non-empty shared expose/default fields from duplicates when canonical is empty.
     * Does not read or write developer_projects pin columns.
     *
     * @return array<string, mixed>
     */
    private function buildExposeBlobMerge(ProjectLocation $canonical, Collection $duplicates): array
    {
        if ($duplicates->isEmpty()) {
            return [];
        }

        $updates = [];

        foreach (['attractions', 'infrastructure', 'airports'] as $field) {
            if ($this->isEmptyBlob($canonical->{$field})) {
                foreach ($duplicates as $duplicate) {
                    if (!$this->isEmptyBlob($duplicate->{$field})) {
                        $updates[$field] = $duplicate->{$field};
                        break;
                    }
                }
            }
        }

        foreach (['image_url', 'description', 'map_url'] as $field) {
            if ($this->isEmptyScalar($canonical->{$field})) {
                foreach ($duplicates as $duplicate) {
                    if (!$this->isEmptyScalar($duplicate->{$field})) {
                        $updates[$field] = $duplicate->{$field};
                        break;
                    }
                }
            }
        }

        if ($this->isEmptyBlob($canonical->address)) {
            foreach ($duplicates as $duplicate) {
                if (!$this->isEmptyBlob($duplicate->address)) {
                    $updates['address'] = $duplicate->address;
                    break;
                }
            }
        }

        foreach (['latitude', 'longitude'] as $field) {
            if ($canonical->{$field} === null) {
                foreach ($duplicates as $duplicate) {
                    if ($duplicate->{$field} !== null) {
                        $updates[$field] = $duplicate->{$field};
                        break;
                    }
                }
            }
        }

        return $updates;
    }

    private function isEmptyBlob(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }

        if (is_array($value)) {
            return $value === [] || empty(array_filter($value, fn ($item) => $item !== null && $item !== '' && $item !== []));
        }

        return false;
    }

    private function isEmptyScalar(mixed $value): bool
    {
        return $value === null || $value === '';
    }

    private function locationGroupKey(ProjectLocation $location): string
    {
        $city = $this->normalizeText($location->city);
        $area = $this->normalizeText($location->area);

        // Fallback to normalized name when city and area are both empty.
        if (!$city && !$area) {
            return 'name:' . strtolower($this->normalizeText($location->name) ?? 'unknown');
        }

        return 'city_area:' . strtolower($area ?? '') . '|' . strtolower($city ?? '');
    }

    private function selectCanonicalLocation(Collection $groupLocations, Collection $projectCounts): ProjectLocation
    {
        return $groupLocations
            ->sort(function (ProjectLocation $a, ProjectLocation $b) use ($projectCounts) {
                if ($a->trashed() !== $b->trashed()) {
                    return $a->trashed() ? 1 : -1;
                }

                $countA = (int) ($projectCounts[$a->id] ?? 0);
                $countB = (int) ($projectCounts[$b->id] ?? 0);

                if ($countA === $countB) {
                    return $a->id <=> $b->id;
                }

                return $countB <=> $countA;
            })
            ->first();
    }

    private function normalizeText(?string $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $normalized = preg_replace('/\s+/', ' ', trim($value));

        return $normalized === '' ? null : $normalized;
    }

    private function formatLocationName(?string $city, ?string $area): ?string
    {
        $parts = array_filter([$area, $city], fn ($part) => $part !== null && $part !== '');
        $name = implode(', ', $parts);

        return $name === '' ? null : $name;
    }
}
