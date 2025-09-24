@extends('layouts.app')
@section('title', __('Edit Meeting Type'))

@section('content')
    <div class="row">
        <div class="col-sm-12">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="mb-0">@lang('Edit Meeting Type')</h4>
                <a href="{{ route('meeting-types.index') }}" class="btn btn-secondary">
                    <i class="fa fa-arrow-left"></i> @lang('Back to Meeting Types')
                </a>
            </div>

            <div class="card">
                <div class="card-body">
                    <form action="{{ route('meeting-types.update', $meetingType->id) }}" method="POST">
                        @csrf
                        @method('PUT')
                        
                        <div class="form-group">
                            <label for="name">@lang('Name') *</label>
                            <input type="text" class="form-control @error('name') is-invalid @enderror" 
                                   id="name" name="name" value="{{ old('name', $meetingType->name) }}" required>
                            @error('name')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="form-group">
                            <label for="description">@lang('Description')</label>
                            <textarea class="form-control @error('description') is-invalid @enderror" 
                                      id="description" name="description" rows="3">{{ old('description', $meetingType->description) }}</textarea>
                            @error('description')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="form-group">
                            <label for="color">@lang('Color') *</label>
                            <div class="input-group">
                                <input type="color" class="form-control @error('color') is-invalid @enderror" 
                                       id="color" name="color" value="{{ old('color', $meetingType->color) }}" required>
                                <input type="text" class="form-control" id="color_hex" 
                                       value="{{ old('color', $meetingType->color) }}" placeholder="#1d82f5">
                            </div>
                            @error('color')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="form-group">
                            <button type="submit" class="btn btn-primary">
                                <i class="fa fa-save"></i> @lang('Update Meeting Type')
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
@endsection

@push('scripts')
<script>
    $(document).ready(function() {
        // Sync color picker with hex input
        $('#color').on('input', function() {
            $('#color_hex').val($(this).val());
        });

        $('#color_hex').on('input', function() {
            const value = $(this).val();
            if (value.match(/^#[0-9A-F]{6}$/i)) {
                $('#color').val(value);
            }
        });
    });
</script>
@endpush
