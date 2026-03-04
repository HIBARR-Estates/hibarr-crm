<?php

namespace App\Services\FileMigration;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Migrates hibarr_deal_custom_fields document columns from local storage to external storage.
 *
 * Columns: deposit_confirmation, reservation_agreement, sales_contract
 * Source path: public/user-uploads/custom_fields/{filename}
 * Target:     each column updated to downloadUrl
 */
class HibarrDealFieldsMigrator implements FileMigratorInterface
{
    /**
     * The document columns that can hold file references.
     */
    public const DOCUMENT_COLUMNS = [
        'deposit_confirmation',
        'reservation_agreement',
        'sales_contract',
    ];

    public function getName(): string
    {
        return 'hibarr_deal_documents';
    }

    public function getDescription(): string
    {
        return 'Hibarr deal document fields (deposit_confirmation, reservation_agreement, sales_contract)';
    }

    /**
     * Non-file values that can appear in the document columns.
     * These are boolean-like strings, JSON blobs from failed uploads, etc.
     */
    protected const NON_FILE_PATTERNS = [
        'yes', 'no', 'true', 'false', 'n/a', 'na', 'none', 'pending',
    ];

    public function queryUnmigrated(): Builder
    {
        return DB::table('hibarr_deal_custom_fields')
            ->where(function ($query) {
                foreach (self::DOCUMENT_COLUMNS as $col) {
                    $query->orWhere(function ($q) use ($col) {
                        $q->whereNotNull($col)
                            ->where($col, '!=', '')
                            ->where($col, 'NOT LIKE', 'http://%')
                            ->where($col, 'NOT LIKE', 'https://%')
                            // Exclude JSON blobs (failed upload metadata)
                            ->where($col, 'NOT LIKE', '{%')
                            ->where($col, 'NOT LIKE', '[%');

                        // Exclude known non-file string values
                        foreach (self::NON_FILE_PATTERNS as $pattern) {
                            $q->where(DB::raw("LOWER({$col})"), '!=', $pattern);
                        }

                        // Must look like a filename (contains a dot for extension)
                        $q->where($col, 'LIKE', '%.%');
                    });
                }
            })
            ->select(array_merge(['id', 'deal_id'], self::DOCUMENT_COLUMNS));
    }

    public function resolveFiles(object $record): array
    {
        $files = [];

        foreach (self::DOCUMENT_COLUMNS as $col) {
            $value = $record->{$col} ?? null;

            if (!$this->isValidFilename($value)) {
                continue;
            }

            $localPath = public_path('user-uploads/custom_fields/' . $value);

            if (!file_exists($localPath)) {
                Log::warning('HibarrDealFieldsMigrator: Local file not found', [
                    'record_id' => $record->id,
                    'column'    => $col,
                    'filename'  => $value,
                    'path'      => $localPath,
                ]);
                continue;
            }

            $files[] = [
                'local_path'    => $localPath,
                'original_name' => $value,
                'target_folder' => 'custom_fields',
                'column'        => $col,
            ];
        }

        return $files;
    }

    /**
     * Check if a value looks like a valid filename (not a boolean string, JSON blob, or URL).
     */
    protected function isValidFilename(?string $value): bool
    {
        if (empty($value)) {
            return false;
        }

        // Already an external URL
        if (str_starts_with($value, 'http://') || str_starts_with($value, 'https://')) {
            return false;
        }

        // JSON object or array (failed upload metadata like {"uid":"rc-upload-..."})
        if (str_starts_with($value, '{') || str_starts_with($value, '[')) {
            return false;
        }

        // Known non-file string values
        if (in_array(strtolower(trim($value)), self::NON_FILE_PATTERNS, true)) {
            return false;
        }

        // Must contain a dot (filename.extension)
        if (!str_contains($value, '.')) {
            return false;
        }

        return true;
    }

    public function applyResult(object $record, string $column, array $uploadResult): void
    {
        if (!in_array($column, self::DOCUMENT_COLUMNS, true)) {
            Log::error('HibarrDealFieldsMigrator: Unknown column', ['column' => $column]);
            return;
        }

        DB::table('hibarr_deal_custom_fields')
            ->where('id', $record->id)
            ->update([
                $column      => $uploadResult['downloadUrl'],
                'updated_at' => now(),
            ]);
    }

    public function findById(int $id): ?object
    {
        return DB::table('hibarr_deal_custom_fields')
            ->where('id', $id)
            ->select(array_merge(['id', 'deal_id'], self::DOCUMENT_COLUMNS))
            ->first();
    }
}
