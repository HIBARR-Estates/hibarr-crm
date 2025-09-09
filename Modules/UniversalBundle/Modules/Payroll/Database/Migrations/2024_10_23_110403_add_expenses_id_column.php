<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (!Schema::hasColumn('salary_slips', 'expense_id')) {
            Schema::table('salary_slips', function (Blueprint $table) {
                $table->integer('expense_id')->unsigned()->nullable();
                $table->foreign('expense_id')->references('id')
                    ->on('expenses')->onDelete('cascade')->onUpdate('cascade');
            });

        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('', function (Blueprint $table) {

        });
    }

};
