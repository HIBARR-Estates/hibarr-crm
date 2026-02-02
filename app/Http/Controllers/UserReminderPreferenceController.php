<?php

namespace App\Http\Controllers;

use App\Helper\Reply;
use App\Http\Requests\StoreUserReminderPreferenceRequest;
use App\Models\UserReminderPreference;
use Inertia\Inertia;

class UserReminderPreferenceController extends AccountBaseController
{
    public function __construct()
    {
        parent::__construct();
        $this->pageTitle = 'Reminder Preferences';

        $this->middleware(function ($request, $next) {
            abort_403(!in_array('employees', $this->user->modules));
            return $next($request);
        });
    }

    /**
     * Display the reminder preferences page (Inertia view)
     *
     * @return \Inertia\Response
     */
    public function show()
    {
        return Inertia::render('Settings/ReminderPreferences', [
            'pageTitle' => $this->pageTitle,
        ]);
    }

    /**
     * Get user's reminder preferences for all entity types
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function index()
    {
        $userId = user()->id;
        $preferences = UserReminderPreference::where('user_id', $userId)->get();

        // Build response with preferences for each entity type
        $data = [];
        foreach (UserReminderPreference::ENTITY_TYPES as $type) {
            $existing = $preferences->firstWhere('entity_type', $type);
            $data[$type] = [
                'id' => $existing?->id,
                'reminders' => $existing?->reminders ?? UserReminderPreference::DEFAULT_REMINDERS,
                'is_active' => $existing?->is_active ?? true,
                'is_custom' => $existing !== null, // Indicates if user has custom settings
            ];
        }

        return Reply::dataOnly([
            'preferences' => $data,
            'defaults' => UserReminderPreference::DEFAULT_REMINDERS,
        ]);
    }

    /**
     * Update or create user's reminder preference
     *
     * @param StoreUserReminderPreferenceRequest $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function update(StoreUserReminderPreferenceRequest $request)
    {
        $userId = user()->id;
        $companyId = company()->id ?? null;

        // Clean up reminders - remove any extra fields and ensure proper format
        $reminders = collect($request->reminders)->map(function ($reminder) {
            return [
                'time' => (int) $reminder['time'],
                'type' => $reminder['type'],
            ];
        })->toArray();

        // Sort reminders by time in descending order (largest first)
        usort($reminders, function ($a, $b) {
            $aMinutes = $this->toMinutes($a['time'], $a['type']);
            $bMinutes = $this->toMinutes($b['time'], $b['type']);
            return $bMinutes - $aMinutes;
        });

        $preference = UserReminderPreference::updateOrCreate(
            [
                'user_id' => $userId,
                'entity_type' => $request->entity_type,
            ],
            [
                'company_id' => $companyId,
                'reminders' => $reminders,
                'is_active' => $request->is_active ?? true,
            ]
        );

        return Reply::successWithData(__('messages.recordSaved'), [
            'preference' => [
                'id' => $preference->id,
                'entity_type' => $preference->entity_type,
                'reminders' => $preference->reminders,
                'is_active' => $preference->is_active,
            ],
        ]);
    }

    /**
     * Reset user's reminder preference to defaults
     *
     * @param string $entityType
     * @return \Illuminate\Http\JsonResponse
     */
    public function reset(string $entityType)
    {
        $userId = user()->id;

        // Validate entity type
        if (!in_array($entityType, UserReminderPreference::ENTITY_TYPES)) {
            return Reply::error(__('messages.invalidEntityType'));
        }

        $deleted = UserReminderPreference::resetToDefaults($userId, $entityType);

        if ($deleted) {
            return Reply::successWithData(__('messages.reminderPreferencesReset'), [
                'defaults' => UserReminderPreference::DEFAULT_REMINDERS,
            ]);
        }

        return Reply::success(__('messages.reminderPreferencesReset'));
    }

    /**
     * Convert reminder time to minutes for sorting
     *
     * @param int $time
     * @param string $type
     * @return int
     */
    private function toMinutes(int $time, string $type): int
    {
        return match ($type) {
            'day' => $time * 24 * 60,
            'hour' => $time * 60,
            default => $time,
        };
    }
}
