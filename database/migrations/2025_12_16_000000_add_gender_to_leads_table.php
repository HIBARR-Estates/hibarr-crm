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
        if (!Schema::hasColumn('leads', 'gender')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->enum('gender', ['male', 'female'])->nullable()->after('salutation');
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
        if (Schema::hasColumn('leads', 'gender')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropColumn('gender');
            });
        }
    }
};

