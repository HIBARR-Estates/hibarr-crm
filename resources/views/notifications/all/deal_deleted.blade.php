<x-cards.notification :notification="$notification"
                      :link="$notification->data['action_url'] ?? route('deals.index')"
                      :image="company()->logo_url"
                      :title="$notification->data['title'] ?? __('email.dealDeleted.subject')"
                      :text="$notification->data['text'] ?? ($notification->data['deal_name'] ?? '')"
                      :time="$notification->created_at"/>
