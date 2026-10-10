<?php

namespace App\Notifications;

use App\Models\PartnerFlag;
use App\Support\FeatureFlags;
use Illuminate\Notifications\Messages\MailMessage;

/**
 * A partner has flagged one of their referrals.
 *
 * Sent to everyone holding manage_partner_flags. The assigned agent is
 * deliberately not notified: the partner is escalating past them, and copying
 * them in turns a quiet nudge into a complaint.
 */
class PartnerFlagRaised extends BaseNotification
{
    private PartnerFlag $flag;

    /** crm.partner-flag-routing, read at dispatch (queue workers do not call the flag service). */
    private bool $routeByAccess;

    /** crm.manager-dashboard, read at dispatch for the same reason. */
    private bool $managerViewEnabled;

    public function __construct(PartnerFlag $flag, bool $routeByAccess = false)
    {
        $this->flag = $flag->load(['partner.user', 'lead']);
        $this->company = $flag->lead->company ?? null;
        $this->routeByAccess = $routeByAccess;
        $this->managerViewEnabled = $routeByAccess && FeatureFlags::enabled('crm.manager-dashboard');
    }

    /**
     * Where the button goes. The flag queue lives on the Manager dashboard, so
     * that is the target — except, with routing on, for a recipient who cannot
     * open it (no view_manager_dashboard, or the dashboard flag is off): they
     * would be dropped on some other view with no queue, so they get the home
     * dashboard instead.
     *
     * @return array{0: string, 1: array<string, string>}
     */
    public static function destination(bool $routeByAccess, bool $managerViewEnabled, mixed $viewManagerPermission): array
    {
        if ($routeByAccess && ! ($managerViewEnabled && $viewManagerPermission === 'all')) {
            return ['dashboard', []];
        }

        return ['dashboard.v2', ['view' => 'manager']];
    }

    public function via($notifiable): array
    {
        return ['database', 'mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        [$routeName, $params] = self::destination(
            $this->routeByAccess,
            $this->managerViewEnabled,
            // Only asked when routing is on, so the flag-off path is untouched.
            $this->routeByAccess ? $notifiable->permission('view_manager_dashboard') : null,
        );
        $canOpenQueue = $routeName === 'dashboard.v2';

        return $this->build($notifiable)
            ->subject('Partner flagged a referral')
            ->greeting("Hello {$notifiable->name},")
            ->line("{$this->partnerName()} has flagged a referral they introduced.")
            ->line('**Reason:** '.$this->reasonLabel())
            ->when($this->flag->message, function ($mail) {
                $mail->line("**Their message:** {$this->flag->message}");
            })
            ->action(
                $canOpenQueue ? 'Open the team dashboard' : 'Open your dashboard',
                $this->modifyUrl(route($routeName, $params))
            )
            // No client name in the mail body: it travels further than the
            // dashboard does, and the flag is about the handling, not the client.
            ->line($canOpenQueue
                ? 'Open the dashboard to see which referral and respond.'
                : 'Partner flags are answered from the Manager dashboard. If you cannot open it, ask an admin for access.');
    }

    public function toArray($notifiable): array
    {
        return [
            'type' => 'partner_flag_raised',
            'partner_flag_id' => $this->flag->id,
            'lead_id' => $this->flag->lead_id,
            'lead_agent_id' => $this->flag->lead_agent_id,
            'reason' => $this->flag->reason,
            'message' => $this->flag->message,
            'icon' => 'flag',
            'heading' => 'Partner flagged a referral',
            'description' => "{$this->partnerName()} flagged a referral: {$this->reasonLabel()}",
        ];
    }

    private function partnerName(): string
    {
        return $this->flag->partner?->user?->name ?? 'A partner';
    }

    private function reasonLabel(): string
    {
        return ucfirst(str_replace('_', ' ', $this->flag->reason));
    }
}
