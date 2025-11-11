<?php

namespace App\Imports;

use Maatwebsite\Excel\Concerns\ToArray;

class DealImport implements ToArray
{
    protected array $processedData = [];

    public static function fields(): array
    {
        $fields = array(
            array('id' => 'deal_name', 'name' => 'Deal Name', 'required' => 'No', 'db_field' => 'name'),
            array('id' => 'lead_contact_email', 'name' => 'Lead Contact Email', 'required' => 'No', 'db_field' => 'email'),
            array('id' => 'lead_name', 'name' => 'Lead Name', 'required' => 'No'),
            array('id' => 'pipeline', 'name' => 'Pipeline (Legacy - Ignored)', 'required' => 'No', 'db_field' => 'pipeline'),
            array('id' => 'deal_value', 'name' => 'Deal Value', 'required' => 'No', 'db_field' => 'value'),
            array('id' => 'close_date', 'name' => 'Close Date', 'required' => 'No', 'db_field' => 'close_date'),
            array('id' => 'deal_stage', 'name' => 'Deal Stage', 'required' => 'No', 'db_field' => 'stages'),
            array('id' => 'responsible_name', 'name' => 'Responsible Agent Name', 'required' => 'No'),
            
            // Marketing fields
            array('id' => 'utm_source', 'name' => 'UTM Source', 'required' => 'No'),
            array('id' => 'utm_medium', 'name' => 'UTM Medium', 'required' => 'No'),
            array('id' => 'utm_campaign', 'name' => 'UTM Campaign', 'required' => 'No'),
            array('id' => 'utm_term', 'name' => 'UTM Term', 'required' => 'No'),
            array('id' => 'utm_content', 'name' => 'UTM Content', 'required' => 'No'),
            array('id' => 'utm_audience', 'name' => 'UTM Audience', 'required' => 'No'),
            array('id' => 'traffic_source_id', 'name' => 'Traffic Source ID', 'required' => 'No'),
            array('id' => 'facebook_click_id', 'name' => 'Facebook Click ID', 'required' => 'No'),
            array('id' => 'facebook_lead_id', 'name' => 'Facebook Lead ID', 'required' => 'No'),
            array('id' => 'has_registered_for_the_webinar', 'name' => 'Registered for Webinar', 'required' => 'No'),
            array('id' => 'has_joined_the_facebook_group', 'name' => 'Joined Facebook Group', 'required' => 'No'),
            array('id' => 'has_downloaded_the_ebook', 'name' => 'Downloaded Ebook', 'required' => 'No'),
            array('id' => 'has_attended_the_webinar', 'name' => 'Attended Webinar', 'required' => 'No'),
            array('id' => 'registered_for_zoom_meeting', 'name' => 'Registered for Zoom Meeting', 'required' => 'No'),
            array('id' => 'last_webinar_date', 'name' => 'Last Webinar Date', 'required' => 'No'),
            array('id' => 'contact_score', 'name' => 'Contact Score', 'required' => 'No'),
            
            // Hibarr Deal Custom Fields
            array('id' => 'interested_in', 'name' => 'Interested In', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'motivation', 'name' => 'Motivation/Comment', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'purchase_timeline', 'name' => 'Purchase Timeline', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'budget_range', 'name' => 'Budget Range', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'strategy_meeting_booked', 'name' => 'Strategy Meeting Booked', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'downpayment_paid', 'name' => 'Downpayment Paid', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'inspection_trip_date', 'name' => 'Inspection Trip Date', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'deposit_confirmation', 'name' => 'Deposit Confirmation', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'reservation_agreement', 'name' => 'Reservation Agreement', 'required' => 'No', 'hibarr_field' => true),
            array('id' => 'sales_contract', 'name' => 'Sales Contract', 'required' => 'No', 'hibarr_field' => true),
        );

        // Add custom fields dynamically - ALL custom fields
        $customFieldsGroupsId = \App\Models\CustomFieldGroup::where('model', 'App\Models\Deal')
            ->where('company_id', company()->id)
            ->select('id')
            ->first();

        if ($customFieldsGroupsId) {
            $customFields = \App\Models\CustomField::where('custom_field_group_id', $customFieldsGroupsId->id)
                ->orderBy('id')
                ->get();

            foreach ($customFields as $customField) {
                // Convert label to slug for matching (Excel will slugify the headers)
                $slugifiedLabel = \Illuminate\Support\Str::slug($customField->label, '_');
                
                $fields[] = array(
                    'id' => $slugifiedLabel,
                    'name' => $customField->label,
                    'required' => $customField->required == 'yes' ? 'Yes' : 'No',
                    'db_field' => 'field_' . $customField->id,
                    'custom_field_id' => $customField->id
                );
            }
        }

        return $fields;
    }

    public function array(array $array): array
    {
        $this->processedData = $array;
        return $array;
    }

    public function getProcessedData(): array
    {
        return $this->processedData;
    }

}
