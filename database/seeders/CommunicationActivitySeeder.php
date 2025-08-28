<?php

namespace Database\Seeders;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use Illuminate\Database\Seeder;

class CommunicationActivitySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Get some deals and leads to associate with
        $deals = Deal::take(5)->get();
        $leads = Lead::take(5)->get();

        // Create communication activities for deals
        foreach ($deals as $deal) {
            CommunicationActivity::factory()
                ->count(rand(3, 8))
                ->forDeal($deal)
                ->create();
        }

        // Create communication activities for leads
        foreach ($leads as $lead) {
            CommunicationActivity::factory()
                ->count(rand(2, 6))
                ->forLead($lead)
                ->create();
        }

        // Create some specific channel types
        if ($deals->count() > 0) {
            $deal = $deals->first();
            
            CommunicationActivity::factory()
                ->count(3)
                ->email()
                ->forDeal($deal)
                ->create();

            CommunicationActivity::factory()
                ->count(2)
                ->whatsapp()
                ->forDeal($deal)
                ->create();
        }

        if ($leads->count() > 0) {
            $lead = $leads->first();
            
            CommunicationActivity::factory()
                ->count(2)
                ->instagram()
                ->forLead($lead)
                ->create();

            CommunicationActivity::factory()
                ->count(2)
                ->telegram()
                ->forLead($lead)
                ->create();
        }
    }
} 