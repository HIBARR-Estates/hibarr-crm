<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('lead_qualification_action_runs')) {
            return;
        }

        Schema::create('lead_qualification_action_runs', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_qualification_id');
            $table->string('action_type', 64);
            $table->string('status', 32)->default('pending');
            $table->json('config')->nullable();
            $table->json('payload')->nullable();
            $table->text('error')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->timestamps();

            $table->foreign('lead_qualification_id', 'lq_action_runs_qualification_id_foreign')
                ->references('id')
                ->on('lead_qualifications')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->index(
                ['lead_qualification_id', 'action_type'],
                'lq_action_runs_qualification_type_index'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_qualification_action_runs');
    }
};
