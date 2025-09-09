<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{

    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::table('zoom_setting', function (Blueprint $table) {
            $table->string('account_id')->nullable();
            $table->string('meeting_client_id')->nullable();
            $table->string('meeting_client_secret')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('zoom_setting', function (Blueprint $table) {
            $table->dropColumn(['account_id', 'meeting_client_id', 'meeting_client_secret']);
        });
    }

};
