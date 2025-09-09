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
        if (! Schema::hasColumn('salary_components', 'weekly_value')) {
            Schema::table('salary_components', function (Blueprint $table) {
                $table->double('weekly_value')->default(0);
                $table->double('biweekly_value')->default(0);
                $table->double('semimonthly_value')->default(0);
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

    }
};
