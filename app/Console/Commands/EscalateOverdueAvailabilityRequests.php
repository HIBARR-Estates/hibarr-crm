<?php

namespace App\Console\Commands;

use App\Models\PropertyAvailabilityRequest;
use App\Models\User;
use App\Notifications\AvailabilityEscalation;
use App\Notifications\AvailabilityEscalationReminder;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

class EscalateOverdueAvailabilityRequests extends Command
{
    protected $signature = 'escalate-availability-requests';

    protected $description = 'Escalate overdue property availability requests (pending > 8 business hours) to admin users';

    public function handle(): int
    {
        $overdueRequests = PropertyAvailabilityRequest::with(['property', 'requestingAgent', 'responsibleAgent'])
            ->overdue()
            ->get();

        if ($overdueRequests->isEmpty()) {
            $this->info('No overdue availability requests found.');
            return 0;
        }

        $this->info("Found {$overdueRequests->count()} overdue availability request(s).");

        // Get company admin / property-admin users
        $adminUsers = $this->getAdminUsers();

        if ($adminUsers->isEmpty()) {
            $this->warn('No admin users found to escalate to.');
            return 1;
        }

        foreach ($overdueRequests as $request) {
            // Update status to escalated
            $request->update([
                'status' => PropertyAvailabilityRequest::STATUS_ESCALATED,
                'escalated_at' => now(),
            ]);

            // Notify all admin users
            Notification::send($adminUsers, new AvailabilityEscalation($request));

            // Send reminder to the responsible agent
            if ($request->responsibleAgent) {
                $request->responsibleAgent->notify(new AvailabilityEscalationReminder($request));
            }

            $this->info("Escalated request #{$request->id} for property {$request->property->reference_code}");
        }

        $this->info('Escalation complete.');
        return 0;
    }

    /**
     * Get users with admin-level property permissions.
     */
    private function getAdminUsers()
    {
        return User::whereHas('roles', function ($query) {
            $query->where('name', 'admin');
        })->where('status', 'active')->get();
    }
}
