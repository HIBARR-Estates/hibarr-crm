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
        Schema::table('zoom_meetings', function (Blueprint $table) {
            $table->unsignedBigInteger('source_meeting_id')->nullable();
            $table->foreign('source_meeting_id')->references('id')->on('zoom_meetings')->onDelete('cascade')->onUpdate('cascade');
            $table->bigInteger('occurrence_id')->nullable();
            $table->integer('occurrence_order')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::table('zoom_meetings', function (Blueprint $table) {
            $table->dropForeign(['source_meeting_id']);
            $table->dropColumn(['source_meeting_id', 'occurrence_id', 'occurrence_order']);
        });
    }
};
