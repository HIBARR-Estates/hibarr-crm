<!DOCTYPE html>

<html lang="en">

<head>
    <!-- Required meta tags -->
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">
    <!-- Font Awesome Icons -->
    <link rel="stylesheet" href="{{ asset('vendor/css/all.min.css') }}">
    <!-- Favicon icon -->
    <link rel="icon" href="{{ $biolinkSettings->favicon_url }}" type="image/x-icon" />
    <!-- Bootstrap -->
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/main.css') }}">

    <style>
        :root {
            --fc-border-color: #E8EEF3;
            --fc-button-text-color: #99A5B5;
            --fc-button-border-color: #99A5B5;
            --fc-button-bg-color: #ffffff;
            --fc-button-active-bg-color: #171f29;
            --fc-today-bg-color: #f2f4f7;
        }

        .vertical-center {
            margin: 0;
            position: absolute;
            top: 40%;
            -ms-transform: translateY(-50%);
            transform: translateY(-50%);
        }
    </style>

</head>

<body>
    <section class="main-container bg-additional-grey mb-5 mb-sm-0 ml-0 vh-100">

        <div class="box">
            <div class="col-md-12 vertical-center">
                <div class="white-box p-t-20 border-dark">

                    <!-- Password input start -->
                    <form id="login-form" action="{{ route('biolink.check-password', $biolink->page_link) }}" class="ajax-form"
                        method="POST">
                        {{ csrf_field() }}

                        <div class="row justify-content-center mt-5 mt-lg-8 ">
                            <div class="col-md-6 py-6">

                                <div class="mb-4 text-center">
                                    <h1 class="h3">@lang('biolinks::app.passwordProtected')</h1>
                                    <span class="text-muted"> @lang('biolinks::app.passwordNote') </span>
                                </div>

                                <div class="row justify-content-center">
                                    <div class="col-md-6">
                                        <div class="form-group text-left">
                                            <label for="password">@lang('app.password')</label>
                                            <x-forms.input-group>
                                                <input type="password" name="password" id="password"
                                                    placeholder="@lang('placeholders.password')" tabindex="3"
                                                    class="form-control height-50 f-15 light_text @error('password') is-invalid @enderror">

                                            </x-forms.input-group>
                                            @if ($errors->has('password'))
                                                <div class="invalid-feedback d-block">{{ $errors->first('password') }}
                                                </div>
                                            @endif
                                            @if ($errors->has('wrong_password'))
                                                <div class="invalid-feedback d-block">
                                                    {{ $errors->first('wrong_password') }}
                                                </div>
                                            @endif
                                        </div>

                                        <button type="submit" name="submit"
                                            class="btn btn-block btn-dark mt-4">@lang('biolinks::app.submit')
                                        </button>
                                    </div>

                                </div>
                            </div>
                        </div>
                    </form>
                    <!-- Password input end -->

                </div>

            </div>
        </div>

    </section>
</body>


<!-- jQuery -->
<script src="{{ asset('vendor/jquery/jquery.min.js') }}"></script>

</html>
