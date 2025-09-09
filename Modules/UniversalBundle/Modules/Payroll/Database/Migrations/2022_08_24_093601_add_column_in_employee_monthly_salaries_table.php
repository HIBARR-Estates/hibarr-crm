<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('employee_monthly_salaries', function (Blueprint $table) {
            $table->string('annual_salary')->after('user_id')->nullable();
            $table->string('basic_salary')->after('amount')->nullable();
            $table->enum('basic_value_type', ['fixed', 'ctc_percent'])->default(null)->after('basic_salary')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('', function (Blueprint $table) {

        });
    }
};
