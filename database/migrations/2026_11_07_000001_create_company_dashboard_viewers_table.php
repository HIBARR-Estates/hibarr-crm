<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The people who may open the Company dashboard (?view=leadership).
 *
 * Access used to come from the view_leadership_dashboard permission, which
 * every admin and the leadership role held by default. It is now a hand-picked
 * list per company, managed by admins in Settings. Admins are not let in
 * automatically: they see the Company view only when they are on the list too.
 *
 * The list starts empty, so after this runs nobody sees the Company view until
 * an admin adds people.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('company_dashboard_viewers')) {
            return;
        }

        Schema::create('company_dashboard_viewers', function (Blueprint $table) {
            $table->id();
            $table->unsignedInteger('company_id');
            $table->unsignedInteger('user_id');
            // Who put them on the list.
            $table->unsignedInteger('added_by')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'user_id'], 'company_dashboard_viewers_company_user_unique');

            $table->foreign('company_id')->references('id')->on('companies')->cascadeOnDelete();
            $table->foreign('user_id')->references('id')->on('users')->cascadeOnDelete();
            $table->foreign('added_by')->references('id')->on('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_dashboard_viewers');
    }
};
