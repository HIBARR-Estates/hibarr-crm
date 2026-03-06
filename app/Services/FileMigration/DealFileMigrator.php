<?php

namespace App\Services\FileMigration;

use App\Models\DealFile;
use Illuminate\Database\Query\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Migrates deal_files records from local/S3 storage to external storage.
 *
 * Source path: public/user-uploads/lead-files/{deal_id}/{hashname}
 * Target:     external API → external_url + object_path columns
 */
class DealFileMigrator implements FileMigratorInterface
{
    public function getName(): string
    {
        return 'deal_files';
    }

    public function getDescription(): string
    {
        return 'Deal file attachments (deal_files table)';
    }

    public function queryUnmigrated(): Builder
    {
        return DB::table('deal_files')
            ->whereNull('external_url')
            ->whereNotNull('hashname')
            ->where('hashname', '!=', '')
            ->select(['id', 'deal_id', 'filename', 'hashname', 'size']);
    }

    public function resolveFiles(object $record): array
    {
        $localPath = public_path('user-uploads/' . DealFile::FILE_PATH . '/' . $record->deal_id . '/' . $record->hashname);

        if (!file_exists($localPath)) {
            return [];
        }

        return [
            [
                'local_path'    => $localPath,
                'original_name' => $record->filename ?: $record->hashname,
                'target_folder' => DealFile::FILE_PATH,
                'column'        => 'hashname', // identifies which file column
            ],
        ];
    }

    public function applyResult(object $record, string $column, array $uploadResult): void
    {
        DB::table('deal_files')
            ->where('id', $record->id)
            ->update([
                'external_url' => $uploadResult['downloadUrl'],
                'object_path'  => $uploadResult['objectPath'],
                'updated_at'   => now(),
            ]);
    }

    public function findById(int $id): ?object
    {
        return DB::table('deal_files')
            ->where('id', $id)
            ->select(['id', 'deal_id', 'filename', 'hashname', 'size'])
            ->first();
    }
}
