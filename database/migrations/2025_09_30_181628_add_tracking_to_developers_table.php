<?php
// database/migrations/2025_09_30_add_tracking_to_developers_table.php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('developers', function (Blueprint $table) {


        
            $table->integer('added_by')->unsigned()->nullable()->after('description');
            $table->integer('last_updated_by')->unsigned()->nullable()->after('added_by');
            $table->integer('assigned_to')->unsigned()->nullable()->after('last_updated_by');
            

            // give foreign key names to track properly
            $table->foreign('added_by', 'developers_added_by_fk')->references('id')->on('users')->onDelete('set null');
            $table->foreign('last_updated_by', 'developers_last_updated_by_fk')->references('id')->on('users')->onDelete('set null');
            $table->foreign('assigned_to', 'developers_assigned_to_fk')->references('id')->on('users')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::table('developers', function (Blueprint $table) {
            // drop foreign keys by their names
            $table->dropForeign('developers_added_by_fk');
            $table->dropForeign('developers_last_updated_by_fk');
            $table->dropForeign('developers_assigned_to_fk');
            $table->dropColumn(['added_by', 'last_updated_by', 'assigned_to']);
        });
    }
};