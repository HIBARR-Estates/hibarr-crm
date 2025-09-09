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
        if (! Schema::hasColumn('payroll_settings', 'extra_fields')) {
            Schema::table('payroll_settings', function (Blueprint $table) {
                $table->text('extra_fields')->nullable();
            });

            Schema::table('employee_monthly_salaries', function (Blueprint $table) {
                $table->enum('allow_generate_payroll', ['yes', 'no'])->default('yes');
            });
        }
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('payroll_settings', function (Blueprint $table) {
            $table->dropColumn('extra_fields');
        });

        Schema::table('employee_monthly_salaries', function (Blueprint $table) {
            $table->dropColumn('allow_generate_payroll');
        });
    }
};
