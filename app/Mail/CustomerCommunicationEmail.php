<?php

namespace App\Mail;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\GlobalSetting;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Log;

class CustomerCommunicationEmail extends Mailable
{
    use Queueable, SerializesModels;

    public $activity;
    public $dealOrLead;
    public $sender;
    public $subject;
    public $message;
    public $templateData;
    private $company;

    /**
     * Create a new message instance.
     *
     * @param CommunicationActivity $activity
     * @param Deal|Lead $dealOrLead
     * @param User $sender The user who is sending the email
     * @param string $subject
     * @param string $message
     * @param array $templateData Additional template data
     */
    public function __construct(
        CommunicationActivity $activity,
        $dealOrLead,
        User $sender,
        string $subject,
        string $message,
        array $templateData = []
    ) {
        $this->activity = $activity;
        $this->dealOrLead = $dealOrLead;
        $this->sender = $sender;
        $this->subject = $subject;
        $this->message = $message;
        $this->templateData = $templateData;
        
        // Set company from deal/lead
        if ($dealOrLead instanceof Deal) {
            $this->company = $dealOrLead->company;
        } elseif ($dealOrLead instanceof Lead) {
            $this->company = $dealOrLead->company;
        }
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        // Set locale
        $locale = $this->company->locale ?? 'en';
        App::setLocale($locale);
        
        // Get company settings for logo and name
        $globalSetting = GlobalSetting::first();
        
        // Use SMTP settings from database (loaded by SmtpConfigProvider)
        // The from address must match the SMTP username for relay to work
        // Always use the configured email from env/config, not the sender's email
        $fromEmail = config('mail.mailers.smtp.username') ?? config('mail.from.address') ?? env('MAIL_FROM_ADDRESS');
        $fromName = config('mail.from.name');
        
        // Override display name with company-specific settings if available
        $companyName = $fromName;
        if ($this->company) {
            $companyName = $this->company->company_name ?? $fromName;
            Config::set('app.logo', $this->company->masked_logo_url ?? $globalSetting->masked_logo_url);
            Config::set('app.name', $companyName);
        } else {
            Config::set('app.logo', $globalSetting->masked_logo_url);
            Config::set('app.name', $fromName);
        }
        
        // Get customer name
        $customerName = $this->getCustomerName();
        
        // Ensure sender has employeeDetail loaded
        if (!$this->sender->relationLoaded('employeeDetail')) {
            $this->sender->load('employeeDetail.designation');
        }
        
        // Get sender name - use the name attribute from the User model
        $senderName = trim($this->sender->name ?? '');
        if (empty($senderName)) {
            // Fallback to email if name is empty
            $senderName = $this->sender->email ?? 'Sender';
        }
        $senderEmail = $this->sender->email;
        
        // Get sender job title from employee details
        $senderJobTitle = null;
        if ($this->sender->employeeDetail && $this->sender->employeeDetail->designation) {
            $senderJobTitle = $this->sender->employeeDetail->designation->name;
        }
        
        // Get sender phone
        $senderPhone = $this->sender->mobile_with_phone_code ?? $this->sender->mobile ?? null;
        
        // Reply-to should always be the sender's email (the person who clicked send)
        $replyToEmail = $this->sender->email;
        $replyToName = $this->sender->name;
        
        // Get company details for template
        $themeColor = $this->company->header_color ?? '#0056b3';
        
        // Determine URL and action text
        $url = null;
        $actionText = null;
        
        if ($this->activity && $this->activity->deal_id) {
            $url = route('deals.show', $this->activity->deal_id);
            $actionText = __('app.viewDealDetails') ?? 'View Deal Details';
        } elseif ($this->activity && $this->activity->lead_id) {
            $url = route('lead-contact.show', $this->activity->lead_id);
            $actionText = __('app.viewContactDetails') ?? 'View Contact Details';
        }
        
        // Apply domain-specific URL if needed
        if ($url && $this->company) {
            $url = getDomainSpecificUrl($url, $this->company);
        }
        
        // Get logo and website URL
        $logoUrl = $this->company->masked_logo_url ?? config('app.logo');
        $websiteUrl = $this->company->website ?? url('/');
        
        return $this->from($fromEmail, $senderName)
            ->replyTo($replyToEmail, $replyToName)
            ->subject($this->subject)
            ->view('mail.customer-communication', [
                'customerName' => $customerName,
                'emailContent' => $this->message,
                'templateData' => $this->templateData,
                'themeColor' => $themeColor,
                'senderName' => $senderName,
                'senderEmail' => $senderEmail,
                'senderJobTitle' => $senderJobTitle,
                'senderPhone' => $senderPhone,
                'companyName' => $companyName,
                'logoUrl' => $logoUrl,
                'websiteUrl' => $websiteUrl,
                'subject' => $this->subject
            ]);
    }

    /**
     * Get customer name.
     *
     * @return string
     */
    private function getCustomerName(): string
    {
        if ($this->dealOrLead instanceof Deal) {
            // Always get the lead name, not the deal name
            // First try to get from contact relationship (Lead model)
            if (!$this->dealOrLead->relationLoaded('contact')) {
                $this->dealOrLead->load('contact');
            }
            
            if ($this->dealOrLead->contact) {
                // Use client_name_salutation if available (includes salutation), otherwise client_name
                return $this->dealOrLead->contact->client_name_salutation 
                    ?? $this->dealOrLead->contact->client_name 
                    ?? 'Customer';
            }
            
            // If no contact, try to get lead directly via lead_id
            if ($this->dealOrLead->lead_id) {
                $lead = Lead::find($this->dealOrLead->lead_id);
                if ($lead) {
                    return $lead->client_name_salutation 
                        ?? $lead->client_name 
                        ?? 'Customer';
                }
            }
            
            // Last resort fallback
            return 'Customer';
        }
        
        // For Lead, use client_name_salutation if available, otherwise client_name
        if ($this->dealOrLead instanceof Lead) {
            return $this->dealOrLead->client_name_salutation 
                ?? $this->dealOrLead->client_name 
                ?? 'Customer';
        }
        
        return 'Customer';
    }

}

