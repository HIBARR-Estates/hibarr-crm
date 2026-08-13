<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const COLUMN = 'integration_origin';

    /** @var list<string> */
    private array $tables = [
        'tasks',
        'deal_notes',
        'lead_notes',
    ];

    /**
     * Tables this migration added integration_origin to in the current process.
     *
     * @var list<string>
     */
    private array $ownedTables = [];

    public function up(): void
    {
        try {
            foreach ($this->tables as $table) {
                if (! Schema::hasTable($table)) {
                    throw new RuntimeException("Required table [{$table}] does not exist.");
                }

                if (Schema::hasColumn($table, self::COLUMN)) {
                    throw new RuntimeException(
                        'Column ['.self::COLUMN."] already exists on [{$table}]; this migration will not claim ownership of a pre-existing column."
                    );
                }

                Schema::table($table, function (Blueprint $blueprint) {
                    $blueprint->string(self::COLUMN, 50)->nullable();
                });

                $this->ownedTables[] = $table;
            }
        } catch (Throwable $e) {
            $this->dropOwnedColumns();
            throw $e;
        }
    }

    public function down(): void
    {
        // Successful up() owns integration_origin on every declared table. Drop only
        // those; do not probe/skip — a missing column here is a real inconsistency.
        foreach ($this->tables as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn(self::COLUMN);
            });
        }
    }

    private function dropOwnedColumns(): void
    {
        foreach ($this->ownedTables as $table) {
            Schema::table($table, function (Blueprint $blueprint) {
                $blueprint->dropColumn(self::COLUMN);
            });
        }

        $this->ownedTables = [];
    }
};
