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
        Schema::table('properties', function (Blueprint $table) {
            $table->string('slug', 255)->nullable()->after('title');
        });

        // Unique slug per company
        Schema::table('properties', function (Blueprint $table) {
            $table->unique(['company_id', 'slug'], 'properties_company_id_slug_unique');
        });

        // Backfill existing rows: slug from title, with unique suffix if needed
        $properties = DB::table('properties')->get();
        foreach ($properties as $row) {
            $base = Str::slug($row->title ?: 'property');
            if ($base === '') {
                $base = 'property';
            }
            $slug = $base;
            $attempt = 0;
            while (true) {
                $exists = DB::table('properties')
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
            DB::table('properties')->where('id', $row->id)->update(['slug' => $slug]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('properties', function (Blueprint $table) {
            $table->dropUnique('properties_company_id_slug_unique');
            $table->dropColumn('slug');
        });
    }
};
