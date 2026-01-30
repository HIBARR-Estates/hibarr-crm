<?php

namespace App\Exceptions;

use App\Models\Property;
use Exception;
use Illuminate\Support\Collection;

/**
 * Exception thrown when attempting to create or update a property
 * that would result in a duplicate based on the composite fingerprint.
 */
class DuplicatePropertyException extends Exception
{
    /**
     * The duplicate properties found.
     *
     * @var Collection<int, Property>
     */
    protected Collection $duplicates;

    /**
     * The fingerprint that caused the conflict.
     */
    protected string $fingerprint;

    /**
     * Create a new DuplicatePropertyException instance.
     *
     * @param Collection<int, Property> $duplicates
     * @param string $fingerprint
     * @param string|null $message
     */
    public function __construct(Collection $duplicates, string $fingerprint, ?string $message = null)
    {
        $this->duplicates = $duplicates;
        $this->fingerprint = $fingerprint;

        $message = $message ?? $this->buildDefaultMessage();

        parent::__construct($message, 422);
    }

    /**
     * Build the default error message.
     */
    protected function buildDefaultMessage(): string
    {
        $count = $this->duplicates->count();
        $firstDuplicate = $this->duplicates->first();

        if ($count === 1 && $firstDuplicate) {
            return sprintf(
                'Duplicate property exists: "%s" (ID: %d)',
                $firstDuplicate->title,
                $firstDuplicate->id
            );
        }

        $titles = $this->duplicates->take(3)->pluck('title')->implode('", "');
        
        return sprintf(
            '%d duplicate properties found: "%s"%s',
            $count,
            $titles,
            $count > 3 ? ' and more...' : ''
        );
    }

    /**
     * Get the duplicate properties.
     *
     * @return Collection<int, Property>
     */
    public function getDuplicates(): Collection
    {
        return $this->duplicates;
    }

    /**
     * Get the fingerprint that caused the conflict.
     */
    public function getFingerprint(): string
    {
        return $this->fingerprint;
    }

    /**
     * Get duplicate details for API response.
     *
     * @return array<int, array{id: int, title: string, fingerprint: string}>
     */
    public function getDuplicateDetails(): array
    {
        return $this->duplicates->map(function (Property $property) {
            return [
                'id' => $property->id,
                'title' => $property->title,
                'property_type' => $property->property_type,
                'block_name' => $property->block_name,
                'unit_number' => $property->unit_number,
                'city' => $property->city,
                'area' => $property->area,
            ];
        })->all();
    }

    /**
     * Create exception for bulk import with multiple row conflicts.
     *
     * @param array<int, array{row: int, duplicates: Collection}> $rowConflicts
     * @return static
     */
    public static function forBulkImport(array $rowConflicts): static
    {
        $allDuplicates = collect();
        $messages = [];

        foreach ($rowConflicts as $conflict) {
            $rowNum = $conflict['row'];
            $duplicates = $conflict['duplicates'];
            $allDuplicates = $allDuplicates->merge($duplicates);
            
            $titles = $duplicates->pluck('title')->implode('", "');
            $messages[] = sprintf('Row %d conflicts with: "%s"', $rowNum, $titles);
        }

        $message = sprintf(
            'Import failed: %d rows have duplicate properties. %s',
            count($rowConflicts),
            implode('; ', array_slice($messages, 0, 5)) . (count($messages) > 5 ? '...' : '')
        );

        return new static($allDuplicates, 'bulk-import', $message);
    }

    /**
     * Create exception for project assignment conflicts.
     *
     * @param Collection<int, Property> $conflictingProperties
     * @param string $projectName
     * @return static
     */
    public static function forProjectAssignment(Collection $conflictingProperties, string $projectName): static
    {
        $message = sprintf(
            'Cannot assign properties to project "%s": %d properties would create duplicates within the project',
            $projectName,
            $conflictingProperties->count()
        );

        return new static($conflictingProperties, 'project-assignment', $message);
    }
}
