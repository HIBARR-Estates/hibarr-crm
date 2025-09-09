<div class="modal fade" id="phoneModal" role="dialog">
    <div class="modal-dialog">

        <!-- Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title">@lang('biolinks::app.phoneCollector')</h4>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>

            <div class="modal-body">
                <div class="row" id="phone-form">
                    <div class="col-md-12">
                        <form id="phone-collector-form" method="POST" class="ajax-form">
                            @csrf
                            <input type="hidden" name="is_agreement" value="{{ $phoneBlock->show_agreement }}">
                            <div class="form-group">
                                <label for="phone">@lang('app.phone')</label>
                                <input type="tel" class="form-control" id="phone" name="phone">
                                <div class="invalid-feedback" id="phone-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="phone-name">@lang('app.name')</label>
                                <input type="text" class="form-control" id="phone-name" name="name">
                                <div class="invalid-feedback" id="phone-name-error"></div>
                            </div>

                            @if ($phoneBlock->show_agreement)
                                <div class="form-group form-check">
                                    <input type="checkbox" class="form-check-input" id="phone-agreement"
                                        name="agreement">
                                    <label class="form-check-label" for="phone-agreement">
                                        @lang('biolinks::app.agreeTerms') <a href="{{ $phoneBlock->agreement_url }}"
                                            target="_blank">{{ $phoneBlock->agreement_text }}</a>.
                                    </label>
                                    <div class="invalid-feedback" id="phone-agreement-error"></div>
                                </div>
                            @endif

                            <button type="submit" class="btn btn-primary">{{ $phoneBlock->button_text }}</button>
                        </form>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <p class="text-success" id="phone-thank-you-message"></p>
                        <p class="text-danger" id="phone-error-message"></p>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>

<script>
    $('#phone-collector-form').on('submit', function(event) {
        event.preventDefault();
        $.ajax({
            type: 'POST',
            url: '{{ route('biolink.phone-collector', $phoneBlock->id) }}',
            data: $(this).serialize(),
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            success: function(response) {

                let thankYouMsg = '{{ $phoneBlock->thank_you_message }}';
                let thankYouUrl = '{{ $phoneBlock->thank_you_url }}';

                let anchorElement = $('<a></a>').attr('href', thankYouUrl).text(thankYouMsg);

                anchorElement.attr('target', '_blank');
                anchorElement.addClass('text-success');

                $('#phone-form').addClass('d-none');
                $('#phone-thank-you-message').empty().append(anchorElement);

                setTimeout(function() {
                    $('#phone-form').removeClass('d-none');

                    $('#phone-name-error, #phone-error, #phone-agreement-error, #phone-thank-you-message').text('');
                    $('#phone-form, #phone-name, #phone, #phone-agreement').removeClass('is-invalid');

                    document.getElementById("phone-collector-form").reset();
                    $('#phoneModal').modal('hide');

                    $('#phoneModal').on('hide.bs.modal', function() {
                        $('.phone-modal').remove();
                    });

                }, 4000);
            },
            error: function(xhr, status, error) {

                // Handle the error response
                if (xhr.status == 422) {
                    // Display the validation errors
                    var errors = xhr.responseJSON.errors;

                    if (errors.name && errors.name[0]) {
                        $('#phone-name-error').text(errors.name ? errors.name[0] : '');
                        $('#phone-name').addClass('is-invalid');
                    } else {
                        $('#phone-name-error').text('');
                        $('#phone-name').removeClass('is-invalid');
                    }

                    if (errors.phone && errors.phone[0]) {
                        $('#phone-error').text(errors.phone ? errors.phone[0] : '');
                        $('#phone').addClass('is-invalid');
                    } else {
                        $('#phone-error').text('');
                        $('#phone').removeClass('is-invalid');
                    }

                    let agreement = '{{ $phoneBlock->show_agreement }}';

                    if (agreement == 1) {
                        if (errors.agreement && errors.agreement[0]) {
                            $('#phone-agreement-error').text(errors.agreement ? errors.agreement[
                                0] : '');
                            $('#phone-agreement').addClass('is-invalid');
                        } else {
                            $('#phone-agreement-error').text('');
                            $('#phone-agreement').removeClass('is-invalid');
                        }
                    }
                } else {

                    let msg = "@lang('biolinks::messages.ApiNotAvailable')";

                    $('#phone-form').addClass('d-none');
                    $('#phone-error-message').text(msg);

                    setTimeout(function() {
                        $('#phone-form').removeClass('d-none');
                        $('#phone-error-message').text('');
                        document.getElementById("phone-collector-form").reset();

                        $('#phone-form, #phone-name, #phone, #phone-agreement').removeClass('is-invalid');
                        $('#phoneModal').modal('hide');

                        $('#phoneModal').on('hide.bs.modal', function() {
                            $('.phone-modal').remove();
                        });

                    }, 4000);
                }
            }
        });
    });
</script>
