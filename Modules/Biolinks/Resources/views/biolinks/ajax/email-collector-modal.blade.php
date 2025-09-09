<div class="modal fade" id="emailModal" role="dialog">
    <div class="modal-dialog">

        <!-- Modal content-->
        <div class="modal-content">
            <div class="modal-header">
                <h4 class="modal-title">@lang('biolinks::app.emailCollector')</h4>
                <button type="button" class="close" data-dismiss="modal">&times;</button>
            </div>

            <div class="modal-body">
                <div class="row" id="email-form">
                    <div class="col-md-12">
                        <form id="email-collector-form" method="POST" class="ajax-form">
                            @csrf
                            <input type="hidden" name="is_agreement" value="{{ $emailBlock->show_agreement }}">
                            <div class="form-group">
                                <label for="email">@lang('app.email')</label>
                                <input type="email" class="form-control" id="email" name="email">
                                <div class="invalid-feedback" id="email-error"></div>
                            </div>

                            <div class="form-group">
                                <label for="name">@lang('app.name')</label>
                                <input type="text" class="form-control" id="name" name="name">
                                <div class="invalid-feedback" id="name-error"></div>
                            </div>

                            @if ($emailBlock->show_agreement)
                                <div class="form-group form-check">
                                    <input type="checkbox" class="form-check-input" id="agreement" name="agreement">
                                    <label class="form-check-label" for="agreement">
                                        @lang('biolinks::app.agreeTerms') <a href="{{ $emailBlock->agreement_url }}"
                                            target="_blank">{{ $emailBlock->agreement_text }}</a>.
                                    </label>
                                    <div class="invalid-feedback" id="agreement-error"></div>
                                </div>
                            @endif

                            <button type="submit" class="btn btn-primary">{{ $emailBlock->button_text }}</button>
                        </form>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-12">
                        <p class="text-success" id="thank-you-message"></p>
                        <p class="text-danger" id="error-message"></p>
                    </div>
                </div>
            </div>
        </div>
    </div>

</div>

<script>
    $('#email-collector-form').on('submit', function(event) {
        event.preventDefault();
        $.ajax({
            type: 'POST',
            url: '{{ route('biolink.subscribe-newsletter', $emailBlock->id) }}',
            data: $(this).serialize(),
            headers: {
                'X-CSRF-TOKEN': $('meta[name="csrf-token"]').attr('content')
            },
            success: function(response) {
                let thankMsg = '{{ $emailBlock->thank_you_message }}';
                let thankUrl = '{{ $emailBlock->thank_you_url }}';

                let ThanksElement = $('<a></a>').attr('href', thankUrl).text(thankYouMsg);

                ThanksElement.attr('target', '_blank');
                ThanksElement.addClass('text-success');

                $('#email-form').addClass('d-none');
                $('#thank-you-message').text(ThanksElement);

                setTimeout(function() {
                    $('#email-form').removeClass('d-none');

                    $('#name-error, #email-error, #agreement-error, #thank-you-message')
                        .text('');
                    $('#name, #email, #agreement').removeClass('is-invalid');

                    document.getElementById("email-collector-form").reset();
                    $('#emailModal').modal('hide');

                    $('#emailModal').on('hide.bs.modal', function() {
                        $('.email-modal').remove();
                    });

                }, 4000);
            },
            error: function(xhr, status, error) {

                // Handle the error response
                if (xhr.status === 422) {
                    // Display the validation errors
                    var errors = xhr.responseJSON.errors;

                    if (errors.name && errors.name[0]) {
                        $('#name-error').text(errors.name ? errors.name[0] : '');
                        $('#name').addClass('is-invalid');
                    } else {
                        $('#name-error').text('');
                        $('#name').removeClass('is-invalid');
                    }

                    if (errors.email && errors.email[0]) {
                        $('#email-error').text(errors.email ? errors.email[0] : '');
                        $('#email').addClass('is-invalid');
                    } else {
                        $('#email-error').text('');
                        $('#email').removeClass('is-invalid');
                    }

                    let agreement = '{{ $emailBlock->show_agreement }}';

                    if (agreement == 1) {
                        if (errors.agreement && errors.agreement[0]) {
                            $('#agreement-error').text(errors.agreement ? errors.agreement[0] : '');
                            $('#agreement').addClass('is-invalid');
                        } else {
                            $('#agreement-error').text('');
                            $('#agreement').removeClass('is-invalid');
                        }

                    }
                } else {

                    let msg = "@lang('biolinks::messages.ApiNotAvailable')";

                    $('#email-form').addClass('d-none');
                    $('#error-message').text(msg);

                    setTimeout(function() {
                        $('#email-form').removeClass('d-none');
                        $('#error-message').text('');
                        document.getElementById("email-collector-form").reset();
                        $('#name, #email, #agreement').removeClass('is-invalid');

                        $('#emailModal').modal('hide');

                        $('#emailModal').on('hide.bs.modal', function() {
                            $('.email-modal').remove();
                        });

                    }, 4000);
                }
            }
        });
    });
</script>
