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
        Schema::create('taskables', function (Blueprint $table) {
            $table->id();
            $table->integer('task_id')->unsigned();
            $table->foreign('task_id')->references('id')->on('tasks')->onDelete('cascade')->onUpdate('cascade');
            $table->integer('taskable_id')->unsigned();
            $table->string('taskable_type');
            $table->timestamps();

            $table->index(['taskable_id', 'taskable_type']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('taskables');
    }
};
