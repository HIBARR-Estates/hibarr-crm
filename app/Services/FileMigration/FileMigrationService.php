<?php

namespace App\Services\FileMigration;

use Illuminate\Support\Facades\Log;

/**
 * FileMigrationService
 *
 * Central orchestrator for file migration. Manages registered migrators
 * and provides discovery, counting, and ID-collection helpers used
 * by the Artisan command and the queued job.
 *
 * Usage:
 *   $service = new FileMigrationService();
 *   $service->register(new DealFileMigrator());
 *   $service->register(new CustomFieldFileMigrator());
 *   $counts = $service->countAllUnmigrated();
 */
class FileMigrationService
{
    /** @var array<string, FileMigratorInterface> */
    protected array $migrators = [];

    /**
     * Register a migrator strategy.
     */
    public function register(FileMigratorInterface $migrator): self
    {
        $this->migrators[$migrator->getName()] = $migrator;
        return $this;
    }

    /**
     * Get a registered migrator by name.
     *
     * @throws \InvalidArgumentException
     */
    public function getMigrator(string $name): FileMigratorInterface
    {
        if (!isset($this->migrators[$name])) {
            throw new \InvalidArgumentException(
                "Unknown migrator '{$name}'. Available: " . implode(', ', array_keys($this->migrators))
            );
        }

        return $this->migrators[$name];
    }

    /**
     * Get all registered migrator names.
     *
     * @return string[]
     */
    public function getAvailableNames(): array
    {
        return array_keys($this->migrators);
    }

    /**
     * Get all registered migrators.
     *
     * @return array<string, FileMigratorInterface>
     */
    public function getMigrators(): array
    {
        return $this->migrators;
    }

    /**
     * Count unmigrated records for one or all migrators.
     *
     * @param  string|null  $name  Specific migrator name, or null for all
     * @return array<string, int>  ['deal_files' => 42, ...]
     */
    public function countUnmigrated(?string $name = null): array
    {
        $counts = [];
        $targets = $name
            ? [$name => $this->getMigrator($name)]
            : $this->migrators;

        foreach ($targets as $key => $migrator) {
            try {
                $counts[$key] = $migrator->queryUnmigrated()->count();
            } catch (\Exception $e) {
                Log::warning("FileMigrationService: Failed to count unmigrated for '{$key}'", [
                    'error' => $e->getMessage(),
                ]);
                $counts[$key] = -1; // indicate error
            }
        }

        return $counts;
    }

    /**
     * Get unmigrated record IDs for a migrator, with an optional limit.
     *
     * @param  string  $name
     * @param  int     $limit  0 = no limit
     * @return int[]
     */
    public function getUnmigratedIds(string $name, int $limit = 0): array
    {
        $migrator = $this->getMigrator($name);
        $query = $migrator->queryUnmigrated()->select('id');

        if ($limit > 0) {
            $query->limit($limit);
        }

        return $query->pluck('id')->all();
    }

    /**
     * Get a sample of unmigrated records for dry-run preview.
     *
     * @param  string  $name
     * @param  int     $sampleSize
     * @return array
     */
    public function getSample(string $name, int $sampleSize = 5): array
    {
        $migrator = $this->getMigrator($name);

        return $migrator->queryUnmigrated()
            ->limit($sampleSize)
            ->get()
            ->map(fn($row) => (array) $row)
            ->all();
    }

    /**
     * Build the default set of migrators for Deal/Lead scope.
     * Call this from the Artisan command for convenience.
     */
    public static function withDefaultMigrators(): self
    {
        $service = new self();
        $service->register(new DealFileMigrator());
        $service->register(new CustomFieldFileMigrator());
        $service->register(new HibarrDealFieldsMigrator());

        return $service;
    }
}
