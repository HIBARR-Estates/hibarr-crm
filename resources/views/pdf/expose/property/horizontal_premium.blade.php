<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: DejaVu Sans, Arial, sans-serif;
            color: #2c3e50;
            margin: 0;
        }

        .page {
            page-break-after: always;
            width: 100%;
            height: 100%;
            padding: 50px;
        }

        .page:last-child {
            page-break-after: auto;
        }

        h1 { font-size: 34px; margin: 0 0 10px; }
        h2 { font-size: 26px; margin-bottom: 25px; }
        h3 { font-size: 16px; text-transform: uppercase; color: #7f8c8d; }

        p { font-size: 14px; line-height: 1.6; }

        .muted { color: #7f8c8d; }

        .divider {
            height: 2px;
            background: #667eea;
            width: 60px;
            margin: 20px 0;
        }

        .img {
            width: 100%;
            object-fit: cover;
            border-radius: 6px;
        }

        .grid-3 {
            display: table;
            width: 100%;
        }

        .grid-3 > div {
            display: table-cell;
            width: 33.333%;
            padding: 6px;
        }

        .box {
            border-left: 4px solid #667eea;
            padding-left: 15px;
            margin-bottom: 25px;
        }

        .price-box {
            background: #667eea;
            color: #fff;
            padding: 25px;
            border-radius: 8px;
            margin: 30px 0;
        }

        .agent {
            margin-top: 40px;
            padding-top: 30px;
            border-top: 1px solid #ddd;
        }

        .agent img {
            width: 70px;
            height: 70px;
            border-radius: 50%;
        }

        .list-item {
            padding: 10px 12px;
            background: #f7f8fa;
            border-radius: 6px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>

{{-- ===================== PAGE 1 – HERO ===================== --}}
<div class="page">
    <p class="muted">{{ $data['created_at'] }}</p>

    <h1>{{ $data['title'] }}</h1>
    <p class="muted">{{ $data['address'] }}</p>

    <div class="price-box">
        <p>Price</p>
        <h1>{{ $data['price'] }}</h1>
    </div>

    @if(!empty($data['assets']['hero']))
        <img class="img" src="{{ $data['assets']['hero'][0] }}">
    @endif

    <div class="agent">
        <table width="100%">
            <tr>
                <td width="80">
                    @if(isset($data['agent']['image']))
                        <img src="{{ $data['agent']['image'] }}">
                    @endif
                </td>
                <td>
                    <strong>{{ $data['agent']['name'] }}</strong><br>
                    {{ $data['agent']['phone'] }}<br>
                    {{ $data['agent']['email'] }}
                </td>
            </tr>
        </table>
    </div>
</div>

{{-- ===================== PAGE 2 – DETAILS ===================== --}}
<div class="page">
    <h2>Property Details</h2>
    <div class="divider"></div>

    <div class="box">
        <strong>Area</strong><br>
        {{ $data['area'] ?? 'N/A' }} m²
    </div>

    <div class="box">
        <strong>Property Type</strong><br>
        {{ $data['property_type'] ?? 'N/A' }}
    </div>

    <div class="box">
        <strong>Bathrooms</strong><br>
        {{ $data['bathrooms'] ?? 'N/A' }}
    </div>

    <div class="box">
        <strong>Building Age</strong><br>
        {{ $data['building_age'] ?? 'N/A' }} years
    </div>

    @if(!empty($data['assets']['area']))
        <img class="img" src="{{ $data['assets']['area'][0] }}">
    @endif
</div>

{{-- ===================== PAGE 3 – EXTERIOR ===================== --}}
<div class="page">
    <h2>Exterior Images</h2>
    <div class="divider"></div>

    <div class="grid-3">
        @foreach(array_slice($data['assets']['exterior'] ?? [], 0, 6) as $image)
            <div><img class="img" src="{{ $image }}"></div>
        @endforeach
    </div>
</div>

{{-- ===================== PAGE 4 – INTERIOR ===================== --}}
<div class="page">
    <h2>Interior Images</h2>
    <div class="divider"></div>

    <div class="grid-3">
        @foreach(array_slice($data['assets']['interior'] ?? [], 0, 6) as $image)
            <div><img class="img" src="{{ $image }}"></div>
        @endforeach
    </div>
</div>

{{-- ===================== PAGE 5 – FLOOR PLAN ===================== --}}
<div class="page">
    <h2>Floor Plan</h2>
    <div class="divider"></div>

    @foreach(array_slice($data['assets']['floor-plan'] ?? [], 0, 2) as $image)
        <img class="img" style="margin-bottom: 20px; object-fit: contain;" src="{{ $image }}">
    @endforeach
</div>

{{-- ===================== PAGE 6 – FACILITIES ===================== --}}
<div class="page">
    <h2>Facilities</h2>
    <div class="divider"></div>

    @foreach(array_merge(
        $data['exterior_features'] ?? [],
        $data['interior_features'] ?? [],
        $data['location_features'] ?? []
    ) as $feature)
        <div class="list-item">✓ {{ $feature }}</div>
    @endforeach
</div>

{{-- ===================== PAGE 7 – ABOUT ===================== --}}
<div class="page">
    <h2>About the Property</h2>
    <div class="divider"></div>

    {!! $data['description'] ?? '<p class="muted">No description provided.</p>' !!}
</div>

{{-- ===================== PAGE 8 – CONTACT ===================== --}}
<div class="page">
    <h2>If you have any questions</h2>
    <div class="divider"></div>

    <p>
        <strong>{{ $data['agent']['name'] }}</strong><br>
        {{ $data['agent']['phone'] }}<br>
        {{ $data['agent']['email'] }}
    </p>

    @if(isset($data['company']['logo']))
        <img src="{{ $data['company']['logo'] }}" style="max-width: 150px; margin-top: 40px;">
    @endif
</div>

</body>
</html>
