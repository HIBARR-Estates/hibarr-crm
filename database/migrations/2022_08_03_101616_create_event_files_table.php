<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {

    /**
     * Run the migrations.
     *
     * @return void
     */

    public function up()
    {
        Schema::create('event_files', function (Blueprint $table) {
            $table->increments('id');
            $table->integer('company_id')->unsigned()->nullable();
            $table->foreign('company_id')->references('id')->on('companies')->onDelete('cascade')->onUpdate('cascade');
            $table->integer('event_id')->unsigned();
            $table->foreign('event_id')
                ->references('id')
                ->on('events')
                ->onDelete('cascade')
                ->onUpdate('cascade');
            $table->string('filename', 200)->nullable();
            $table->string('hashname', 200)->nullable();
            $table->string('size', 200)->nullable();
            $table->integer('added_by')->unsigned()->nullable();
            $table->foreign('added_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');

            $table->integer('last_updated_by')->unsigned()->nullable();
            $table->foreign('last_updated_by')->references('id')->on('users')->onDelete('SET NULL')->onUpdate('cascade');
            $table->timestamps();
        });

        if (!Schema::hasColumn('events', 'event_link')) {
            Schema::table('events', function (Blueprint $table) {
                $table->string('event_link')->after('remind_type')->nullable();
            });
        }


        // SQLite cannot drop foreign keys in-place. On sqlite, Laravel will
        // rebuild the table when dropping the column, so we can safely skip
        // the explicit foreign key drop.
        if (Schema::getConnection()->getDriverName() !== 'sqlite') {
            Schema::table('proposal_templates', function (Blueprint $table) {
                $table->dropForeign(['lead_id']);
            });
        }

        // SQLite doesn't allow multiple dropColumn calls in a single schema modification.
        Schema::table('proposal_templates', function (Blueprint $table) {
            $table->dropColumn('lead_id');
        });

        Schema::table('proposal_templates', function (Blueprint $table) {
            $table->dropColumn('note');
        });

        Schema::table('proposal_templates', function (Blueprint $table) {
            $table->dropColumn('calculate_tax');
        });

        Schema::table('proposal_templates', function (Blueprint $table) {
            $table->dropColumn('status');
        });

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('event_files');
    }

};
