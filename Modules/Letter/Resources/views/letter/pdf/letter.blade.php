<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="X-UA-Compatible" content="ie=edge">
    <title>@lang($pageTitle)</title>
    <link type="text/css" rel="stylesheet" media="all" href="{{ asset('css/main.css') }}">
    <style>
        html, body {
            padding: 0;
            margin: 0;
        }
    </style>

</head>
<body class="text-wrap ql-editor"  @style([
    'padding-top:' . $letter->top . 'px',
    'padding-bottom:' . $letter->bottom . 'px',
    'padding-left:' . $letter->left . 'px',
    'padding-right:' . $letter->right . 'px',
])>
    {!! $description !!}
</body>
</html>
