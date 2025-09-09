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
        if (! Schema::hasColumn('zoom_setting', 'purchase_code')) {
            Schema::table('zoom_setting', function (Blueprint $table) {
                $table->string('purchase_code')->nullable();
                $table->timestamp('supported_until')->nullable();
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
        Schema::table('zoom_setting', function (Blueprint $table) {
            $table->dropColumn(['purchase_code', 'supported_until']);
        });
    }
};
