@php
$addLeadFollowUpPermission = user()->permission('add_lead_follow_up');
$viewLeadFollowUpPermission = user()->permission('view_lead_follow_up');
$editLeadFollowUpPermission = user()->permission('edit_lead_follow_up');
$deleteLeadFollowUpPermission = user()->permission('delete_lead_follow_up');
@endphp

<!-- TAB CONTENT START -->
<div class="tab-pane fade show active" role="tabpanel" aria-labelledby="nav-email-tab">


    <div class="d-flex flex-wrap p-20" id="task-file-list">
        @if ($viewLeadFollowUpPermission == 'all' || $viewLeadFollowUpPermission == 'added')
        

            <x-table headType="thead-light">
                <x-slot name="thead">
                    <th>@lang('modules.lead.nextFollowUp')</th>
                    <th>@lang('Meeting Type')</th>
                    <th>@lang('Meeting Link')</th>
                    <th>@lang('app.status')</th>
                    <th class="text-right">@lang('app.action')</th>
                </x-slot>
                <tbody id="followUpTableBody">
                    @forelse ($dealFollowUps as $folllowUp)
                        <tr class="follow-up-row" data-created-at="{{ $folllowUp->created_at->timestamp }}" style="display: none;">
                            <td>{{ $folllowUp->next_follow_up_date->format(company()->date_format . ' ' . company()->time_format) }}</td>
                            <td>
                                @if ($folllowUp->meetingType)
                                    <span style="text-color:black;">
                                        {{ $folllowUp->meetingType->name }}
                                    </span>
                                @else
                                    <span class="text-muted">--</span>
                                @endif
                            </td>
                            
                            <td>
                                @if ($folllowUp->location != 'office')
                                   @if ($folllowUp->meeting_link)
                                   <div>
                                       @switch($folllowUp->location)
                                           @case('zoom')
                                               <a href="{{ $folllowUp->meeting_link }}" target="_blank" class="d-flex align-items-center">
                                                   <img src="https://img.icons8.com/color/20/000000/zoom.png" alt="Zoom" class="mr-2" style="width: 20px; height: 20px;">
                                                    <span class="text-info" style="text-decoration: underline;">Join Meeting</span>
                                               </a>
                                               @break
                                           @case('google_meet')
                                               <a href="{{ $folllowUp->meeting_link }}" target="_blank" class="d-flex align-items-center">
                                                   <img src="https://img.icons8.com/color/20/000000/google-meet.png" alt="Google Meet" class="mr-2" style="width: 20px; height: 20px;">
                                                   <span class="text-info" style="text-decoration: underline;">Join Meeting</span>
                                               </a>
                                               @break
                                           @case('zoho_meet')
                                               <a href="{{ $folllowUp->meeting_link }}" target="_blank" class="d-flex align-items-center">
                                                   <img src="https://img.icons8.com/color/20/000000/zoho.png" alt="Zoho Meet" class="mr-2" style="width: 20px; height: 20px;">
                                                   <span class="text-info" style="text-decoration: underline;">Join Meeting</span>
                                               </a>
                                               @break
                                           @default
                                               <a href="{{ $folllowUp->meeting_link }}" target="_blank" class="d-flex align-items-center">
                                                   <i class="fa fa-external-link-alt mr-2"></i>
                                                   <span class="text-primary">Join Meeting</span>
                                               </a>
                                       @endswitch
                                   </div>
                                   @else
                                        <div class="d-flex align-items-center">
                                          
                                            <div class="d-flex align-items-center" >
                                               @switch($folllowUp->location)
                                                @case('zoom')
                                                    <img src="https://img.icons8.com/color/20/000000/zoom.png" alt="Zoom" class="mr-2" style="width: 20px; height: 20px;">
                                                    @break
                                                @case('google_meet')
                                                    <img src="https://img.icons8.com/color/20/000000/google-meet.png" alt="Google Meet" class="mr-2" style="width: 20px; height: 20px;">
                                                    @break
                                                @case('zoho_meet')
                                                    <img src="https://img.icons8.com/color/20/000000/zoho.png" alt="Zoho Meet" class="mr-2" style="width: 20px; height: 20px;">
                                                    @break
                                                @default
                                                
                                            @endswitch
                                        <div class="generate-meeting-link d-flex align-items-center" 
                                             data-followup-id="{{ $folllowUp->id }}"
                                             style="padding:4px 8px; align-items: center; background-color:rgb(212, 0, 0); border-radius: 4px; color:#fff; text-decoration: none; cursor: pointer;">
                                           
                                           <i class="fa fa-magic mr-2"></i><span>Generate</span>
                                        </div> 
                                    </div>
                                </div>

                                      
                                   @endif
                                @else
                                    <div>
                                        <i class="fa fa-building text-primary" style="margin-right:8px; width:18px; height:18px;"></i> Hibarr Office
                                    </div>
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
                                    <button class="btn btn-lg f-14 p-0 text-lightest rounded dropdown-toggle"
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
                        <tr id="noDataRow">
                            <td colspan="5">
                                <x-cards.no-record :message="__('messages.noRecordFound')" icon="clock" />
                            </td>
                        </tr>
                    @endforelse
                </tbody>
            </x-table>
        @endif
            <!-- Pagination Controls -->
            <div class="row w-100 mb-3">
                <div class="col-md-12 text-right">
                    <div class="d-flex align-items-center justify-content-end">
                        <span id="paginationInfo" class="mr-3" style="color: #6c757d; font-size: 14px;">Showing 1 to 10 of 0 entries</span>
                        <div id="paginationControls" class="d-flex align-items-center">
                            <button id="prevPage" class="btn btn-sm mr-1" disabled 
                                    style="border: 1px solid #dee2e6; background-color: #fff; color: #6c757d; padding: 6px 12px; border-radius: 4px; font-size: 14px;">
                                Previous
                            </button>
                            <span id="pageNumbers" class="mx-1"></span>
                            <button id="nextPage" class="btn btn-sm ml-1" disabled 
                                    style="border: 1px solid #dee2e6; background-color: #fff; color: #6c757d; padding: 6px 12px; border-radius: 4px; font-size: 14px;">
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            </div>
    </div>
</div>
<!-- TAB CONTENT END -->

<script>
$(document).ready(function() {
    let currentPage = 1;
    let itemsPerPage = 10;
    let totalItems = 0;
    let totalPages = 0;
    let allRows = [];

    // Initialize pagination
    function initPagination() {
        allRows = $('.follow-up-row').toArray();
        totalItems = allRows.length;
        
        if (totalItems === 0) {
            $('#noDataRow').show();
            updatePaginationInfo();
            return;
        }
        
        // Sort rows by creation date in descending order (newest first)
        allRows.sort(function(a, b) {
            const dateA = parseInt($(a).data('created-at'));
            const dateB = parseInt($(b).data('created-at'));
            return dateB - dateA; // Descending order (newest first)
        });
        
        // Re-append sorted rows to maintain order in DOM
        const tbody = $('#followUpTableBody');
        tbody.empty();
        allRows.forEach(function(row) {
            tbody.append(row);
        });
        
        totalPages = Math.ceil(totalItems / itemsPerPage);
        showPage(1);
        updatePaginationInfo();
        updatePaginationControls();
    }

    // Show specific page
    function showPage(page) {
        // Hide all rows
        $('.follow-up-row').hide();
        $('#noDataRow').hide();
        
        if (totalItems === 0) {
            $('#noDataRow').show();
            return;
        }
        
        // Calculate start and end indices
        const startIndex = (page - 1) * itemsPerPage;
        const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
        
        // Show rows for current page
        for (let i = startIndex; i < endIndex; i++) {
            $(allRows[i]).show();
        }
        
        currentPage = page;
        updatePaginationInfo();
        updatePaginationControls();
    }

    // Update pagination info
    function updatePaginationInfo() {
        if (totalItems === 0) {
            $('#paginationInfo').text('Showing 0 to 0 of 0 entries');
            return;
        }
        
        const startItem = (currentPage - 1) * itemsPerPage + 1;
        const endItem = Math.min(currentPage * itemsPerPage, totalItems);
        $('#paginationInfo').text(`Showing ${startItem} to ${endItem} of ${totalItems} entries`);
    }

    // Update pagination controls
    function updatePaginationControls() {
        // Update prev/next buttons
        $('#prevPage').prop('disabled', currentPage === 1);
        $('#nextPage').prop('disabled', currentPage === totalPages);
        
        // Update page numbers
        let pageNumbersHtml = '';
        const maxVisiblePages = 5;
        let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
        
        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            if (i === currentPage) {
                // Active page - blue background
                pageNumbersHtml += `<button class="btn btn-sm page-btn mr-1" data-page="${i}" 
                    style="background-color: #007bff; color: #fff; border: 1px solid #007bff; padding: 6px 12px; border-radius: 4px; font-size: 14px; min-width: 32px;">${i}</button>`;
            } else {
                // Inactive page - grey border
                pageNumbersHtml += `<button class="btn btn-sm page-btn mr-1" data-page="${i}" 
                    style="background-color: #fff; color: #6c757d; border: 1px solid #dee2e6; padding: 6px 12px; border-radius: 4px; font-size: 14px; min-width: 32px;">${i}</button>`;
            }
        }
        
        $('#pageNumbers').html(pageNumbersHtml);
    }

    // Event handlers
    $('#itemsPerPage').on('change', function() {
        itemsPerPage = parseInt($(this).val());
        totalPages = Math.ceil(totalItems / itemsPerPage);
        currentPage = 1;
        showPage(1);
    });

    $('#prevPage').on('click', function() {
        if (currentPage > 1) {
            showPage(currentPage - 1);
        }
    });

    $('#nextPage').on('click', function() {
        if (currentPage < totalPages) {
            showPage(currentPage + 1);
        }
    });

    $(document).on('click', '.page-btn', function() {
        const page = parseInt($(this).data('page'));
        showPage(page);
    });

    // Initialize pagination when page loads
    initPagination();

    // Generate Meeting Link functionality
    $(document).on('click', '.generate-meeting-link', function(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const followUpId = $(this).data('followup-id');
        const button = $(this);
        const originalContent = button.html();
        
        // Prevent multiple clicks
        if (button.prop('disabled')) {
            return false;
        }
        
        // Show loading notification
        Swal.fire({
            icon: 'info',
            text: 'Generating meeting link...',
            toast: true,
            position: "top-end",
            timer: 2000,
            timerProgressBar: true,
            showConfirmButton: false,
            customClass: {
                confirmButton: "btn btn-primary",
            },
            showClass: {
                popup: "swal2-noanimation",
                backdrop: "swal2-noanimation",
            },
        });
        
        // Show loading state
        button.html('<i class="fa fa-spinner fa-spin mr-2"></i><span>Generating...</span>');
        button.prop('disabled', true);
        
        $.ajax({
            url: '{{ route("deals.generate-meeting-link") }}',
            type: 'POST',
            data: {
                followup_id: followUpId,
                _token: '{{ csrf_token() }}'
            },
            success: function(response) {
                if (response.status === 'success') {
                    // Show success state - change to Join Meeting style
                    button.html('<span class="text-primary">Join Meeting</span>');
                    button.css({
                        'background-color': 'transparent',
                        'color': '#007bff',
                        'text-decoration': 'underline',
                    });
                    button.removeClass('generate-meeting-link').addClass('join-meeting-link');
                    button.prop('disabled', false);
                    
                    // Show success notification
                    Swal.fire({
                        icon: 'success',
                        text: 'Meeting link generated successfully!',
                        toast: true,
                        position: "top-end",
                        timer: 3000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        customClass: {
                            confirmButton: "btn btn-primary",
                        },
                        showClass: {
                            popup: "swal2-noanimation",
                            backdrop: "swal2-noanimation",
                        },
                    });
                    
                    // Reload the follow-up table to show the new meeting link
                    setTimeout(function() {
                        location.reload();
                    }, 1500);
                } else {
                    // Error - return to original Generate button
                    button.html(originalContent);
                    button.css({
                        'background-color': 'rgb(212, 0, 0)',
                        'border': 'none',
                        'color': '#fff',
                        'text-decoration': 'none'
                    });
                    button.prop('disabled', false);
                    
                    // Show error notification
                    Swal.fire({
                        icon: 'error',
                        text: 'Failed to generate meeting link if issue persists please contact support',
                        toast: true,
                        position: "top-end",
                        timer: 40000,
                        timerProgressBar: true,
                        showConfirmButton: false,
                        customClass: {
                            confirmButton: "btn btn-primary",
                        },
                        showClass: {
                            popup: "swal2-noanimation",
                            backdrop: "swal2-noanimation",
                        },
                    });
                }
            },
            error: function(xhr, status, error) {
                // Error - return to original Generate button
                button.html(originalContent);
                button.css({
                    'background-color': 'rgb(212, 0, 0)',
                    'border': 'none',
                    'color': '#fff',
                    'text-decoration': 'none'
                });
                button.prop('disabled', false);
                
                // Show error notification
                Swal.fire({
                    icon: 'error',
                    text: 'Failed to generate meeting link. If issue persists please contact support',
                    toast: true,
                    position: "top-end",
                    timer: 4000,
                    timerProgressBar: true,
                    showConfirmButton: false,
                    customClass: {
                        confirmButton: "btn btn-primary",
                    },
                    showClass: {
                        popup: "swal2-noanimation",
                        backdrop: "swal2-noanimation",
                    },
                });
            }
        });
    });
});
</script>

