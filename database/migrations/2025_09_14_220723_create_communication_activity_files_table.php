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
        Schema::create('communication_activity_files', function (Blueprint $table) {
            $table->id();
            // activity_id, file_url, file_name, file_type
            $table->unsignedBigInteger('activity_id');
            $table->string('file_url');
            $table->string('file_type')->nullable();
            $table->integer('file_size')->nullable();
            // link to communication_activities table
            $table->foreign('activity_id')->references('id')->on('communication_activities')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('communication_activity_files', function (Blueprint $table) {
            $table->dropForeign(['activity_id']);
        });
        Schema::dropIfExists('communication_activity_files');
    }
};
