<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;


class ApiTokenSeeder extends Seeder
{
     /**
     * Run the database seeds.
     */
    public function run(): void
    {
        DB::table('api_tokens')->insert([
            [
                'token' => hash('sha256', Str::random(60)), 
                'name' => 'CRM Integration for Communication Activities',
                'revoked' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
          
        ]);
    }
}
