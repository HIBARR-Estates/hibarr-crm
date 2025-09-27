{{-- filepath: resources/views/leads/ajax/activities.blade.php --}}

<!-- Quick Actions Card -->
<div class="card border mb-4 border-gray-400 overflow-hidden" style="border-radius: 10px;">
    <div class="card-header bg-white border-0">
        <h6 class="mb-0 font-weight-bold text-dark">
            <i class="fa fa-bolt text-warning mr-2"></i>
            @lang('app.activities.quickActions')
        </h6>
    </div>
    <div class="card-body p-3">
        <div class="d-flex justify-content-center gap-3">
            <button class="btn btn-round btn-primary" 
                    onclick="sendEmail()" 
                    title="@lang('app.activities.email')"
                    data-toggle="tooltip"
                    data-placement="top">
                <i class="fa fa-envelope"></i>
            </button>
            <button class="btn btn-round btn-success" 
                    onclick="sendWhatsApp()" 
                    title="@lang('app.activities.whatsapp')"
                    data-toggle="tooltip"
                    data-placement="top">
                <i class="fa fa-whatsapp"></i>
            </button>
            <button class="btn btn-round btn-info" 
                    onclick="makeCall()" 
                    title="@lang('app.activities.call')"
                    data-toggle="tooltip"
                    data-placement="top">
                <i class="fa fa-phone"></i>
            </button>
            <button class="btn btn-round btn-secondary" 
                    onclick="scheduleMeeting()" 
                    title="@lang('app.activities.scheduleMeeting')"
                    data-toggle="tooltip"
                    data-placement="top">
                <i class="fa fa-calendar"></i>
            </button>
            <button class="btn btn-round btn-primary" 
                    onclick="startNewConversation()"
                    title="@lang('app.activities.startConversation')"
                    data-toggle="tooltip"
                    data-placement="top">
                <i class="fa fa-plus"></i>
            </button>
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
            <div class="d-flex align-items-center gap-2">
                <span class="badge badge-primary badge-pill" id="activities-count">0</span>
                <button class="btn btn-round btn-sm btn-outline-primary" 
                        id="refresh-activities-btn"
                        onclick="refreshActivities()" 
                        title="@lang('app.activities.refresh')"
                        data-toggle="tooltip"
                        data-placement="top">
                    <i class="fa fa-refresh"></i>
                </button>
            </div>
        </div>
    </div>
    <div class="card-body p-0">
        <!-- Loading State -->
        <div id="activities-loading" class="text-center py-4 d-none">
            <i class="fa fa-spinner fa-spin fa-2x text-muted"></i>
            <p class="text-muted mt-2">@lang('app.activities.loadingActivities')</p>
        </div>

        <!-- Activities Container -->
        <div id="activities-container">
            <!-- Activities will be loaded here -->
        </div>
    </div>
</div>

{{-- Include the styles --}}
<style>
    /* All your existing styles remain the same */
    .btn-round {
        width: 45px;
        height: 45px;
        border-radius: 50% !important;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 16px;
        border: none;
        transition: all 0.3s ease;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
    }

    .btn-round.btn-sm {
        width: 32px;
        height: 32px;
        font-size: 12px;
    }

    .btn-round:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .btn-round:active {
        transform: translateY(0);
    }

    .btn-round.btn-outline-primary {
        background: white;
        border: 2px solid #007bff;
        color: #007bff;
    }

    .btn-round.btn-outline-primary:hover {
        background: #007bff;
        color: white;
    }

    .btn-round.btn-outline-secondary {
        background: white;
        border: 2px solid #6c757d;
        color: #6c757d;
    }

    .btn-round.btn-outline-secondary:hover {
        background: #6c757d;
        color: white;
    }

    .gap-3 {
        gap: 1rem;
    }

    .gap-2 {
        gap: 0.5rem;
    }

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

    .empty-state {
        padding: 2rem 1rem;
    }

    .empty-state i {
        opacity: 0.5;
    }

    .cursor-pointer {
        cursor: pointer;
    }

    .cursor-pointer:hover {
        text-decoration: underline;
    }

    #refresh-activities-btn.spin i {
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
        .btn-round {
            width: 40px;
            height: 40px;
            font-size: 14px;
        }

        .btn-round.btn-sm {
            width: 28px;
            height: 28px;
            font-size: 11px;
        }

        .gap-3 {
            gap: 0.75rem;
        }

        .activity-timeline {
            max-height: 400px;
        }
    }
</style>

<script>
    // Global variables
    const dealId = {{ $deal->id }};
    let isLoadingActivities = false;

    // Initialize on page load
    $(document).ready(function() {
        $('[data-toggle="tooltip"]').tooltip();
        loadActivities();
    });

    /**
     * Load activities from the endpoint
     */
    async function loadActivities() {
        if (isLoadingActivities) return;
        
        isLoadingActivities = true;
        showLoadingState(true);

        try {
            const response = await fetch(`/api/v1/internal/deals/${dealId}/communication-activities`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            console.log(result, "result from activities fetch");
            renderActivities(result.data);
            updateActivitiesCount(result.data.total);
            
        } catch (error) {
            console.error('Error loading activities:', error);
            showError('@lang('app.activities.loadingError')');
        } finally {
            showLoadingState(false);
            isLoadingActivities = false;
        }
    }

    /**
     * Refresh activities - called by refresh button
     */
    async function refreshActivities() {
        const refreshBtn = document.getElementById('refresh-activities-btn');
        refreshBtn.classList.add('spin');
        
        await loadActivities();
        
        setTimeout(() => {
            refreshBtn.classList.remove('spin');
        }, 1000);
    }

    /**
     * Show/hide loading state
     */
    function showLoadingState(show) {
        const loadingEl = document.getElementById('activities-loading');
        const containerEl = document.getElementById('activities-container');
        
        if (show) {
            loadingEl.classList.remove('d-none');
            containerEl.style.opacity = '0.5';
        } else {
            loadingEl.classList.add('d-none');
            containerEl.style.opacity = '1';
        }
    }

    /**
     * Update activities count badge
     */
    function updateActivitiesCount(count) {
        document.getElementById('activities-count').textContent = count;
    }

    /**
     * Render activities in the container
     */
    function renderActivities(data) {
        const container = document.getElementById('activities-container');
        
        if (!data.data || data.data.length === 0) {
            container.innerHTML = renderEmptyState();
            return;
        }

        let html = '<div class="activity-timeline">';
        
        data.data.forEach(activity => {
            html += renderActivityItem(activity);
        });
        
        html += '</div>';
        
        if (data.has_more) {
            html += renderViewAllButton(data.total);
        }
        
        container.innerHTML = html;
        
        // Re-initialize tooltips for new content
        $('[data-toggle="tooltip"]').tooltip();
    }

    /**
     * Render a single activity item
     */
    function renderActivityItem(activity) {
        const channelIcons = {
            'email': 'fa-envelope',
            'whatsapp': 'fa-whatsapp', 
            'instagram': 'fa-instagram',
            'telegram': 'fa-telegram'
        };
        
        const channelColors = {
            'email': 'bg-primary',
            'whatsapp': 'bg-success',
            'instagram': 'bg-danger', 
            'telegram': 'bg-info'
        };
        
        const icon = channelIcons[activity.channel_type] || 'fa-comment';
        const color = channelColors[activity.channel_type] || 'bg-secondary';
        
        const preview = activity.message_content.length > 80 
            ? activity.message_content.substring(0, 80) + '...' 
            : activity.message_content;
        const hasMore = activity.message_content.length > 80;
        
        const timeAgo = moment(activity.timestamp).fromNow();
        
        return `
            <div class="activity-item p-3 border-bottom">
                <div class="d-flex align-items-start">
                    <div class="activity-icon mr-3">
                        <div class="rounded-circle ${color} d-flex align-items-center justify-content-center"
                            style="width: 40px; height: 40px;">
                            <i class="fa ${icon} text-white"></i>
                        </div>
                    </div>
                    <div class="activity-content flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start mb-2">
                            <div>
                                <h6 class="mb-1 font-weight-bold text-dark">${activity?.sender_info?.name}</h6>
                                <small class="text-muted">${activity?.sender_info?.contact}</small>
                            </div>
                            <small class="text-muted">${timeAgo}</small>
                        </div>
                        <div class="activity-message mb-3">
                            <p class="mb-0 text-dark">${preview}</p>
                            ${hasMore ? `<small class="text-primary cursor-pointer" onclick="showFullMessage(${activity.id})">@lang('app.activities.viewMore')</small>` : ''}
                        </div>
                        <div class="activity-actions d-flex">
                            <button class="btn btn-round btn-sm btn-outline-primary mr-2"
                                    onclick="replyToActivity(${activity.id}, '${activity.channel_type}')"
                                    title="@lang('app.activities.reply')"
                                    data-toggle="tooltip"
                                    data-placement="top">
                                <i class="fa fa-reply"></i>
                            </button>
                            <button class="btn btn-round btn-sm btn-outline-secondary"
                                    onclick="viewActivityDetails(${activity.id})"
                                    title="@lang('app.activities.view')"
                                    data-toggle="tooltip"
                                    data-placement="top">
                                <i class="fa fa-eye"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Render empty state
     */
    function renderEmptyState() {
        return `
            <div class="text-center py-4">
                <div class="empty-state">
                    <i class="fa fa-comments fa-3x text-muted mb-3"></i>
                    <h6 class="text-muted mb-2">@lang('app.activities.noActivitiesYet')</h6>
                    <p class="text-muted small mb-3">@lang('app.activities.noActivitiesDescription')</p>
                    <button class="btn btn-round btn-primary" 
                            onclick="startNewConversation()"
                            title="@lang('app.activities.startConversation')"
                            data-toggle="tooltip"
                            data-placement="top">
                        <i class="fa fa-plus"></i>
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Render view all button
     */
    function renderViewAllButton(totalCount) {
        return `
            <div class="text-center p-3">
                <a href="{{ route('deals.show', $deal->id) }}?tab=activities"
                    class="btn btn-outline-primary btn-sm">
                    @lang('app.activities.viewAllActivities') (${totalCount})
                </a>
            </div>
        `;
    }

    /**
     * Show error message
     */
    function showError(message) {
        const container = document.getElementById('activities-container');
        container.innerHTML = `
            <div class="text-center py-4">
                <i class="fa fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                <h6 class="text-danger mb-2">@lang('app.error')</h6>
                <p class="text-muted">${message}</p>
                <button class="btn btn-primary btn-sm" onclick="refreshActivities()">
                    @lang('app.activities.tryAgain')
                </button>
            </div>
        `;
    }

    /**
     * Updated startNewConversation to refresh after success
     */
    async function startNewConversation() {
        const dealData = {
            deal_id: dealId,
            email: @json($deal->contact->client_email ?? ''),
            phone_number: @json($deal->contact->whatsapp ?? $deal->contact->cell ?? ''),
            instagram_username: @json($deal->contact->instagram_username ?? ''),
            telegram_username: @json($deal->contact->telegram_username ?? ''),
            sender_info:{
                name: @json(auth()->user()->name),
                contact: @json(auth()->user()->email)
            }
        };

        const result = await Swal.fire({
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
            showLoaderOnConfirm: true, //TODO: SHould stop when a response is received
            preConfirm: async () => {
                const channelType = document.getElementById('channel-type').value;
                const messageVal = document.getElementById('new-message').value;

                if (!messageVal || messageVal.trim() === '') {
                    Swal.showValidationMessage('@lang('app.activities.messageRequired')');
                    return false;
                }

                const payload = {
                    channel_type: channelType,
                    message_content: messageVal,
                    direction: 'outbound',
                    timestamp: new Date().toISOString(),
                    ...dealData
                };

                if (channelType === 'email') {
                    delete payload.phone_number;
                    delete payload.instagram_username;
                    delete payload.telegram_username;  
                }
                if (channelType === 'whatsapp') {
                    delete payload.email;
                    delete payload.instagram_username;
                    delete payload.telegram_username;
                }
                if (channelType === 'telegram') {
                    delete payload.whatsapp;
                    delete payload.instagram_username;
                    delete payload.email;
                }
                if (channelType === 'instagram') {
                    delete payload.whatsapp;
                    delete payload.phone_number;
                    delete payload.email;
                }

                

                try {
                    const response = await fetch('/api/v1/internal/communication-activities', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-COMPANY-ID': @json(company()->id)
                        },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) {
                        const errorData = await response.json();
                        throw { status: response.status, data: errorData };
                    }

                    return await response.json();
                } catch (error) {
                    console.error('API Error:', error);
                    
                    let errorMessages = [];
                    

                    if (error.data) {
                        if (error.data.message) {
                            errorMessages.push(error.data.message);
                        }
                        if (error.data.error && error.data.error.details) {
                            Object.keys(error.data.error.details).forEach(field => {
                                const fieldErrors = error.data.error.details[field];
                                errorMessages.push(`${field}: ${Array.isArray(fieldErrors) ? fieldErrors.join(', ') : fieldErrors}`);
                            });
                        }
                    } else {
                        errorMessages.push(error.message || 'Unexpected error');
                    }

                    Swal.showValidationMessage(errorMessages.join('<br>'));
                    
                    return false;
                }
            }
        });

        if (result.isConfirmed) {
            Swal.fire({
                icon: 'success',
                title: '@lang('app.activities.conversationStarted')',
                text: '@lang('app.activities.conversationStartedSuccessfully')',
                timer: 2000,
                showConfirmButton: false
            });

            // Refresh activities after successful submission
            setTimeout(() => {
                refreshActivities();
            }, 1000);
        }
    }

    // Your other existing functions remain the same
    function showFullMessage(activityId) {
        Swal.fire({
            title: '@lang('app.messageDetails')',
            text: '@lang('app.featureNotAvailable')',
            icon: 'info',
            confirmButtonText: '@lang('app.ok')'
        });
    }

    function replyToActivity(activityId, channelType) {
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
        Swal.fire({
            title: '@lang('app.activityDetails')',
            text: '@lang('app.featureNotAvailable')',
            icon: 'info',
            confirmButtonText: '@lang('app.ok')'
        });
    }

    // Quick Actions Functions
    function sendEmail() {
        const email = @json($deal->contact->client_email ?? '');
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
        const phone = @json($deal->contact->mobile ?? '');
        if (phone) {
            const message = encodeURIComponent(`Hi {{ $deal->contact->client_name ?? 'there' }}, regarding {{ $deal->name }}`);
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
        const phone = @json($deal->contact->mobile ?? '');
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
        const email = @json($deal->contact->client_email ?? '');
        const clientName = @json($deal->contact->client_name ?? 'there');
        const userName = @json(auth()->user()->name);
        
        if (email) {
            const subject = encodeURIComponent('Meeting: {{ $deal->name }}');
            const body = encodeURIComponent(
                `Hi ${clientName},\n\nI'd like to schedule a meeting to discuss {{ $deal->name }}.\n\nBest regards,\n${userName}`
            );
            window.open(`mailto:${email}?subject=${subject}&body=${body}`, '_blank');
        } else {
            Swal.fire({
                icon: 'warning',
                title: '@lang('app.activities.noEmailAddress')',
                text: '@lang('app.activities.contactHasNoEmail')'
            });
        }
    }
</script>

{{-- Include Moment.js for time formatting --}}
<script src="https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.4/moment.min.js"></script>