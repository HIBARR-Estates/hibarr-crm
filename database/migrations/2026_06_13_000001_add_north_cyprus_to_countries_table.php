<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * North Cyprus has no ISO 3166-1 alpha-2 code; XN is used as a custom code
     * (confirm with product before release).
     */
    private const ISO = 'XN';

    private const NICENAME = 'North Cyprus';

    public function up(): void
    {
        $exists = DB::table('countries')
            ->where(function ($query) {
                $query->where('iso', self::ISO)
                    ->orWhere('nicename', self::NICENAME);
            })
            ->exists();

        if ($exists) {
            return;
        }

        DB::table('countries')->insert([
            'iso'       => self::ISO,
            'name'      => 'NORTH CYPRUS',
            'nicename'  => self::NICENAME,
            'iso3'      => null,
            'numcode'   => null,
            'phonecode' => 90,
        ]);

        Cache::forget('countries');
        Cache::forget('countries_list');
    }

    public function down(): void
    {
        DB::table('countries')
            ->where(function ($query) {
                $query->where('iso', self::ISO)
                    ->orWhere('nicename', self::NICENAME);
            })
            ->delete();

        Cache::forget('countries');
        Cache::forget('countries_list');
    }
};
