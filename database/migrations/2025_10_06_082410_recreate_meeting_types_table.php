<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // First, check and drop foreign key constraints that reference meeting_types
        if (Schema::hasTable('meeting_summary')) {
            Schema::table('meeting_summary', function (Blueprint $table) {
                // Use the correct foreign key constraint name from the meeting_summary migration
                if ($this->foreignKeyExists('meeting_summary', 'fk_meeting_summary_meeting_type_id')) {
                    $table->dropForeign('fk_meeting_summary_meeting_type_id');
                }
            });
        }

        // Also check lead_follow_up table for foreign key constraints
        if (Schema::hasTable('lead_follow_up')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                // Check if column exists and drop the foreign key
                if (Schema::hasColumn('lead_follow_up', 'meeting_type_id')) {
                    if ($this->foreignKeyExists('lead_follow_up', 'fk_lead_follow_up_meeting_type_id')) {
                        $table->dropForeign('fk_lead_follow_up_meeting_type_id');
                    }
                }
            });
        }

        // Now safely drop and recreate the meeting_types table
        Schema::dropIfExists('meeting_types');
        
        Schema::create('meeting_types', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('color', 7)->default('#1d82f5'); // Hex color code
            $table->unsignedInteger('company_id')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            // Explicit foreign key naming
            $table->foreign('company_id', 'fk_meeting_types_company_id')
                  ->references('id')
                  ->on('companies')
                  ->onDelete('cascade');
        });

        // Recreate the foreign key constraints after recreating the table
        if (Schema::hasTable('meeting_summary')) {
            Schema::table('meeting_summary', function (Blueprint $table) {
                if (Schema::hasColumn('meeting_summary', 'meeting_type_id')) {
                    $table->foreign('meeting_type_id', 'fk_meeting_summary_meeting_type_id')
                          ->references('id')
                          ->on('meeting_types')
                          ->onDelete('set null'); // Match the original constraint
                }
            });
        }

        if (Schema::hasTable('lead_follow_up')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                if (Schema::hasColumn('lead_follow_up', 'meeting_type_id')) {
                    $table->foreign('meeting_type_id', 'fk_lead_follow_up_meeting_type_id')
                          ->references('id')
                          ->on('meeting_types')
                          ->onDelete('cascade');
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop foreign key constraints first (using correct constraint names)
        if (Schema::hasTable('meeting_summary')) {
            Schema::table('meeting_summary', function (Blueprint $table) {
                if ($this->foreignKeyExists('meeting_summary', 'fk_meeting_summary_meeting_type_id')) {
                    $table->dropForeign('fk_meeting_summary_meeting_type_id');
                }
            });
        }

        if (Schema::hasTable('lead_follow_up')) {
            Schema::table('lead_follow_up', function (Blueprint $table) {
                if (Schema::hasColumn('lead_follow_up', 'meeting_type_id') && 
                    $this->foreignKeyExists('lead_follow_up', 'fk_lead_follow_up_meeting_type_id')) {
                    $table->dropForeign('fk_lead_follow_up_meeting_type_id');
                }
            });
        }

        // Now safely drop the table
        Schema::dropIfExists('meeting_types');
    }

    /**
     * Check if a foreign key constraint exists by name
     */
    private function foreignKeyExists(string $table, string $constraintName): bool
    {
        $databaseName = DB::connection()->getDatabaseName();
        
        $result = DB::select("
            SELECT CONSTRAINT_NAME 
            FROM information_schema.TABLE_CONSTRAINTS 
            WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ? 
            AND CONSTRAINT_NAME = ?
            AND CONSTRAINT_TYPE = 'FOREIGN KEY'
        ", [$databaseName, $table, $constraintName]);

        return !empty($result);
    }
};