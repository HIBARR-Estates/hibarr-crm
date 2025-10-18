@extends('layouts.app')
@section('title', __('Meeting Types'))

@section('content')
    <div class="row">
        <div class="col-sm-12">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="mb-0">@lang('Meeting Types')</h4>
                <a href="{{ route('meeting-types.create') }}" class="btn btn-primary">
                    <i class="fa fa-plus"></i> @lang('Add Meeting Type')
                </a>
            </div>

            <div class="card">
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>@lang('Name')</th>
                                    <th>@lang('Description')</th>
                                    <th>@lang('Color')</th>
                                    <th>@lang('Actions')</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($meetingTypes as $meetingType)
                                    <tr>
                                        <td>
                                            <span class="badge" style="background-color: {{ $meetingType->color }}; color: white;">
                                                {{ $meetingType->name }}
                                            </span>
                                        </td>
                                        <td>{{ $meetingType->description ?: '--' }}</td>
                                        <td>
                                            <div class="d-flex align-items-center">
                                                <div class="color-preview" style="width: 20px; height: 20px; background-color: {{ $meetingType->color }}; border-radius: 3px; margin-right: 10px;"></div>
                                                {{ $meetingType->color }}
                                            </div>
                                        </td>
                                        <td>
                                            <div class="btn-group">
                                                <a href="{{ route('meeting-types.edit', $meetingType->id) }}" class="btn btn-sm btn-info">
                                                    <i class="fa fa-edit"></i>
                                                </a>
                                                <button type="button" class="btn btn-sm btn-danger delete-meeting-type" data-id="{{ $meetingType->id }}">
                                                    <i class="fa fa-trash"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                @empty
                                    <tr>
                                        <td colspan="4" class="text-center">@lang('No meeting types found')</td>
                                    </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
<script>
    $(document).ready(function() {
        $('.delete-meeting-type').click(function() {
            const id = $(this).data('id');
            
            Swal.fire({
                title: "@lang('Are you sure?')",
                text: "@lang('This action cannot be undone.')",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonText: "@lang('Yes, delete it!')",
                cancelButtonText: "@lang('Cancel')",
                customClass: {
                    confirmButton: 'btn btn-danger mr-3',
                    cancelButton: 'btn btn-secondary'
                },
                buttonsStyling: false
            }).then((result) => {
                if (result.isConfirmed) {
                    $.ajax({
                        url: `/meeting-types/${id}`,
                        type: 'DELETE',
                        data: {
                            _token: '{{ csrf_token() }}'
                        },
                        success: function(response) {
                            if (response.status === 'success') {
                                Swal.fire({
                                    title: "@lang('Deleted!')",
                                    text: response.message,
                                    icon: 'success'
                                }).then(() => {
                                    window.location.reload();
                                });
                            }
                        },
                        error: function() {
                            Swal.fire({
                                title: "@lang('Error!')",
                                text: "@lang('Something went wrong.')",
                                icon: 'error'
                            });
                        }
                    });
                }
            });
        });
    });
</script>
@endpush
