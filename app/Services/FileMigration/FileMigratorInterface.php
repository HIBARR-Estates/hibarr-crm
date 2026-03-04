<?php

namespace App\Services\FileMigration;

use Illuminate\Database\Query\Builder;

/**
 * FileMigratorInterface
 *
 * Strategy interface that each model-specific migrator must implement.
 * Defines how to discover, locate, upload, and update file records
 * for a particular model/table so the central migration service
 * can orchestrate them uniformly.
 *
 * To add a new model:
 *  1. Create a class implementing this interface
 *  2. Register it in the Artisan command or a service provider
 */
interface FileMigratorInterface
{
    /**
     * Unique identifier for this migrator (used in --model flag, logs, batch names).
     * e.g. 'deal_files', 'custom_field_files', 'hibarr_deal_documents'
     */
    public function getName(): string;

    /**
     * Human-readable description for CLI output.
     */
    public function getDescription(): string;

    /**
     * Return a query builder selecting records that have NOT yet been migrated.
     * The query MUST select at least an `id` column that uniquely identifies each record.
     */
    public function queryUnmigrated(): Builder;

    /**
     * Given a single unmigrated record (stdClass from the query), return an array
     * of file entries to upload.  Each entry is an associative array:
     *
     *   [
     *     'local_path'     => '/absolute/path/to/file.pdf',   // absolute path on disk
     *     'original_name'  => 'contract.pdf',                 // filename for the upload API
     *     'target_folder'  => 'lead-files',                   // external storage folder
     *     'column'         => 'hashname',                     // (optional) which column this maps to
     *   ]
     *
     * Returning multiple entries allows models with several file columns
     * (e.g. HibarrDealFields with 3 document cols) to be handled per record.
     * Return an empty array if no uploadable file can be resolved.
     *
     * @param  object  $record  stdClass row from queryUnmigrated()
     * @return array<int, array{local_path: string, original_name: string, target_folder: string, column?: string}>
     */
    public function resolveFiles(object $record): array;

    /**
     * Persist the upload result back to the database.
     *
     * @param  object  $record        The original DB record
     * @param  string  $column        The column identifier (from resolveFiles 'column' key, or default)
     * @param  array   $uploadResult  ['objectPath' => '...', 'originalName' => '...', 'downloadUrl' => '...']
     */
    public function applyResult(object $record, string $column, array $uploadResult): void;

    /**
     * Fetch a single record by its ID.
     * Returns null if the record no longer exists (deleted between dispatch and execution).
     */
    public function findById(int $id): ?object;
}
