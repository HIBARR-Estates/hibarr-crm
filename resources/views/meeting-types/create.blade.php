@extends('layouts.app')
@section('title', __('Create Meeting Type'))

@section('content')
    <div class="row">
        <div class="col-sm-12">
            <div class="d-flex justify-content-between align-items-center mb-3">
                <h4 class="mb-0">@lang('Create Meeting Type')</h4>
                <a href="{{ route('meeting-types.index') }}" class="btn btn-secondary">
                    <i class="fa fa-arrow-left"></i> @lang('Back to Meeting Types')
                </a>
            </div>

            <div class="card">
                <div class="card-body">
                    <form action="{{ route('meeting-types.store') }}" method="POST">
                        @csrf
                        
                        <div class="form-group">
                            <label for="name">@lang('Name') *</label>
                            <input type="text" class="form-control @error('name') is-invalid @enderror" 
                                   id="name" name="name" value="{{ old('name') }}" required>
                            @error('name')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="form-group">
                            <label for="description">@lang('Description')</label>
                            <textarea class="form-control @error('description') is-invalid @enderror" 
                                      id="description" name="description" rows="3">{{ old('description') }}</textarea>
                            @error('description')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="form-group">
                            <label for="color">@lang('Color') *</label>
                            <div class="input-group">
                                <input type="color" class="form-control @error('color') is-invalid @enderror" 
                                       id="color" name="color" value="{{ old('color', '#1d82f5') }}" required>
                                <input type="text" class="form-control" id="color_hex" 
                                       value="{{ old('color', '#1d82f5') }}" placeholder="#1d82f5">
                            </div>
                            @error('color')
                                <div class="invalid-feedback">{{ $message }}</div>
                            @enderror
                        </div>

                        <div class="form-group">
                            <button type="submit" class="btn btn-primary">
                                <i class="fa fa-save"></i> @lang('Create Meeting Type')
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
