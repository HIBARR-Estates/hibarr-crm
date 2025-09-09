<style>
    #event-status2 {
        border-radius: 0 5px 5px 0;
    }

    #event-status {
        border-radius: 5px 0 0 5px;
    }
</style>

<div id="task-detail-section">
    <div class="row">
        <div class="col-sm-12">
            <div class="card bg-white border-0 b-shadow-4">
                <div class="card-header bg-white  border-bottom-grey justify-content-between p-20">
                    <div class="row">
                        <div class="col-lg-8 text-left">
                            <h3 class="heading-h1 mb-3">{{ $keyResult->title }}</h3>
                        </div>
                        <div class="col-lg-4 text-right">
                            <div class="dropdown">
                                <button class="btn btn-lg f-14 px-2 py-1 text-dark-grey  rounded  dropdown-toggle"
                                    type="button" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
                                    <i class="fa fa-ellipsis-h"></i>
                                </button>

                                <div class="dropdown-menu dropdown-menu-right border-grey rounded b-shadow-4 p-0"
                                    aria-labelledby="dropdownMenuLink" tabindex="0">
                                    @if ($managePermission)
                                        <a class="dropdown-item openRightModal"
                                            href="{{ route('key-results.edit', $keyResult->id) }}"><i
                                                class="fa fa-edit mr-2"></i> @lang('app.edit')
                                        </a>

                                        <a class="dropdown-item delete-key-results" data-key-results-id="{{ $keyResult->id }}"><i class="fa fa-trash mr-2"></i>
                                            @lang('app.delete')</a>

                                        <a class="dropdown-item add-check-in" data-key-id="{{ $keyResult->id }}"><i class="fa fa-plus mr-2"></i>
                                            @lang('performance::app.checkIn')</a>
                                    @endif
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    <x-cards.data-row :label="__('performance::app.keyResultsTitle')" :value="$keyResult->title" html="true" />
                    @if ($keyResult->metrics)
                        <x-cards.data-row :label="__('performance::app.objective')" :value="$keyResult->objective->title" html="true" />
                    @endif
                    @if ($keyResult->metrics)
                        <x-cards.data-row :label="__('performance::app.keyResultsMetrics')" :value="$keyResult->metrics->name" html="true" />
                    @endif
                    @if ($keyResult->current_value !== null)
                        <x-cards.data-row :label="__('performance::app.currentValue')" :value="number_format((float) $keyResult->current_value, 2)" html="true" />
                    @endif
                    @if ($keyResult->target_value !== null)
                        <x-cards.data-row :label="__('performance::app.targetValue')" :value="number_format((float) $keyResult->target_value, 2)" html="true" />
                    @endif

                    <div class="card-text f-14 text-dark-grey text-justify">
                        <x-table class="table-bordered my-3 rounded">
                            <x-slot name="thead">
                                <tr>
                                    <th colspan="5" class="text-center text-dark" style="background-color: #c8d3dd !important;">@lang('performance::app.checkIns')</th>
                                </tr>
                                <tr>
                                    <th> @lang('performance::app.keyResultsTitle')</th>
                                    <th class="text-left">@lang('performance::app.progressUpdate')</th>
                                    <th class="text-left">@lang('performance::app.currentValue')</th>
                                    <th class="text-left">@lang('performance::app.confidenceLevel')</th>
                                    <th class="text-left">@lang('performance::app.checkInDate')</th>
                                </tr>
                            </x-slot>

                            @if (count($keyResult->checkIns) > 0)
                                @foreach ($keyResult->checkIns as $check => $checkIn)
                                    <tr>
                                        <td class="text-left">{{ $checkIn->keyResult ? $checkIn->keyResult->title : '--' }}</td>
                                        <td class="text-left">{{ $checkIn->progress_update ?: '--' }}</td>
                                        <td class="text-left">{{ $checkIn->current_value !== null ? number_format((float)$checkIn->current_value, 2) : '--' }}</td>
                                        <td class="text-left">
                                            <span class="badge
                                                {{ $checkIn->confidence_level === 'high' ? 'badge-danger' : '' }}
                                                {{ $checkIn->confidence_level === 'medium' ? 'badge-warning' : '' }}
                                                {{ $checkIn->confidence_level === 'low' ? 'badge-success' : '' }}
                                                {{ !in_array($checkIn->confidence_level, ['high', 'medium', 'low']) ? 'badge-primary' : '' }}">
                                                {{ $checkIn->confidence_level ? __('performance::app.' . $checkIn->confidence_level) : '--' }}
                                            </span>
                                        </td>
                                        <td class="text-left">{{ $checkIn->check_in_date ? \Carbon\Carbon::parse($checkIn->check_in_date)?->translatedFormat($company->date_format) : '--' }}</td>
                                    </tr>
                                @endforeach
                            @elseif (count($keyResult->checkIns) == 0)
                                <tr>
                                    <td colspan="5">
                                        <x-cards.no-record icon="redo" :message="__('messages.noRecordFound')" />
                                    </td>
                                </tr>
                            @endif
                        </x-table>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    var currentPageUrl = "{{ url()->current() }}";
    var breadCrumbUrl = "{{ route('objectives.index') }}";
    var breadCrumbText = "@lang('performance::app.objectives')";

    $(document).ready(function(e) {
        if (window.location.href == currentPageUrl) {
            $('.page-heading a[href]').eq(1)
                .attr('href', breadCrumbUrl).text(breadCrumbText);
        }
    });

    $('.add-check-in').click(function (e) {
        let keyId = $(this).data('key-id');
        var url = "{{ route('check-ins.create') }}?keyResultId="+keyId;
        $(MODAL_LG + ' ' + MODAL_HEADING).html('...');
        $.ajaxModal(MODAL_LG, url);
    });

    $('body').on('click', '.delete-key-results', function() {
        Swal.fire({
            title: "@lang('messages.sweetAlertTitle')",
            text: "@lang('messages.recoverRecord')",
            icon: 'warning',
            showCancelButton: true,
            focusConfirm: false,
            confirmButtonText: "@lang('messages.confirmDelete')",
            cancelButtonText: "@lang('app.cancel')",
            customClass: {
                confirmButton: 'btn btn-primary mr-3',
                cancelButton: 'btn btn-secondary'
            },
            showClass: {
                popup: 'swal2-noanimation',
                backdrop: 'swal2-noanimation'
            },
            buttonsStyling: false
        }).then((result) => {
            if (result.isConfirmed) {
                var id = $(this).data('key-results-id');
                var token = "{{ csrf_token() }}";

                var url = "{{ route('key-results.destroy', ':id') }}";
                url = url.replace(':id', id);

                $.easyAjax({
                    type: 'POST',
                    url: url,
                    blockUI: true,
                    data: {
                        '_token': token,
                        '_method': 'DELETE'
                    },
                    success: function(response) {
                        if (response.status == "success") {
                            window.location.href = "{{ route('objectives.index') }}";
                        }
                    }
                });
            }
        });
    });
</script>
