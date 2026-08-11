<x-cards.notification :notification="$notification"
                      :link="$notification->data['action_url'] ?? null"
                      :image="company()->logo_url"
                      :title="$notification->data['title'] ?? __('email.leadFollowUpOverdue.subject')"
                      :text="$notification->data['text'] ?? ($notification->data['name'] ?? '')"
                      :time="$notification->created_at"/>
