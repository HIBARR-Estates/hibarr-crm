
    <style>
        @page {
            size: A4 landscape;
            margin: 0;
        }
        
        body {
            margin: 0;
            padding: 0;
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #333333;
            background: #ffffff;
            -webkit-print-color-adjust: exact;
        }

        .page {
            width: 297mm;
            height: 210mm;
            position: relative;
            page-break-after: always;
            overflow: hidden;
            background: white;
        }

        .page:last-child {
            page-break-after: auto;
        }

        /* Layout Utilities */
        .row { display: flex; height: 100%; width: 100%; }
        .col-left { width: 60%; height: 100%; position: relative; }
        .col-right { width: 40%; height: 100%; padding: 15mm; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box; }
        .col-half { width: 50%; padding: 15mm; box-sizing: border-box; }
        
        .container { padding: 15mm; height: 100%; box-sizing: border-box; display: flex; flex-direction: column; }
        
        /* Typography */
        h1 {
            font-size: 32px;
            font-weight: 300;
            color: #1a1a1a;
            margin: 0 0 15px 0;
            line-height: 1.2;
        }

        h2 {
            font-size: 20px;
            font-weight: 400;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #1a1a1a;
            margin: 0 0 25px 0;
            padding-bottom: 15px;
            border-bottom: 1px solid #e0e0e0;
        }

        h3 {
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            color: #888888;
            margin: 0 0 5px 0;
        }

        p {
            font-size: 12px;
            line-height: 1.6;
            color: #555555;
            margin: 0 0 15px 0;
        }

        .text-muted { color: #999999; }
        .text-large { font-size: 14px; }
        
        /* Components */
        .img-cover {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }

        .img-contain {
            width: 100%;
            height: 100%;
            object-fit: contain;
            display: block;
        }

        .price-tag {
            font-size: 24px;
            font-weight: 400;
            color: #1a1a1a;
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #eee;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-top: 30px;
        }

        .meta-item {
            margin-bottom: 10px;
        }

        .meta-value {
            font-size: 16px;
            color: #1a1a1a;
            font-weight: 500;
        }

        /* Gallery Grid */
        .gallery-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: 10px;
            height: 150mm; /* Adjust based on header height */
        }
        
        .gallery-item {
            width: 100%;
            height: 100%;
            background: #f5f5f5;
            overflow: hidden;
        }

        /* Features List */
        .features-columns {
            column-count: 3;
            column-gap: 40px;
            height: 100%;
        }

        .feature-item {
            margin-bottom: 12px;
            font-size: 12px;
            break-inside: avoid;
            display: flex;
            align-items: center;
        }

        .feature-dot {
            width: 4px;
            height: 4px;
            background: #1a1a1a;
            border-radius: 50%;
            margin-right: 10px;
            display: inline-block;
        }

        /* Agent Section */
        .agent-card {
            display: flex;
            align-items: center;
            margin-top: auto;
            padding-top: 30px;
        }

        .agent-image {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            object-fit: cover;
            margin-right: 15px;
        }

        .agent-info {
            font-size: 12px;
        }

        .agent-name {
            font-weight: 600;
            color: #1a1a1a;
            display: block;
            margin-bottom: 2px;
        }

        /* Footer Branding */
        .footer-brand {
            position: absolute;
            bottom: 15mm;
            left: 15mm;
            font-size: 10px;
            color: #ccc;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .page-num {
            position: absolute;
            bottom: 15mm;
            right: 15mm;
            font-size: 10px;
            color: #ccc;
        }
        
        .logo-watermark {
            position: absolute;
            top: 15mm;
            right: 15mm;
            width: 100px;
            opacity: 0.8;
        }
    </style>


    {{-- PAGE 1: HERO --}}
    <div class="page">
        <div class="row">
            <div class="col-left" style="width: 65%;">
                @if(!empty($data['assets']['hero']))
                    <img src="{{ $data['assets']['hero'][0] }}" class="img-cover">
                @else
                    <div style="width:100%; height:100%; background:#f0f0f0; display:flex; align-items:center; justify-content:center; color:#ccc;">No Image</div>
                @endif
            </div>
            <div class="col-right" style="width: 35%; background: #fcfcfc;">
                @if(isset($data['company']['logo']))
                    <img src="{{ $data['company']['logo'] }}" style="width: 120px; margin-bottom: 40px;">
                @endif

                <p class="text-muted" style="text-transform: uppercase; letter-spacing: 1px; font-size: 10px;">
                    {{ $data['property_type'] ?? 'Property' }}
                </p>
                
                <h1>{{ $data['title'] }}</h1>
                
                <p style="margin-top: 10px;">{{ $data['address'] }}</p>

                <div class="price-tag">
                    {{ $data['price'] }}
                </div>

                <div class="agent-card">
                    @if(isset($data['agent']['image']))
                        <img src="{{ $data['agent']['image'] }}" class="agent-image">
                    @endif
                    <div class="agent-info">
                        <span class="agent-name">{{ $data['agent']['name'] }}</span>
                        <span class="text-muted">{{ $data['agent']['email'] }}</span><br>
                        <span class="text-muted">{{ $data['agent']['phone'] }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    {{-- PAGE 2: SUMMARY --}}
    <div class="page">
        <div class="container">
            <h2>Property Overview</h2>
            
            <div class="row" style="height: auto; flex-grow: 1;">
                <div class="col-half" style="padding-left: 0;">
                    <div class="meta-grid">
                        <div class="meta-item">
                            <h3>Living Area</h3>
                            <div class="meta-value">{{ $data['area'] ?? '-' }} m²</div>
                        </div>
                        <div class="meta-item">
                            <h3>Property Type</h3>
                            <div class="meta-value">{{ $data['property_type'] ?? '-' }}</div>
                        </div>
                        <div class="meta-item">
                            <h3>Bathrooms</h3>
                            <div class="meta-value">{{ $data['bathrooms'] ?? '-' }}</div>
                        </div>
                        <div class="meta-item">
                            <h3>Building Age</h3>
                            <div class="meta-value">{{ $data['building_age'] ?? '-' }} Years</div>
                        </div>
                        <div class="meta-item">
                            <h3>Reference</h3>
                            <div class="meta-value">#{{ $data['id'] ?? rand(1000,9999) }}</div>
                        </div>
                        <div class="meta-item">
                            <h3>Date Listed</h3>
                            <div class="meta-value">{{ \Carbon\Carbon::parse($data['created_at'])->format('M d, Y') }}</div>
                        </div>
                    </div>
                </div>
                <div class="col-half" style="padding-right: 0;">
                    @if(!empty($data['assets']['area']))
                        <img src="{{ $data['assets']['area'][0] }}" class="img-cover" style="border-radius: 4px;">
                    @elseif(!empty($data['assets']['exterior']) && count($data['assets']['exterior']) > 1)
                         <img src="{{ $data['assets']['exterior'][1] }}" class="img-cover" style="border-radius: 4px;">
                    @endif
                </div>
            </div>
            
            <div class="footer-brand">{{ $data['company']['name'] ?? 'Real Estate' }}</div>
            <div class="page-num">02</div>
        </div>
    </div>

    {{-- PAGE 3: EXTERIOR --}}
    @if(!empty($data['assets']['exterior']))
    <div class="page">
        <div class="container">
            <h2>Exterior</h2>
            <div class="gallery-grid">
                @foreach(array_slice($data['assets']['exterior'], 0, 6) as $image)
                    <div class="gallery-item">
                        <img src="{{ $image }}" class="img-cover">
                    </div>
                @endforeach
            </div>
            <div class="footer-brand">{{ $data['company']['name'] ?? 'Real Estate' }}</div>
            <div class="page-num">03</div>
        </div>
    </div>
    @endif

    {{-- PAGE 4: INTERIOR --}}
    @if(!empty($data['assets']['interior']))
    <div class="page">
        <div class="container">
            <h2>Interior</h2>
            <div class="gallery-grid">
                @foreach(array_slice($data['assets']['interior'], 0, 6) as $image)
                    <div class="gallery-item">
                        <img src="{{ $image }}" class="img-cover">
                    </div>
                @endforeach
            </div>
            <div class="footer-brand">{{ $data['company']['name'] ?? 'Real Estate' }}</div>
            <div class="page-num">04</div>
        </div>
    </div>
    @endif

    {{-- PAGE 5: FLOOR PLAN --}}
    @if(!empty($data['assets']['floor-plan']))
    <div class="page">
        <div class="container">
            <h2>Floor Plan</h2>
            <div style="flex-grow: 1; display: flex; align-items: center; justify-content: center; padding: 20px;">
                <img src="{{ $data['assets']['floor-plan'][0] }}" class="img-contain" style="max-height: 150mm;">
            </div>
            <div class="footer-brand">{{ $data['company']['name'] ?? 'Real Estate' }}</div>
            <div class="page-num">05</div>
        </div>
    </div>
    @endif

    {{-- PAGE 6: FEATURES --}}
    <div class="page">
        <div class="container">
            <h2>Features & Amenities</h2>
            <div class="features-columns">
                @php
                    $allFeatures = array_merge(
                        $data['exterior_features'] ?? [],
                        $data['interior_features'] ?? [],
                        $data['location_features'] ?? []
                    );
                @endphp
                
                @foreach($allFeatures as $feature)
                    <div class="feature-item">
                        <span class="feature-dot"></span> {{ $feature }}
                    </div>
                @endforeach
            </div>
            <div class="footer-brand">{{ $data['company']['name'] ?? 'Real Estate' }}</div>
            <div class="page-num">06</div>
        </div>
    </div>

    {{-- PAGE 7: ABOUT --}}
    <div class="page">
        <div class="container">
            <h2>About the Property</h2>
            <div style="column-count: 2; column-gap: 40px; font-size: 12px; line-height: 1.8; color: #555; text-align: justify;">
                {!! $data['description'] ?? '<p class="text-muted">No description provided.</p>' !!}
            </div>
            <div class="footer-brand">{{ $data['company']['name'] ?? 'Real Estate' }}</div>
            <div class="page-num">07</div>
        </div>
    </div>

    {{-- PAGE 8: CONTACT --}}
    <div class="page">
        <div class="row">
            <div class="col-left" style="background: #f9f9f9; display: flex; align-items: center; justify-content: center;">
                 @if(isset($data['company']['logo']))
                    <img src="{{ $data['company']['logo'] }}" style="width: 200px; opacity: 0.8;">
                @endif
            </div>
            <div class="col-right" style="background: #1a1a1a; color: white;">
                <h2 style="color: white; border-color: #444;">Contact Us</h2>
                
                <p style="color: #aaa; margin-bottom: 30px;">
                    Interested in this property? Contact us today to schedule a viewing or request more information.
                </p>

                <div style="margin-bottom: 30px;">
                    <h3 style="color: #666;">Agent</h3>
                    <div style="font-size: 18px; font-weight: 500; margin-bottom: 5px;">{{ $data['agent']['name'] }}</div>
                    <div style="color: #ccc;">{{ $data['agent']['email'] }}</div>
                    <div style="color: #ccc;">{{ $data['agent']['phone'] }}</div>
                </div>

                @if(isset($data['company']['address']))
                <div>
                    <h3 style="color: #666;">Office</h3>
                    <div style="color: #ccc; line-height: 1.6;">
                        {{ $data['company']['name'] }}<br>
                        {{ $data['company']['address'] }}
                    </div>
                </div>
                @endif
            </div>
        </div>
    </div>


