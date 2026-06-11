<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('lead_qualification_answers')) {
            return;
        }

        Schema::create('lead_qualification_answers', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lead_qualification_id');
            $table->string('segment_key');
            $table->json('answer_values');
            $table->text('answer_text')->nullable();
            $table->timestamps();

            $table->foreign('lead_qualification_id', 'lead_qualification_answers_qualification_id_foreign')
                ->references('id')
                ->on('lead_qualifications')
                ->onUpdate('cascade')
                ->onDelete('cascade');

            $table->index('segment_key', 'lead_qualification_answers_segment_key_index');
            $table->index(
                ['lead_qualification_id', 'segment_key'],
                'lead_qualification_answers_qualification_segment_index'
            );
            $table->unique(
                ['lead_qualification_id', 'segment_key'],
                'lead_qualification_answers_qualification_segment_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_qualification_answers');
    }
};
