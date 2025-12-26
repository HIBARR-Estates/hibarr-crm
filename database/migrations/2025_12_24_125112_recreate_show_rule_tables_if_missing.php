<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Only create tables if they don't exist
        if (!Schema::hasTable('show_rule_sets')) {
            Schema::create('show_rule_sets', function (Blueprint $table) {
                $table->id();
                $table->unsignedInteger('field_id');
                $table->boolean('default_visibility')->default(true);
                $table->boolean('enabled')->default(true);
                $table->timestamps();
                
                $table->foreign('field_id')->references('id')->on('custom_fields')->onDelete('cascade');
                $table->unique('field_id', 'unique_field_rule_set');
            });
        }

        if (!Schema::hasTable('show_rule_groups')) {
            Schema::create('show_rule_groups', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('rule_set_id');
                $table->enum('group_operator', ['AND', 'OR'])->default('AND');
                $table->boolean('enabled')->default(true);
                $table->enum('visibility_action', ['show', 'hide'])->default('show');
                $table->timestamps();
                
                $table->foreign('rule_set_id')->references('id')->on('show_rule_sets')->onDelete('cascade');
                $table->index('rule_set_id', 'idx_rule_set');
            });
        }

        if (!Schema::hasTable('show_criteria')) {
            Schema::create('show_criteria', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('group_id');
                $table->unsignedInteger('reference_field_id');
                $table->enum('operator', ['equals', 'exists', 'boolean', '>', '<', '>=', '<=', 'in', 'not_in']);
                $table->text('reference_value')->nullable();
                $table->boolean('negate')->default(false);
                $table->timestamps();
                
                $table->foreign('group_id')->references('id')->on('show_rule_groups')->onDelete('cascade');
                $table->foreign('reference_field_id')->references('id')->on('custom_fields')->onDelete('cascade');
                $table->index('group_id', 'idx_group');
                $table->index('reference_field_id', 'idx_reference_field');
            });
        }

        // Add columns to custom_fields if they don't exist
        if (Schema::hasTable('custom_fields')) {
            if (!Schema::hasColumn('custom_fields', 'important_flag')) {
                Schema::table('custom_fields', function (Blueprint $table) {
                    $table->boolean('important_flag')->default(false)->after('visible');
                });
            }
            if (!Schema::hasColumn('custom_fields', 'display_order')) {
                Schema::table('custom_fields', function (Blueprint $table) {
                    $table->integer('display_order')->default(0)->after('important_flag');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Don't drop tables in down() - let the original migrations handle that
    }
};
