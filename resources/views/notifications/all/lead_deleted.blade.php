<x-cards.notification :notification="$notification"
                      :link="$notification->data['action_url'] ?? route('lead-contact.index')"
                      :image="company()->logo_url"
                      :title="$notification->data['title'] ?? __('email.leadDeleted.subject')"
                      :text="$notification->data['text'] ?? ($notification->data['name'] ?? '')"
                      :time="$notification->created_at"/>
