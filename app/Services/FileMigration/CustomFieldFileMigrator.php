<?php

namespace App\Services\FileMigration;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Migrates custom field file values from local storage to external storage.
 *
 * The custom_fields_data.value column can contain:
 *  - A single filename  ("abc123def.pdf")
 *  - A JSON array       ('["file1.pdf","file2.pdf"]')
 *  - Already an external URL (skipped by queryUnmigrated)
 *
 * Source path: public/user-uploads/custom_fields/{filename}
 * Target:     value column updated to downloadUrl(s)
 */
class CustomFieldFileMigrator implements FileMigratorInterface
{
    public function getName(): string
    {
        return 'custom_field_files';
    }

    public function getDescription(): string
    {
        return 'Custom field file values (custom_fields_data table)';
    }

    public function queryUnmigrated(): Builder
    {
        return DB::table('custom_fields_data')
            ->join('custom_fields', 'custom_fields_data.custom_field_id', '=', 'custom_fields.id')
            ->where('custom_fields.type', 'file')
            ->where('custom_fields_data.value', '!=', '')
            ->whereNotNull('custom_fields_data.value')
            // Exclude values that are already external URLs
            ->where('custom_fields_data.value', 'NOT LIKE', 'http://%')
            ->where('custom_fields_data.value', 'NOT LIKE', 'https://%')
            // Exclude JSON arrays that might contain a mix (handled separately if needed)
            // Actually we DO want to process JSON arrays of local filenames
            ->select([
                'custom_fields_data.id',
                'custom_fields_data.custom_field_id',
                'custom_fields_data.model',
                'custom_fields_data.model_id',
                'custom_fields_data.value',
            ]);
    }

    public function resolveFiles(object $record): array
    {
        $filenames = $this->parseFileValue($record->value);
        $files = [];

        foreach ($filenames as $filename) {
            // Skip if this individual filename is already an external URL
            if (str_starts_with($filename, 'http://') || str_starts_with($filename, 'https://')) {
                continue;
            }

            $localPath = public_path('user-uploads/custom_fields/' . $filename);

            if (!file_exists($localPath)) {
                Log::warning('CustomFieldFileMigrator: Local file not found', [
                    'record_id' => $record->id,
                    'filename'  => $filename,
                    'path'      => $localPath,
                ]);
                continue;
            }

            $files[] = [
                'local_path'    => $localPath,
                'original_name' => $filename,
                'target_folder' => 'custom_fields',
                'column'        => $filename, // use filename as identifier for multi-file replacement
            ];
        }

        return $files;
    }

    public function applyResult(object $record, string $column, array $uploadResult): void
    {
        // Re-fetch the current value (it may have been partially updated by a previous file in the same record)
        $currentValue = DB::table('custom_fields_data')
            ->where('id', $record->id)
            ->value('value');

        if ($currentValue === null) {
            return;
        }

        $filenames = $this->parseFileValue($currentValue);
        $downloadUrl = $uploadResult['downloadUrl'];

        if (count($filenames) <= 1) {
            // Single file — replace the entire value
            DB::table('custom_fields_data')
                ->where('id', $record->id)
                ->update(['value' => $downloadUrl]);
        } else {
            // Multi-file — replace the specific filename ($column) with the URL
            $updatedFiles = array_map(function ($f) use ($column, $downloadUrl) {
                return $f === $column ? $downloadUrl : $f;
            }, $filenames);

            // Check if all files are now URLs — if so, store the last one as single or keep as JSON
            $allUrls = collect($updatedFiles)->every(fn($f) => str_starts_with($f, 'http'));

            $newValue = count($updatedFiles) === 1
                ? $updatedFiles[0]
                : json_encode(array_values($updatedFiles));

            DB::table('custom_fields_data')
                ->where('id', $record->id)
                ->update(['value' => $newValue]);
        }
    }

    public function findById(int $id): ?object
    {
        return DB::table('custom_fields_data')
            ->join('custom_fields', 'custom_fields_data.custom_field_id', '=', 'custom_fields.id')
            ->where('custom_fields_data.id', $id)
            ->where('custom_fields.type', 'file')
            ->select([
                'custom_fields_data.id',
                'custom_fields_data.custom_field_id',
                'custom_fields_data.model',
                'custom_fields_data.model_id',
                'custom_fields_data.value',
            ])
            ->first();
    }

    /**
     * Parse the value column into an array of filenames/URLs.
     */
    protected function parseFileValue(string $value): array
    {
        // Try JSON array first
        $decoded = json_decode($value, true);
        if (is_array($decoded)) {
            return array_values(array_filter($decoded, fn($f) => is_string($f) && $f !== ''));
        }

        // Comma-separated
        if (str_contains($value, ',')) {
            $parts = array_filter(array_map('trim', explode(',', $value)), fn($f) => $f !== '');
            if (count($parts) > 1 && collect($parts)->every(fn($p) => str_contains($p, '.'))) {
                return array_values($parts);
            }
        }

        // Single value
        return [$value];
    }
}
