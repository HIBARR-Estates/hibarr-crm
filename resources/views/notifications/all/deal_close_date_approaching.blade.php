<x-cards.notification :notification="$notification"
                      :link="$notification->data['action_url'] ?? (isset($notification->data['deal_id']) ? route('deals.show', $notification->data['deal_id']) : route('deals.index'))"
                      :image="company()->logo_url"
                      :title="$notification->data['title'] ?? __('email.dealCloseDateApproaching.subject')"
                      :text="$notification->data['text'] ?? ($notification->data['deal_name'] ?? '')"
                      :time="$notification->created_at"/>
