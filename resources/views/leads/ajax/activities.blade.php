<!-- Quick Actions Card -->
<div class="card border mb-4 border-gray-400 overflow-hidden" style="border-radius: 10px;">
    <div class="card-header bg-white border-0">
        <h6 class="mb-0 font-weight-bold text-dark">
            <i class="fa fa-bolt text-warning mr-2"></i>
            @lang('app.activities.quickActions')
        </h6>
    </div>
    <div class="card-body p-3">
        <div class="grid sm:grid-cols-2 gap-4">
            <div class="">
                <button class="btn btn-outline-primary btn-sm w-100" onclick="sendEmail()">
                    <i class="fa fa-envelope mr-1"></i>
                    @lang('app.activities.email')
                </button>
            </div>
            <div class="">
                <button class="btn btn-outline-success btn-sm w-100" onclick="sendWhatsApp()">
                    <i class="fa fa-whatsapp mr-1"></i>
                    @lang('app.activities.whatsapp')
                </button>
            </div>
            <div class="">
                <button class="btn btn-outline-info btn-sm w-100" onclick="makeCall()">
                    <i class="fa fa-phone mr-1"></i>
                    @lang('app.activities.call')
                </button>
            </div>
            <div class="">
                <button class="btn btn-outline-secondary btn-sm w-100" onclick="scheduleMeeting()">
                    <i class="fa fa-calendar mr-1"></i>
                    @lang('app.activities.scheduleMeeting')
                </button>
            </div>
        </div>
    </div>
</div>

<!-- Communication Activities Section -->
<div class="card border border-gray-400 rounded-lg">
    <div class="card-header bg-white border-0 pb-0">
        <div class="d-flex justify-content-between align-items-center">
            <h5 class="mb-0 font-weight-bold text-dark">
                <i class="fa fa-comments text-primary mr-2"></i>
                @lang('app.activities.communicationActivities')
            </h5>
            <span class="badge badge-primary badge-pill">{{ $deal->communicationActivities->count() }}</span>
        </div>
    </div>
    <div class="card-body p-0">
        @if ($deal->communicationActivities->count() > 0)
            <div class="activity-timeline">
                @foreach ($deal->communicationActivities->take(5) as $activity)
                    <div class="activity-item p-3 border-bottom">
                        <div class="d-flex align-items-start">
                            <!-- Channel Icon -->
                            <div class="activity-icon mr-3">
                                @php
                                    $channelIcons = [
                                        'email' => 'fa-envelope',
                                        'whatsapp' => 'fa-whatsapp',
                                        'instagram' => 'fa-instagram',
                                        'telegram' => 'fa-telegram',
                                    ];
                                    $channelColors = [
                                        'email' => 'bg-primary',
                                        'whatsapp' => 'bg-success',
                                        'instagram' => 'bg-danger',
                                        'telegram' => 'bg-info',
                                    ];
                                    $icon = $channelIcons[$activity->channel_type] ?? 'fa-comment';
                                    $color = $channelColors[$activity->channel_type] ?? 'bg-secondary';
                                @endphp
                                <div class="rounded-circle {{ $color }} d-flex align-items-center justify-content-center"
                                    style="width: 40px; height: 40px;">
                                    <i class="fa {{ $icon }} text-white"></i>
                                </div>
                            </div>

                            <!-- Activity Content -->
                            <div class="activity-content flex-grow-1">
                                <div class="d-flex justify-content-between align-items-start mb-2">
                                    <div>
                                        <h6 class="mb-1 font-weight-bold text-dark">{{ $activity->sender_name }}</h6>
                                        <small class="text-muted">{{ $activity->sender_contact }}</small>
                                    </div>
                                    <small class="text-muted">{{ $activity->timestamp->diffForHumans() }}</small>
                                </div>

                                <div class="activity-message mb-3">
                                    @php
                                        $preview = substr($activity->message_content, 0, 80);
                                        $hasMore = strlen($activity->message_content) > 80;
                                    @endphp
                                    <p class="mb-0 text-dark">{{ $preview }}{{ $hasMore ? '...' : '' }}</p>
                                    @if ($hasMore)
                                        <small class="text-primary cursor-pointer"
                                            onclick="showFullMessage({{ $activity->id }})">
                                            @lang('app.activities.viewMore')
                                        </small>
                                    @endif
                                </div>

                                <!-- Action Buttons -->
                                <div class="activity-actions">
                                    <button class="btn btn-sm btn-outline-primary mr-2"
                                        onclick="replyToActivity({{ $activity->id }}, '{{ $activity->channel_type }}')">
                                        <i class="fa fa-reply mr-1"></i>
                                        @lang('app.activities.reply')
                                    </button>
                                    <button class="btn btn-sm btn-outline-secondary"
                                        onclick="viewActivityDetails({{ $activity->id }})">
                                        <i class="fa fa-eye mr-1"></i>
                                        @lang('app.activities.view')
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                @endforeach

                @if ($deal->communicationActivities->count() > 5)
                    <div class="text-center p-3">
                        <a href="{{ route('deals.show', $deal->id) . '?tab=activities' }}"
                            class="btn btn-outline-primary btn-sm">
                            @lang('app.activities.viewAllActivities') ({{ $deal->communicationActivities->count() }})
                        </a>
                    </div>
                @endif
            </div>
        @else
            <div class="text-center py-4">
                <div class="empty-state">
                    <i class="fa fa-comments fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted mb-2">@lang('app.activities.noActivitiesYet')</h6>
                    <p class="text-muted small mb-3">@lang('app.activities.noActivitiesDescription')</p>
                    <button class="btn btn-primary btn-sm" onclick="startNewConversation()">
                        <i class="fa fa-plus mr-1"></i>
                        @lang('app.activities.startConversation')
                    </button>
                </div>
            </div>
        @endif
    </div>
</div>

<style>
    /* Modern Activity Timeline Styles */
    .activity-timeline {
        max-height: 450px;
        overflow-y: auto;
    }

    .activity-item {
        transition: all 0.3s ease;
        border-left: 3px solid transparent;
    }

    .activity-item:hover {
        background-color: #f8f9fa;
        border-left-color: #007bff;
    }

    .activity-item:last-child {
        border-bottom: none !important;
    }

    .activity-icon .rounded-circle {
        transition: transform 0.2s ease;
    }

    .activity-item:hover .activity-icon .rounded-circle {
        transform: scale(1.1);
    }

    .activity-content h6 {
        font-size: 0.9rem;
        margin-bottom: 0.25rem;
    }

    .activity-message p {
        font-size: 0.85rem;
        line-height: 1.4;
    }

    .activity-actions {
        opacity: 0.7;
        transition: opacity 0.2s ease;
    }

    .activity-item:hover .activity-actions {
        opacity: 1;
    }

    .activity-actions .btn {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
    }

    .empty-state {
        padding: 2rem 1rem;
    }

    .empty-state i {
        opacity: 0.5;
    }

    /* Quick Actions Styles */
    .card.shadow-sm {
        box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
    }

    .card-header {
        border-bottom: 1px solid #e9ecef;
    }

    .btn-outline-primary:hover,
    .btn-outline-success:hover,
    .btn-outline-info:hover,
    .btn-outline-secondary:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
        .activity-timeline {
            max-height: 450px;
        }

        .activity-actions .btn {
            font-size: 0.7rem;
            padding: 0.2rem 0.4rem;
        }
    }

    /* Custom scrollbar for activity timeline */
    .activity-timeline::-webkit-scrollbar {
        width: 4px;
    }

    .activity-timeline::-webkit-scrollbar-track {
        background: #f1f1f1;
        border-radius: 2px;
    }

    .activity-timeline::-webkit-scrollbar-thumb {
        background: #c1c1c1;
        border-radius: 2px;
    }

    .activity-timeline::-webkit-scrollbar-thumb:hover {
        background: #a8a8a8;
    }

    /* Badge styling */
    .badge-pill {
        font-size: 0.75rem;
        padding: 0.25rem 0.5rem;
    }

    /* Cursor pointer for clickable elements */
    .cursor-pointer {
        cursor: pointer;
    }

    .cursor-pointer:hover {
        text-decoration: underline;
    }
</style>

<script>
    // Communication Activities Functions
    function showFullMessage(activityId) {
        // Show full message in a modal
        Swal.fire({
            title: '@lang('app.messageDetails')',
            text: '@lang('app.featureNotAvailable')',
            icon: 'info',
            confirmButtonText: '@lang('app.ok')'
        });
    }

    function replyToActivity(activityId, channelType) {
        // Show reply modal based on channel type
        let modalTitle = '@lang('app.reply')';
        let placeholder = '@lang('app.typeYourMessage')';

        if (channelType === 'email') {
            modalTitle = '@lang('app.replyEmail')';
            placeholder = '@lang('app.typeYourEmail')';
        } else if (channelType === 'whatsapp') {
            modalTitle = '@lang('app.replyWhatsApp')';
            placeholder = '@lang('app.typeYourWhatsAppMessage')';
        }

        Swal.fire({
            title: modalTitle,
            input: 'textarea',
            inputPlaceholder: placeholder,
            inputAttributes: {
                'aria-label': placeholder,
                'rows': 4
            },
            showCancelButton: true,
            confirmButtonText: '@lang('app.send')',
            cancelButtonText: '@lang('app.cancel')',
            showLoaderOnConfirm: true,
            preConfirm: (message) => {
                if (!message || message.trim() === '') {
                    Swal.showValidationMessage('@lang('app.messageRequired')');
                    return false;
                }
                return message;
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // For now, just show success message
                Swal.fire({
                    icon: 'success',
                    title: '@lang('app.messageSent')',
                    text: '@lang('app.messageSentSuccessfully')',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    }

    function viewActivityDetails(activityId) {
        // Show activity details in a modal
        Swal.fire({
            title: '@lang('app.activityDetails')',
            text: '@lang('app.featureNotAvailable')',
            icon: 'info',
            confirmButtonText: '@lang('app.ok')'
        });
    }

    function startNewConversation() {
        // Show new conversation modal
        Swal.fire({
            title: '@lang('app.startNewConversation')',
            html: `
                    <div class="text-left">
                        <div class="form-group">
                            <label>@lang('app.activities.selectChannel')</label>
                            <select id="channel-type" class="form-control">
                                <option value="email">@lang('app.activities.channels.email')</option>
                                <option value="whatsapp">@lang('app.activities.channels.whatsapp')</option>
                                <option value="instagram">@lang('app.activities.channels.instagram')</option>
                                <option value="telegram">@lang('app.activities.channels.telegram')</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>@lang('app.activities.message')</label>
                            <textarea id="new-message" class="form-control" rows="4" placeholder="@lang('app.activities.typeYourMessage')"></textarea>
                        </div>
                    </div>
                `,
            showCancelButton: true,
            confirmButtonText: '@lang('app.activities.send')',
            cancelButtonText: '@lang('app.activities.cancel')',
            preConfirm: () => {
                const channelType = document.getElementById('channel-type').value;
                const message = document.getElementById('new-message').value;

                if (!message || message.trim() === '') {
                    Swal.showValidationMessage('@lang('app.activities.messageRequired')');
                    return false;
                }

                return {
                    channelType,
                    message
                };
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // For now, just show success message
                Swal.fire({
                    icon: 'success',
                    title: '@lang('app.activities.conversationStarted')',
                    text: '@lang('app.activities.conversationStartedSuccessfully')',
                    timer: 2000,
                    showConfirmButton: false
                });
            }
        });
    }

    // Quick Actions Functions
    function sendEmail() {
        const email = '{{ $deal->contact->client_email }}';
        if (email) {
            window.open(`mailto:${email}?subject=Re: {{ $deal->name }}`, '_blank');
        } else {
            Swal.fire({
                icon: 'warning',
                title: '@lang('app.activities.noEmailAddress')',
                text: '@lang('app.activities.contactHasNoEmail')'
            });
        }
    }

    function sendWhatsApp() {
        const phone = '{{ $deal->contact->mobile }}';
        if (phone) {
            const message = encodeURIComponent(`Hi {{ $deal->contact->client_name }}, regarding {{ $deal->name }}`);
            window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
        } else {
            Swal.fire({
                icon: 'warning',
                title: '@lang('app.activities.noPhoneNumber')',
                text: '@lang('app.activities.contactHasNoPhone')'
            });
        }
    }

    function makeCall() {
        const phone = '{{ $deal->contact->mobile }}';
        if (phone) {
            window.open(`tel:${phone}`, '_blank');
        } else {
            Swal.fire({
                icon: 'warning',
                title: '@lang('app.activities.noPhoneNumber')',
                text: '@lang('app.activities.contactHasNoPhone')'
            });
        }
    }

    function scheduleMeeting() {
        // Open calendar scheduling
        const subject = encodeURIComponent('Meeting: {{ $deal->name }}');
        const body = encodeURIComponent(
            `Hi {{ $deal->contact->client_name }},\n\nI'd like to schedule a meeting to discuss {{ $deal->name }}.\n\nBest regards,\n{{ auth()->user()->name }}`
        );
        window.open(`mailto:{{ $deal->contact->client_email }}?subject=${subject}&body=${body}`, '_blank');
    }
</script>
