<?php

namespace Database\Seeders;

use App\Models\Company;
use App\Models\MeetingType;
use Illuminate\Database\Seeder;

class MeetingTypeSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $companies = Company::all();

        foreach ($companies as $company) {
            $meetingTypes = [
                [
                    'name' => 'Kick Off',
                    'description' => 'Initial project kick-off meeting',
                    'color' => '#1d82f5',
                    'company_id' => $company->id
                ],
                [
                    'name' => 'Strategy',
                    'description' => 'Strategic planning and discussion meeting',
                    'color' => '#28a745',
                    'company_id' => $company->id
                ],
                [
                    'name' => 'Review',
                    'description' => 'Progress review and status update meeting',
                    'color' => '#ffc107',
                    'company_id' => $company->id
                ],
                [
                    'name' => 'Presentation',
                    'description' => 'Client presentation or demo meeting',
                    'color' => '#dc3545',
                    'company_id' => $company->id
                ],
                [
                    'name' => 'Follow Up',
                    'description' => 'General follow-up meeting',
                    'color' => '#6c757d',
                    'company_id' => $company->id
                ]
            ];

            foreach ($meetingTypes as $meetingType) {
                MeetingType::firstOrCreate(
                    [
                        'name' => $meetingType['name'],
                        'company_id' => $company->id
                    ],
                    $meetingType
                );
            }
        }
    }
}
