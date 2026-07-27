<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->string('slug', 255)->nullable()->after('name');
        });

        Schema::table('developer_projects', function (Blueprint $table) {
            $table->unique(['company_id', 'slug'], 'developer_projects_company_id_slug_unique');
        });

        DB::table('developer_projects')->orderBy('id')->chunkById(100, function ($rows) {
            foreach ($rows as $row) {
                $base = Str::slug($row->name ?: 'project');
                if ($base === '') {
                    $base = 'project';
                }
                $slug = $base;
                $attempt = 0;
                while (true) {
                    $exists = DB::table('developer_projects')
                        ->where('company_id', $row->company_id)
                        ->where('slug', $slug)
                        ->where('id', '!=', $row->id)
                        ->exists();
                    if (!$exists) {
                        break;
                    }
                    $slug = $base . '-' . Str::lower(Str::random(4));
                    $attempt++;
                    if ($attempt > 100) {
                        $slug = $base . '-' . $row->id;
                        break;
                    }
                }
                DB::table('developer_projects')->where('id', $row->id)->update(['slug' => $slug]);
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('developer_projects', function (Blueprint $table) {
            $table->dropUnique('developer_projects_company_id_slug_unique');
            $table->dropColumn('slug');
        });
    }
};
