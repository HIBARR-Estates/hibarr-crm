<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->unsignedBigInteger('developer_id')->nullable()->after('company_id');

            $table->foreign('developer_id')->references('id')->on('developers')->nullOnDelete();
            $table->index('developer_id');
        });
    }

    public function down(): void
    {
        Schema::table('offers', function (Blueprint $table) {
            $table->dropForeign(['developer_id']);
            $table->dropIndex(['developer_id']);
            $table->dropColumn('developer_id');
        });
    }
};
