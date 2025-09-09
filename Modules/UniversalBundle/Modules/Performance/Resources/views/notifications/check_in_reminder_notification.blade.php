<x-cards.notification :notification="$notification"  :link="route('objectives.show', $notification->data['id'])" :image="company()->logo_url"
    :title="__('performance::email.checkin.subject')" :text="$notification->data['heading']"
    :time="$notification->created_at" />
