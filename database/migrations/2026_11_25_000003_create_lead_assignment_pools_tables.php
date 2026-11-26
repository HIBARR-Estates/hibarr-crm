<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Pools of users a lead can be handed to, in turn, by the assign_lead_owner automation action.
     * `last_member_id` is the round-robin cursor: the next lead goes to the first eligible member
     * after it (by id), wrapping around, so adding or removing members never skips or repeats one.
     */
    public function up(): void
    {
        Schema::create('lead_assignment_pools', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id')->index();
            $table->string('name', 191);
            $table->string('strategy', 24)->default('round_robin');
            $table->unsignedBigInteger('last_member_id')->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::create('lead_assignment_pool_members', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('pool_id');
            $table->unsignedInteger('user_id');
            $table->unsignedSmallInteger('weight')->default(1);
            // Off = away: skipped without removing the person from the pool.
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['pool_id', 'user_id']);
            $table->foreign('pool_id')->references('id')->on('lead_assignment_pools')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_assignment_pool_members');
        Schema::dropIfExists('lead_assignment_pools');
    }
};
