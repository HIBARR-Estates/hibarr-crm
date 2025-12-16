<?php

namespace App\Notifications;

use App\Models\CommunicationActivity;
use App\Models\Deal;
use App\Models\Lead;
use App\Models\User;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Support\Facades\App;

class CustomerCommunicationNotification extends BaseNotification
{
    private $activity;
    private $dealOrLead;
    private $sender;
    private $subject;
    private $emailContent;
    private $templateData;

    /**
     * Create a new notification instance.
     *
     * @param CommunicationActivity $activity
     * @param Deal|Lead $dealOrLead
     * @param User $sender
     * @param string $subject
     * @param string $emailContent
     * @param array $templateData
     */
    public function __construct(
        CommunicationActivity $activity,
        $dealOrLead,
        User $sender,
        string $subject,
        string $emailContent,
        array $templateData = []
    ) {
        $this->activity = $activity;
        $this->dealOrLead = $dealOrLead;
        $this->sender = $sender;
        $this->subject = $subject;
        $this->emailContent = $emailContent;
        $this->templateData = $templateData;
        
        // Set company from deal/lead
        if ($dealOrLead instanceof Deal) {
            $this->company = $dealOrLead->company;
        } elseif ($dealOrLead instanceof Lead) {
            $this->company = $dealOrLead->company;
        }
    }

    /**
     * Get the notification's delivery channels.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function via($notifiable)
    {
        return ['mail'];
    }

    /**
     * Override build to handle email addresses (not User models).
     *
     * @param mixed $notifiable
     * @return \Illuminate\Notifications\Messages\MailMessage
     */
    public function build($notifiable = null)
    {
        // Use parent build but handle case where notifiable might not be a User
        if ($notifiable && method_exists($notifiable, 'getKey')) {
            return parent::build($notifiable);
        }
        
        // For email addresses, use company locale
        $company = $this->company;
        $globalSetting = \App\Models\GlobalSetting::first();
        
        $locale = $company->locale ?? 'en';
        \Illuminate\Support\Facades\App::setLocale($locale);
        
        $smtpSetting = \App\Models\SmtpSetting::first();
        $build = new \Illuminate\Notifications\Messages\MailMessage();
        
        $replyName = $companyName = $smtpSetting->mail_from_name;
        $replyEmail = $companyEmail = $smtpSetting->mail_from_email;
        
        \Illuminate\Support\Facades\Config::set('app.logo', $globalSetting->masked_logo_url);
        \Illuminate\Support\Facades\Config::set('app.name', $companyName);
        
        if (!is_null($company)) {
            $replyName = $company->company_name;
            $replyEmail = $company->company_email;
            \Illuminate\Support\Facades\Config::set('app.logo', $company->masked_logo_url);
            \Illuminate\Support\Facades\Config::set('app.name', $replyName);
        }
        
        $companyEmail = config('mail.verified') === true ? $companyEmail : $replyEmail;
        
        // For customer communications, set reply-to to sender's email
        $replyToEmail = $this->sender->email ?? $replyEmail;
        $replyToName = $this->sender->name ?? $replyName;
        
        return $build->from($companyEmail, $replyName)->replyTo($replyToEmail, $replyToName);
    }

    /**
     * Get the mail representation of the notification.
     *
     * @param mixed $notifiable
     * @return MailMessage
     */
    public function toMail($notifiable): MailMessage
    {
        $build = $this->build($notifiable);
        
        // Get customer name
        $customerName = $this->getCustomerName();
        
        // Get sender details
        $senderName = $this->sender->name;
        $senderEmail = $this->sender->email;
        
        // Get sender job title from employee details
        $senderJobTitle = null;
        if ($this->sender->employeeDetail && $this->sender->employeeDetail->designation) {
            $senderJobTitle = $this->sender->employeeDetail->designation->name;
        }
        
        // Get sender phone
        $senderPhone = $this->sender->mobile_with_phone_code ?? $this->sender->mobile ?? null;
        
        // Get company details
        $companyName = $this->company->company_name ?? config('app.name');
        $logoUrl = $this->company->masked_logo_url ?? config('app.logo');
        $themeColor = $this->company->header_color ?? '#0056b3';
        
        // Get website URL (if available)
        $websiteUrl = $this->company->website ?? url('/');
        
        // Set locale
        App::setLocale($this->company->locale ?? 'en');
        
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
        
        // Sanitize email content to prevent XSS attacks
        $sanitizedEmailContent = $this->sanitizeHtml($this->emailContent);
        
        $build
            ->subject($this->subject)
            ->markdown('mail.customer-communication', [
                'customerName' => $customerName,
                'emailContent' => $sanitizedEmailContent,
                'templateData' => $this->templateData,
                'url' => $url,
                'actionText' => $actionText,
                'themeColor' => $themeColor,
                'senderName' => $senderName,
                'senderEmail' => $senderEmail,
                'senderJobTitle' => $senderJobTitle,
                'senderPhone' => $senderPhone,
                'companyName' => $companyName,
                'logoUrl' => $logoUrl,
                'websiteUrl' => $websiteUrl,
            ]);
        
        parent::resetLocale();
        
        return $build;
    }

    /**
     * Get customer name.
     *
     * @return string
     */
    private function getCustomerName(): string
    {
        if ($this->dealOrLead instanceof Deal) {
            return $this->dealOrLead->contact->client_name ?? $this->dealOrLead->name ?? 'Customer';
        }
        
        return $this->dealOrLead->client_name ?? 'Customer';
    }

    /**
     * Get the array representation of the notification.
     *
     * @param mixed $notifiable
     * @return array
     */
    public function toArray($notifiable)
    {
        return [
            'activity_id' => $this->activity->id,
            'deal_id' => $this->activity->deal_id,
            'lead_id' => $this->activity->lead_id,
            'subject' => $this->subject,
        ];
    }

    /**
     * Sanitize HTML content to prevent XSS attacks.
     * Allows only safe HTML tags commonly used in email formatting.
     *
     * @param string $html
     * @return string
     */
    private function sanitizeHtml(string $html): string
    {
        // Define allowed HTML tags for email content
        // These are safe tags commonly used in email formatting
        $allowedTags = '<p><br><strong><b><em><i><u><h1><h2><h3><h4><h5><h6>' .
                      '<ul><ol><li><blockquote><a><span><div>' .
                      '<table><thead><tbody><tr><td><th>';
        
        // Strip all tags except allowed ones
        $sanitized = strip_tags($html, $allowedTags);
        
        // Additional security: Remove any javascript: or data: URLs from href/src attributes
        // This is a basic check - for production, consider using a library like HTMLPurifier
        $sanitized = preg_replace_callback(
            '/(href|src)=["\']([^"\']*)["\']/i',
            function ($matches) {
                $url = $matches[2];
                // Block javascript: and data: URLs
                if (preg_match('/^(javascript|data):/i', $url)) {
                    return $matches[1] . '="#"';
                }
                return $matches[0];
            },
            $sanitized
        );
        
        return $sanitized;
    }
}

