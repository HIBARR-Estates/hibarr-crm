<?php

namespace App\Services;

use App\Exceptions\DuplicatePropertyException;
use App\Models\Property;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

/**
 * Service for detecting duplicate properties based on a composite fingerprint.
 * 
 * Fingerprint composition:
 * - With project:   {company_id}|{project_id}|{normalized_type}|{normalized_block}|{normalized_unit}
 * - Standalone:     {company_id}|{normalized_city}|{normalized_area}|{normalized_type}|{normalized_block}|{normalized_unit}
 * 
 * Normalization rules (aggressive):
 * - Lowercase all values
 * - Trim whitespace
 * - Strip common prefixes: block, unit, apt, apartment, tower, phase, building, blk, no, number, #
 * - Remove special characters except alphanumeric
 * - Collapse multiple whitespace to single space
 */
class PropertyDuplicateService
{
    /**
     * Common prefixes to strip during normalization.
     */
    protected const STRIP_PREFIXES = [
        'block',
        'blk',
        'unit',
        'apt',
        'apartment',
        'tower',
        'phase',
        'building',
        'bldg',
        'no',
        'number',
        'num',
        'house',
        'flat',
        'floor',
        'level',
        'suite',
        'ste',
        'room',
        'rm',
    ];

    /**
     * Aggressively normalize an identifier string for comparison.
     * 
     * Steps:
     * 1. Lowercase
     * 2. Trim whitespace
     * 3. Remove # symbol
     * 4. Strip known prefixes (block, unit, apt, etc.)
     * 5. Remove special characters (keep alphanumeric only)
     * 6. Collapse whitespace
     * 7. Final trim
     */
    public function normalizeIdentifier(?string $value): string
    {
        if ($value === null || trim($value) === '') {
            return '';
        }

        // Lowercase and trim
        $normalized = Str::lower(trim($value));

        // Remove # symbol
        $normalized = str_replace('#', '', $normalized);

        // Strip known prefixes (with optional trailing space, dash, or colon)
        foreach (self::STRIP_PREFIXES as $prefix) {
            $normalized = preg_replace('/^' . preg_quote($prefix, '/') . '[\s\-:.]*/i', '', $normalized);
        }

        // Remove special characters (keep alphanumeric, space, dash)
        $normalized = preg_replace('/[^a-z0-9\s\-]/', '', $normalized);

        // Collapse multiple spaces/dashes to single space
        $normalized = preg_replace('/[\s\-]+/', ' ', $normalized);

        // Final trim
        return trim($normalized);
    }

    /**
     * Build a fingerprint for a property or property data array.
     * 
     * Enhanced fingerprint now includes:
     * - primary_category
     * - unit_style  
     * - project_location_id (takes priority over developer_project_id for location)
     * 
     * @param Property|array $data Property model or array with property data
     * @return string The composite fingerprint
     */
    public function buildFingerprint(Property|array $data): string
    {
        if ($data instanceof Property) {
            $data = $data->toArray();
        }

        $companyId = $data['company_id'] ?? 0;
        $projectId = $data['developer_project_id'] ?? null;
        $projectLocationId = $data['project_location_id'] ?? null;
        $propertyType = $this->normalizeIdentifier($data['property_type'] ?? '');
        $primaryCategory = $this->normalizeIdentifier($data['primary_category'] ?? '');
        $unitStyleArr = $data['unit_style'] ?? [];
        if (is_string($unitStyleArr)) {
            $decoded = json_decode($unitStyleArr, true);
            $unitStyleArr = is_array($decoded) ? $decoded : ($unitStyleArr ? [$unitStyleArr] : []);
        }
        sort($unitStyleArr);
        $unitStyle = $this->normalizeIdentifier(implode(',', $unitStyleArr));
        $blockName = $this->normalizeIdentifier($data['block_name'] ?? '');
        $unitNumber = $this->normalizeIdentifier($data['unit_number'] ?? '');

        // Build location component - priority: project_location_id > developer_project_id > city/area
        $locationComponent = '';
        if ($projectLocationId) {
            $locationComponent = 'loc:' . $projectLocationId;
        } elseif ($projectId) {
            $locationComponent = 'project:' . $projectId;
        } else {
            // Standalone property: use city + area as location identifier
            $city = $this->normalizeIdentifier($data['city'] ?? '');
            $area = $this->normalizeIdentifier($data['area'] ?? '');
            $locationComponent = 'location:' . $city . ':' . $area;
        }

        return implode('|', [
            $companyId,
            $locationComponent,
            $primaryCategory,
            $propertyType,
            $unitStyle,
            $blockName,
            $unitNumber,
        ]);
    }

    /**
     * Find duplicate properties matching the given data.
     * 
     * Only checks for duplicates when both block_name and unit_number are provided.
     * This allows incomplete data while still catching definite duplicates.
     * 
     * Enhanced to include primary_category, unit_style, and project_location_id.
     *
     * @param Property|array $data Property model or array with property data
     * @param int|null $excludeId Property ID to exclude (for updates)
     * @return Collection<int, Property>
     */
    public function findDuplicates(Property|array $data, ?int $excludeId = null): Collection
    {
        if ($data instanceof Property) {
            $data = $data->toArray();
        }

        $companyId = $data['company_id'] ?? null;
        $projectId = $data['developer_project_id'] ?? null;
        $projectLocationId = $data['project_location_id'] ?? null;
        $propertyType = $this->normalizeIdentifier($data['property_type'] ?? '');
        $primaryCategory = $this->normalizeIdentifier($data['primary_category'] ?? '');
        $unitStyleArr = $data['unit_style'] ?? [];
        if (is_string($unitStyleArr)) {
            $decoded = json_decode($unitStyleArr, true);
            $unitStyleArr = is_array($decoded) ? $decoded : ($unitStyleArr ? [$unitStyleArr] : []);
        }
        if (!is_array($unitStyleArr)) {
            $unitStyleArr = $unitStyleArr ? [$unitStyleArr] : [];
        }
        sort($unitStyleArr);
        $unitStyle = $this->normalizeIdentifier(implode(',', $unitStyleArr));
        $blockName = $this->normalizeIdentifier($data['block_name'] ?? '');
        $unitNumber = $this->normalizeIdentifier($data['unit_number'] ?? '');

        // Skip duplicate check if block_name or unit_number is empty
        // This allows incomplete data while catching definite duplicates
        if ($blockName === '' || $unitNumber === '') {
            return collect();
        }

        $query = Property::query()
            ->where('company_id', $companyId);

        // Exclude current property on updates
        if ($excludeId !== null) {
            $query->where('id', '!=', $excludeId);
        }

        // Match on location - priority: project_location_id > developer_project_id > city/area
        if ($projectLocationId) {
            $query->where('project_location_id', $projectLocationId);
        } elseif ($projectId) {
            $query->where('developer_project_id', $projectId);
        } else {
            // Standalone: match on city + area
            $query->whereNull('developer_project_id')
                  ->whereNull('project_location_id');
            
            $city = $data['city'] ?? '';
            $area = $data['area'] ?? '';
            
            if ($city) {
                $query->whereRaw('LOWER(TRIM(city)) = ?', [Str::lower(trim($city))]);
            }
            if ($area) {
                $query->whereRaw('LOWER(TRIM(area)) = ?', [Str::lower(trim($area))]);
            }
        }

        // Get candidates and filter by normalized comparison
        $candidates = $query->get();

        return $candidates->filter(function (Property $candidate) use ($propertyType, $primaryCategory, $unitStyle, $blockName, $unitNumber) {
            $candidateType = $this->normalizeIdentifier($candidate->property_type);
            $candidateCategory = $this->normalizeIdentifier($candidate->primary_category);
            // Normalize candidate unit_style array
            $candidateStyleArr = $candidate->unit_style ?? [];
            if (!is_array($candidateStyleArr)) {
                $candidateStyleArr = $candidateStyleArr ? [$candidateStyleArr] : [];
            }
            sort($candidateStyleArr);
            $candidateStyle = $this->normalizeIdentifier(implode(',', $candidateStyleArr));
            $candidateBlock = $this->normalizeIdentifier($candidate->block_name);
            $candidateUnit = $this->normalizeIdentifier($candidate->unit_number);

            // Skip candidates without block/unit
            if ($candidateBlock === '' || $candidateUnit === '') {
                return false;
            }

            // All fields must match for a duplicate
            return $candidateType === $propertyType
                && $candidateCategory === $primaryCategory
                && $candidateStyle === $unitStyle
                && $candidateBlock === $blockName
                && $candidateUnit === $unitNumber;
        });
    }

    /**
     * Assert that no duplicates exist for the given property data.
     * Throws DuplicatePropertyException if duplicates are found.
     *
     * @param Property|array $data Property model or array with property data
     * @param int|null $excludeId Property ID to exclude (for updates)
     * @throws DuplicatePropertyException
     */
    public function assertNoDuplicates(Property|array $data, ?int $excludeId = null): void
    {
        $duplicates = $this->findDuplicates($data, $excludeId);

        if ($duplicates->isNotEmpty()) {
            throw new DuplicatePropertyException(
                $duplicates,
                $this->buildFingerprint($data)
            );
        }
    }

    /**
     * Check for duplicates when assigning properties to a new project.
     * Returns properties that would conflict within the target project.
     *
     * @param array<int> $propertyIds Property IDs being assigned
     * @param int $targetProjectId Target developer project ID
     * @return Collection<int, array{property: Property, conflictsWith: Property}>
     */
    public function checkProjectAssignmentConflicts(array $propertyIds, int $targetProjectId): Collection
    {
        $propertiesToAssign = Property::whereIn('id', $propertyIds)->get();
        $conflicts = collect();

        foreach ($propertiesToAssign as $property) {
            // Build what the fingerprint would be after assignment
            $futureData = $property->toArray();
            $futureData['developer_project_id'] = $targetProjectId;

            $duplicates = $this->findDuplicates($futureData, $property->id);

            if ($duplicates->isNotEmpty()) {
                $conflicts->push([
                    'property' => $property,
                    'conflictsWith' => $duplicates->first(),
                ]);
            }
        }

        return $conflicts;
    }

    /**
     * Assert no conflicts when assigning properties to a project.
     * 
     * @param array<int> $propertyIds Property IDs being assigned
     * @param int $targetProjectId Target developer project ID
     * @param string $projectName Project name for error message
     * @throws DuplicatePropertyException
     */
    public function assertNoProjectAssignmentConflicts(array $propertyIds, int $targetProjectId, string $projectName): void
    {
        $conflicts = $this->checkProjectAssignmentConflicts($propertyIds, $targetProjectId);

        if ($conflicts->isNotEmpty()) {
            $conflictingProperties = $conflicts->pluck('property');
            throw DuplicatePropertyException::forProjectAssignment($conflictingProperties, $projectName);
        }
    }

    /**
     * Validate bulk import data for duplicates.
     * Checks both against existing properties AND within the import batch itself.
     *
     * @param array<int, array> $rows Array of row data, indexed by row number
     * @param int $companyId Company ID for the import
     * @return array<int, array{row: int, duplicates: Collection}> Row conflicts
     */
    public function validateBulkImport(array $rows, int $companyId): array
    {
        $conflicts = [];
        $processedFingerprints = [];

        foreach ($rows as $rowNumber => $rowData) {
            $rowData['company_id'] = $companyId;
            
            $blockName = $this->normalizeIdentifier($rowData['block_name'] ?? '');
            $unitNumber = $this->normalizeIdentifier($rowData['unit_number'] ?? '');

            // Skip rows without block/unit (they can't be duplicates)
            if ($blockName === '' || $unitNumber === '') {
                continue;
            }

            $fingerprint = $this->buildFingerprint($rowData);

            // Check against previously processed rows in this batch
            if (isset($processedFingerprints[$fingerprint])) {
                $conflicts[] = [
                    'row' => $rowNumber,
                    'duplicates' => collect([
                        (object) ['title' => "Row {$processedFingerprints[$fingerprint]} (in this import)", 'id' => 0],
                    ]),
                    'message' => "Duplicate of row {$processedFingerprints[$fingerprint]} in this import",
                ];
                continue;
            }

            // Check against existing properties in database
            $existingDuplicates = $this->findDuplicates($rowData);
            
            if ($existingDuplicates->isNotEmpty()) {
                $conflicts[] = [
                    'row' => $rowNumber,
                    'duplicates' => $existingDuplicates,
                ];
            }

            // Track this fingerprint for intra-batch duplicate detection
            $processedFingerprints[$fingerprint] = $rowNumber;
        }

        return $conflicts;
    }

    /**
     * Assert no duplicates in bulk import data.
     *
     * @param array<int, array> $rows Array of row data, indexed by row number
     * @param int $companyId Company ID for the import
     * @throws DuplicatePropertyException
     */
    public function assertNoBulkImportDuplicates(array $rows, int $companyId): void
    {
        $conflicts = $this->validateBulkImport($rows, $companyId);

        if (!empty($conflicts)) {
            throw DuplicatePropertyException::forBulkImport($conflicts);
        }
    }
}
