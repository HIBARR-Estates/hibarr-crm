<?php

namespace App\Exports;

use App\Models\CustomField;
use App\Models\CustomFieldGroup;
use App\Models\LeadPipeline;
use App\Models\PipelineStage;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithColumnFormatting;
use Maatwebsite\Excel\Concerns\WithEvents;
use Maatwebsite\Excel\Events\AfterSheet;
use PhpOffice\PhpSpreadsheet\Style\NumberFormat;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class DealSampleExport implements FromCollection, WithHeadings, WithColumnFormatting, WithEvents
{
    protected $companyId;

    public function __construct($companyId)
    {
        $this->companyId = $companyId;
    }

    /**
     * Return sample data for the Excel file
     */
    public function collection()
    {
        $customFields = $this->getCustomFields();
        $stages = $this->getAllStages();
        $stageCount = count($stages);
        
        // Generate multiple sample rows with actual data
        $sampleRows = [];
        
        $dealNames = [
            'Bennie Wunsch Deal',
            'Dayne Towne V Deal',
            'Mrs. Willow Keeling Deal',
            'Freida Veum Deal',
            'Prof. Maxwell Strosin Deal',
            'Mr. Alfredo Hirthe III Deal',
            'Camille Legros DDS Deal',
            'Enterprise Software License',
            'Marketing Campaign Package',
            'Consulting Services Contract',
            'Annual Subscription Renewal',
        ];
        
        $emails = [
            'bennie@example.com',
            'dayne@example.com',
            'willow@example.com',
            'freida@example.com',
            'maxwell@example.com',
            'alfredo@example.com',
            'camille@example.com',
            'enterprise@example.com',
            'marketing@example.com',
            'consulting@example.com',
            'subscription@example.com',
        ];
        
        $leadNames = [
            'Bennie Wunsch',
            'Dayne Towne V',
            'Mrs. Willow Keeling',
            'Freida Veum',
            'Prof. Maxwell Strosin',
            'Mr. Alfredo Hirthe III',
            'Camille Legros DDS',
            'John Enterprise',
            'Sarah Marketing',
            'Mike Consulting',
            'Anna Subscription',
        ];
        
        $values = [46787, 69230, 32044, 38321, 15840, 73958, 71490, 25556, 3185, 76817, 70298];
        
        // Get default pipeline
        $pipeline = LeadPipeline::where('default', 1)
            ->where('company_id', $this->companyId)
            ->first();
        $pipelineName = $pipeline ? $pipeline->name : 'Sales Pipeline';
        
        // Agent names demonstrating the email convention
        $agentNames = [
            'Rabih Rabea',      // r.r@hibarr.de
            'Shirin',           // shirin@hibarr.de
            'John Doe',         // john.d@hibarr.de
            'Sarah Smith',      // sarah.s@hibarr.de
            'Michael Brown',    // michael.b@hibarr.de
            'Emily Johnson',    // emily.j@hibarr.de
            'Rabih Rabea',      // r.r@hibarr.de
            'David Wilson',     // david.w@hibarr.de
            'Shirin',           // shirin@hibarr.de
            'Anna Mueller',     // anna.m@hibarr.de
            'Thomas Weber',     // thomas.w@hibarr.de
        ];
        
        foreach ($dealNames as $index => $dealName) {
            if ($stageCount > 0) {
                $stage = $stages[$index % $stageCount];
            } else {
                $stage = 'Prospect';
            }
            
            $row = [
                $dealName,                                      // Deal Name
                $emails[$index],                               // Lead Contact Email
                $leadNames[$index],                            // Lead Name
                $pipelineName,                                 // Pipeline
                number_format($values[$index], 2, '.', ''),   // Value
                now()->addDays(rand(1, 30))->format('Y-m-d'), // Close Date
                $stage,                                        // Deal Stage
                $agentNames[$index],                           // Responsible Agent Name
                
                // Marketing fields
                'google',                                      // UTM Source
                'cpc',                                        // UTM Medium
                'summer_campaign',                            // UTM Campaign
                'real estate deals',                          // UTM Term
                'banner_ad',                                  // UTM Content
                'buyers',                                     // UTM Audience
                'source_' . ($index + 1),                     // Traffic Source ID
                'fb_click_' . rand(1000, 9999),              // Facebook Click ID
                'fb_lead_' . rand(1000, 9999),               // Facebook Lead ID
                $index % 2 ? 'Yes' : 'No',                   // Registered for Webinar
                $index % 3 ? 'Yes' : 'No',                   // Joined Facebook Group
                $index % 2 ? 'Yes' : 'No',                   // Downloaded Ebook
                $index % 3 ? 'Yes' : 'No',                   // Attended Webinar
                $index % 2 ? 'Yes' : 'No',                   // Registered for Zoom
                now()->subDays(rand(1, 30))->format('Y-m-d'), // Last Webinar Date
                rand(50, 100),                               // Contact Score
                
                // Hibarr Deal Custom Fields
                $index % 3 == 0 ? 'Beachfront Property' : ($index % 3 == 1 ? 'Mountain View' : 'City Center'), // Interested In
                'Looking for investment property',                                                              // Motivation/Comment
                ['Immediate', '3-6 months', '6-12 months', '12+ months'][$index % 4],                        // Purchase Timeline
                ['$200k-$300k', '$300k-$500k', '$500k-$1M', '$1M+'][$index % 4],                            // Budget Range
                $index % 2 ? 'Yes' : 'No',                                                                     // Strategy Meeting Booked
                $index % 3 ? 'Yes' : 'No',                                                                     // Downpayment Paid
                $index % 2 ? now()->addDays(rand(5, 20))->format('Y-m-d') : '',                              // Inspection Trip Date
                '',                                                                                             // Deposit Confirmation
                '',                                                                                             // Reservation Agreement
                '',                                                                                             // Sales Contract
            ];
            
            // Add sample data for custom fields
            foreach ($customFields as $fieldIndex => $customField) {
                $row[] = $this->getSampleValueForField($customField, $index);
            }
            
            $sampleRows[] = $row;
        }

        return new Collection($sampleRows);
    }
    
    /**
     * Generate sample value for a custom field
     */
    private function getSampleValueForField($customField, $rowIndex)
    {
        switch ($customField->type) {
            case 'text':
                return 'Sample text ' . ($rowIndex + 1);
                
            case 'number':
                return rand(100, 1000);
                
            case 'date':
                return now()->addDays(rand(1, 60))->format('Y-m-d');
                
            case 'select':
            case 'radio':
                $options = json_decode($customField->values, true);
                if (is_array($options) && !empty($options)) {
                    return $options[$rowIndex % count($options)];
                }
                return 'Option 1';
                
            case 'checkbox':
                $options = json_decode($customField->values, true);
                if (is_array($options) && !empty($options)) {
                    $selectedCount = min(2, count($options));
                    $selected = array_slice($options, 0, $selectedCount);
                    return implode(', ', $selected);
                }
                return 'Option 1, Option 2';

            case 'multiSelectCountry':
                $countryNames = collect(\App\Models\Country::all())->pluck('nicename')->all();
                if (!empty($countryNames)) {
                    return implode(', ', array_slice($countryNames, 0, 2));
                }
                return 'Turkey, Germany';

            case 'textarea':
                return 'This is a longer text sample for row ' . ($rowIndex + 1);
                
            default:
                return 'Sample value';
        }
    }
    
    /**
     * Get all pipeline stages
     */
    private function getAllStages()
    {
        // Get stages from the default pipeline for this company
        $pipeline = LeadPipeline::where('default', 1)
            ->where('company_id', $this->companyId)
            ->first();
        
        if ($pipeline) {
            return PipelineStage::where('lead_pipeline_id', $pipeline->id)
                ->orderBy('priority')
                ->pluck('name')
                ->toArray();
        }
        
        // Fallback stages if no pipeline found
        return [
            'Generated',
            'Initial Contact',
            'Qualified',
            'Schedule Appointment',
            'Proposal Sent',
            'Negotiation',
            'Win',
            'Lost',
        ];
    }

    /**
     * Return headings for the Excel file
     * These must match the field IDs that the import expects
     */
    public function headings(): array
    {
        $headings = [
            'deal_name',
            'lead_contact_email',
            'lead_name',
            'pipeline',
            'deal_value',
            'close_date',
            'deal_stage',
            'responsible_name',
            
            // Marketing fields
            'utm_source',
            'utm_medium',
            'utm_campaign',
            'utm_term',
            'utm_content',
            'utm_audience',
            'traffic_source_id',
            'facebook_click_id',
            'facebook_lead_id',
            'has_registered_for_the_webinar',
            'has_joined_the_facebook_group',
            'has_downloaded_the_ebook',
            'has_attended_the_webinar',
            'registered_for_zoom_meeting',
            'last_webinar_date',
            'contact_score',
            
            // Hibarr Deal Custom Fields
            'interested_in',
            'motivation',
            'purchase_timeline',
            'budget_range',
            'strategy_meeting_booked',
            'downpayment_paid',
            'inspection_trip_date',
            'deposit_confirmation',
            'reservation_agreement',
            'sales_contract',
        ];

        // Add custom field headings using slugified labels (to match import field IDs)
        $customFields = $this->getCustomFields();
        
        foreach ($customFields as $customField) {
            // Slugify to match what import expects
            $headings[] = Str::slug($customField->label, '_');
        }

        return $headings;
    }

    /**
     * Format columns
     */
    public function columnFormats(): array
    {
        return [
            'E' => NumberFormat::FORMAT_NUMBER_COMMA_SEPARATED1, // Deal Value column
            'F' => NumberFormat::FORMAT_DATE_YYYYMMDD2,          // Close Date column
        ];
    }

    /**
     * Get custom fields for Deal model
     */
    private function getCustomFields()
    {
        $customFieldsGroupsId = CustomFieldGroup::where('model', 'App\Models\Deal')
            ->where('company_id', $this->companyId)
            ->select('id')
            ->first();

        if (!$customFieldsGroupsId) {
            return collect();
        }

        // Get ALL custom fields for the template (not just export = 1)
        return CustomField::where('custom_field_group_id', $customFieldsGroupsId->id)
            ->orderBy('id')
            ->get();
    }

    /**
     * Register events to add human-readable labels as comments
     */
    public function registerEvents(): array
    {
        return [
            AfterSheet::class => function(AfterSheet $event) {
                $sheet = $event->sheet->getDelegate();
                $customFields = $this->getCustomFields();
                
                // Map of technical headers to human labels
                $headerLabels = [
                    'deal_name' => 'Deal Name',
                    'lead_contact_email' => 'Lead Contact Email',
                    'lead_name' => 'Lead Name',
                    'pipeline' => 'Pipeline',
                    'deal_value' => 'Deal Value',
                    'close_date' => 'Close Date',
                    'deal_stage' => 'Deal Stage',
                    'responsible_name' => 'Responsible Agent Name',
                    
                    // Marketing field labels
                    'utm_source' => 'UTM Source',
                    'utm_medium' => 'UTM Medium',
                    'utm_campaign' => 'UTM Campaign',
                    'utm_term' => 'UTM Term',
                    'utm_content' => 'UTM Content',
                    'utm_audience' => 'UTM Audience',
                    'traffic_source_id' => 'Traffic Source ID',
                    'facebook_click_id' => 'Facebook Click ID',
                    'facebook_lead_id' => 'Facebook Lead ID',
                    'has_registered_for_the_webinar' => 'Registered for Webinar',
                    'has_joined_the_facebook_group' => 'Joined Facebook Group',
                    'has_downloaded_the_ebook' => 'Downloaded Ebook',
                    'has_attended_the_webinar' => 'Attended Webinar',
                    'registered_for_zoom_meeting' => 'Registered for Zoom Meeting',
                    'last_webinar_date' => 'Last Webinar Date',
                    'contact_score' => 'Contact Score',
                    
                    // Hibarr Deal Custom Field labels
                    'interested_in' => 'Interested In',
                    'motivation' => 'Motivation/Comment',
                    'purchase_timeline' => 'Purchase Timeline',
                    'budget_range' => 'Budget Range',
                    'strategy_meeting_booked' => 'Strategy Meeting Booked',
                    'downpayment_paid' => 'Downpayment Paid',
                    'inspection_trip_date' => 'Inspection Trip Date',
                    'deposit_confirmation' => 'Deposit Confirmation',
                    'reservation_agreement' => 'Reservation Agreement',
                    'sales_contract' => 'Sales Contract',
                ];
                
                // Add custom field labels
                foreach ($customFields as $customField) {
                    $slug = Str::slug($customField->label, '_');
                    $headerLabels[$slug] = $customField->label;
                }
                
                // Add comments to header row
                $col = 1;
                foreach ($headerLabels as $technical => $humanLabel) {
                    $cellCoordinate = Coordinate::stringFromColumnIndex($col) . '1';
                    $sheet->getComment($cellCoordinate)->getText()->createTextRun($humanLabel);
                    $col++;
                }
                
                // Style header row
                $sheet->getStyle('1:1')->getFont()->setBold(true);
                $sheet->getStyle('1:1')->getFill()
                    ->setFillType(\PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID)
                    ->getStartColor()->setARGB('FFE0E0E0');
            },
        ];
    }
}

