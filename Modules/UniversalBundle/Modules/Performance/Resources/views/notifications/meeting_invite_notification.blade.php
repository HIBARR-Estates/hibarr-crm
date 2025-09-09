<x-cards.notification :notification="$notification"  :link="route('meetings.show', $notification->data['id'])" :image="company()->logo_url"
    :title="__('performance::email.meeting.subject')" :text="isset($notification->data['heading']) ? $notification->data['heading'] : 'no heading'"
    :time="$notification->created_at" />
