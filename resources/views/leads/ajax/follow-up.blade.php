@php
$addLeadFollowUpPermission = user()->permission('add_lead_follow_up');
$viewLeadFollowUpPermission = user()->permission('view_lead_follow_up');
$editLeadFollowUpPermission = user()->permission('edit_lead_follow_up');
$deleteLeadFollowUpPermission = user()->permission('delete_lead_follow_up');
@endphp

<!-- TAB CONTENT START -->
<div class="tab-pane fade show active" role="tabpanel" aria-labelledby="nav-email-tab">
    <div class="d-flex p-20">
        @if ($deal->leadStage->slug == 'win' || $deal->leadStage->slug == 'lost')
            <x-alert type="info" icon="info-circle">@lang('messages.cantAddFollowup') </x-alert>
        @endif
        @if ($deal->leadStage->slug != 'win' && $deal->leadStage->slug != 'lost' && ($addLeadFollowUpPermission == 'all' || $addLeadFollowUpPermission == 'added'))
            <div class="row">
                <div class="col-md-12">
                    <a class="f-15 f-w-500" href="javascript:;" id="add-lead-followup"><i
                            class="icons icon-plus font-weight-bold mr-1"></i>@lang('modules.followup.newFollowUp')</a>
                </div>
            </div>
        @endif
    </div>

    <div class="d-flex flex-wrap p-20" id="task-file-list">
        @if ($viewLeadFollowUpPermission == 'all' || $viewLeadFollowUpPermission == 'added')
            <x-table headType="thead-light">
                <x-slot name="thead">
                    <!-- <th>@lang('app.createdOn')</th> -->
                    <th>@lang('modules.lead.nextFollowUp')</th>
                    <th>@lang('Meeting Type')</th>
                    <!-- <th>@lang('Location')</th> -->
                    <th>@lang('Meeting Link')</th>
                    <th>@lang('app.status')</th>
                    <th class="text-right">@lang('app.action')</th>
                </x-slot>

                @forelse ($dealFollowUps as $folllowUp)
                    <tr id="row-{{ $folllowUp->id }}">
                        <!-- <td>{{ $folllowUp->created_at->timezone(company()->timezone)->format(company()->date_format . ' ' . company()->time_format) }}</td> -->
                        <td>{{ $folllowUp->next_follow_up_date->format(company()->date_format . ' ' . company()->time_format) }}</td>
                        <td>
                            @if ($folllowUp->meetingType)
                                <span>
                                    {{ $folllowUp->meetingType->name }}
                                </span>
                            @else
                                <span class="text-muted">--</span>
                            @endif
                        </td>
                        <td class = "d-flex ">
                        @php
                            $loc = $folllowUp->location;
                            $hasLink = $folllowUp->meeting_link && $folllowUp->meeting_link !== 'null' && $folllowUp->meeting_link !== null;
                        @endphp

                        @switch($loc)
                            @case('office')
                                <i class="fa fa-building text-info " title="Office" style="margin-right: 16px;"></i>
                                <span class="ms-2 text-muted"> Hibarr HQ</span>
                                @break

                            @case('zoom')
                                <img src="https://img.icons8.com/color/20/000000/zoom.png" alt="Zoom" title="Zoom" style="width: 20px; height: 20px; margin-right: 8px;">
                                @break

                            @case('zoho_meet')
                                <img src="data:image/png;base64,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" alt="Zoho Meet" title="Zoho Meet" style="width: 20px; height: 20px; margin-right: 8px;">
                                @break

                            @case('google_meet')
                                <img src="https://img.icons8.com/color/20/000000/google-meet.png" alt="Google Meet" title="Google Meet" style="width: 20px; height: 20px; margin-right: 8px;">
                                @break

                            @default
                                <span class="text-muted"> Hibarr HQ</span>
                        @endswitch

                        @if ($loc !== 'office')
                            @if ($hasLink)
                                <a href="{{ $folllowUp->meeting_link }}" target="_blank" rel="noopener noreferrer"
                                class="ms-2 d-flex align-items-center" style="text-decoration: underline;">
                                    Join Meeting
                                </a>
                            @else
                                <div class="ms-2 d-flex align-items-center">
                                    <button class="generate-meeting-link-btn" data-followup-id="{{ $folllowUp->id }}" 
                                            style="background: rgb(221, 24, 24);
                                                   border: none;
                                                   border-radius: 5px;
                                                   padding: 4px 8px;
                                                   color: #fff;
                                                   font-weight: 500;
                                                   font-size: 13px;
                                                   cursor: pointer;
                                                   transition: all 0.3s ease;
                                                   display: inline-flex;
                                                   align-items: center;
                                                   gap: 6px;">
                                        <i class="fa fa-magic" style="font-size: 12px;"></i>
                                        Generate
                                    </button>
                                </div>
                            @endif
                        @endif
                        </td>
                        <td>
                            @if ($folllowUp->status == 'pending')
                                <i class="fa fa-circle mr-1 text-yellow f-10"></i>
                            @elseif ($folllowUp->status == 'canceled')
                                <i class="fa fa-circle mr-1 text-red f-10"></i>
                            @elseif ($folllowUp->status == 'completed')
                                <i class="fa fa-circle mr-1 text-dark-green f-10"></i>
                            @endif
                            {{ ucfirst($folllowUp->status) }}
                        </td>
                        <td class="text-right">
                            <div class="dropdown ml-auto file-action">
                                <button class="btn btn-lg f-14 p-0 text-lightest  rounded  dropdown-toggle"
                                    type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="fa fa-ellipsis-h"></i>
                                </button>
                                <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                        aria-labelledby="dropdownMenuLink" tabindex="0">
                                    @if ($editLeadFollowUpPermission == 'all' || ($editLeadFollowUpPermission == 'added' && $folllowUp->added_by == user()->id))
                                        <a class="cursor-pointer d-block text-dark-grey f-13 py-3 px-3 edit-table-row-lead"
                                            href="javascript:;" data-followup-id="{{ $folllowUp->id }}">
                                            @lang('app.edit')
                                        </a>
                                    @endif
                                    @if ($deleteLeadFollowUpPermission == 'all' || ($deleteLeadFollowUpPermission == 'added' && user()->id == $folllowUp->added_by))
                                        <a class="cursor-pointer d-block text-dark-grey f-13 pb-3 px-3 delete-table-row-lead"
                                            data-followup-id="{{ $folllowUp->id }}" href="javascript:;">
                                            @lang('app.delete')
                                        </a>
                                    @endif
                                </div>
                            </div>
                        </td>
                    </tr>
                @empty
                    <tr>
                        <td colspan="10">
                            <x-cards.no-record :message="__('messages.noRecordFound')" icon="clock" />
                        </td>
                    </tr>
                @endforelse
            </x-table>
        @endif
    </div>
    
    @if($dealFollowUps->hasPages())
        <div class="d-flex justify-content-between align-items-right col-md-12" style="padding: 15px 20px; border-top: 1px solid #e8eef3; background: white;">
            
            <div class="d-flex align-items-center">
                <span class="text-muted f-13 mr-3">
                    Showing {{ $dealFollowUps->firstItem() }} to {{ $dealFollowUps->lastItem() }} of {{ $dealFollowUps->total() }} entries
                </span>
                <div class="pagination-wrapper">
                    {{ $dealFollowUps->appends(['tab' => 'follow-up'])->links('pagination::bootstrap-4') }}
                </div>
            </div>
        </div>
    @endif
</div>
<!-- TAB CONTENT END -->

<script>
$(document).ready(function() {
    // Handle generate meeting link button click
    $(document).on('click', '.generate-meeting-link-btn', function(e) {
        e.preventDefault();
        
        const button = $(this);
        const followupId = button.data('followup-id');
        
        // Disable button immediately to prevent multiple clicks
        button.prop('disabled', true)
              .html('<i class="fa fa-spinner fa-spin"></i> Generating...');
        
        $.easyAjax({
            url: "{{ route('deals.generate_meeting_link') }}",
            type: 'POST',
            container: '#task-file-list',
            timeout: 30000,
            messagePosition: 'toastr',
            data: {
                followup_id: followupId,
                _token: "{{ csrf_token() }}"
            },
            success: function(response) {
                console.log('Meeting link generation response:', response);
                console.log('Response status:', response.status);
                console.log('Meeting link:', response.meeting_link);
                console.log('Button element:', button);
                
                if (response.status === 'success' && response.meeting_link) {
                    console.log('Converting button to meeting link...');
                    
                    // Convert button to anchor link
                    const linkHtml = `<a href="${response.meeting_link}" target="_blank" 
                                        class="join-meeting-btn ms-2 d-flex align-items-center" 
                                        style="
                                               text-decoration: underline;
                                               opacity: 1;
                                               cursor: pointer;
                                               border: none;
                                               border-radius: 5px;
                                               color: #007bff;
                                               font-weight: 300;
                                               font-size: 13px;
                                               display: inline-flex;
                                               align-items: center;
                                               gap: 6px;">
                                        
                                        Join Meeting
                                     </a>`;
                    
                    // Replace the button with the link
                    button.parent().html(linkHtml);
                    
                    console.log('Button converted to link with href:', response.meeting_link);
                } else {
                    console.log('No meeting link in response, resetting button');
                    // Reset button to default state on failure
                    resetButton(button, followupId);
                }
            },
            error: function(xhr, status, error) {
                console.error('Error generating meeting link:', error);
                // Reset button to default state on error
                resetButton(button, followupId);
            }
        });
    });
    
    // Function to reset button to default state
    function resetButton(button, followupId) {
        // Find the parent div and reset the entire structure
        const parentDiv = button.closest('div');
        parentDiv.html(`
            <button class="generate-meeting-link-btn" data-followup-id="${followupId}" 
                    style="background: rgb(221, 24, 24);
                           border: none;
                           border-radius: 5px;
                           padding: 4px 8px;
                           color: #fff;
                           font-weight: 500;
                           font-size: 13px;
                           cursor: pointer;
                           transition: all 0.3s ease;
                           display: inline-flex;
                           align-items: center;
                           gap: 6px;">
                <i class="fa fa-magic" style="font-size: 12px;"></i>
                Generate
            </button>
        `);
    }
    
    // Handle pagination clicks with AJAX - following existing codebase pattern
    $(document).on('click', '.pagination-wrapper a', function(e) {
        e.preventDefault();
        
        const url = $(this).attr('href');
        const dealId = {{ $deal->id }};
        
        // Extract page number from URL
        let page = 1;
        if (url.includes('page=')) {
            const urlParams = new URLSearchParams(url.split('?')[1]);
            page = urlParams.get('page') || 1;
        }
        
        loadFollowUpPage(dealId, page);
    });
    
    // Handle per-page selection change
    $(document).on('change', '#per-page-select', function() {
        const dealId = {{ $deal->id }};
        const perPage = $(this).val();
        
        loadFollowUpPage(dealId, 1, perPage);
    });
    
    // Function to load follow-up page with AJAX
    function loadFollowUpPage(dealId, page = 1, perPage = null) {
        
        
        const data = { page: page };
        if (perPage) {
            data.per_page = perPage;
        }
        
        // Use the same pattern as existing tab switching
        $.easyAjax({
            url: "{{ route('deals.follow_up_ajax', ':id') }}".replace(':id', dealId),
            type: 'GET',
            blockUI: true,
            container: '#task-file-list',
            data: data,
            success: function(response) {
                if (response.status == "success") {
                    // Extract only the table body content from the response
                    const $response = $(response.html);
                    const $newTableBody = $response.find('tbody');
                    const $newPagination = $response.find('.pagination-wrapper').parent();
                    const $newPerPageSelect = $response.find('#per-page-select');
                    
                    // Update only the table body
                    $('table tbody').html($newTableBody.html());
                    
                    // Update pagination info and links
                    $('.pagination-wrapper').parent().replaceWith($newPagination);
                    
                    // Update per-page select
                    $('#per-page-select').replaceWith($newPerPageSelect);
                    
                    // Re-initialize any necessary components
                    $(".select-picker").selectpicker();
                }
            }
        });
    }
});
</script>

