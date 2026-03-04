<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Add external storage columns to deal_files table.
     *
     * New files uploaded via the external FileStorageService will populate
     * external_url and object_path. Existing files continue using hashname.
     * The DealFile model's file_url accessor uses dual-support logic:
     * if external_url is set, return it; otherwise fall back to local/S3.
     */
    public function up(): void
    {
        Schema::table('deal_files', function (Blueprint $table) {
            $table->text('external_url')->nullable()->after('hashname')
                ->comment('Full download URL from external storage service');
            $table->string('object_path', 500)->nullable()->after('external_url')
                ->comment('Object path in external storage (used for deletion)');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('deal_files', function (Blueprint $table) {
            $table->dropColumn(['external_url', 'object_path']);
        });
    }
};
