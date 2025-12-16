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
        if (!Schema::hasColumn('leads', 'type')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->enum('type', ['agent', 'customer'])->default('customer')->nullable(false)->after('company_id');
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
        if (Schema::hasColumn('leads', 'type')) {
            Schema::table('leads', function (Blueprint $table) {
                $table->dropColumn('type');
            });
        }
    }
};
