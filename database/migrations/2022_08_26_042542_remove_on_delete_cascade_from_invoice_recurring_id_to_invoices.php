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
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            // SQLite cannot drop foreign key constraints in-place.
            // For test/memory SQLite we can safely skip this constraint rewrite.
            return;
        }

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign('invoices_invoice_recurring_id_foreign');
            $table->foreign('invoice_recurring_id')
                ->references('id')->on('invoice_recurring')
                ->onDelete('set null');
        });

    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        if (Schema::getConnection()->getDriverName() === 'sqlite') {
            return;
        }

        Schema::table('invoices', function (Blueprint $table) {
            $table->dropForeign('invoices_invoice_recurring_id_foreign');
        });
    }

};
