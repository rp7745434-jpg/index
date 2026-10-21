import React from 'react';
import { CITY_HUBS, calculateDistanceKm, ListingRecord, SellerPublicRecord } from '../types';

interface ProductVisualProps {
  visualKey: string;
  listingType?: 'product' | 'service';
  className?: string;
}

export const ProductVisual: React.FC<ProductVisualProps> = ({
  visualKey,
  listingType = 'product',
  className = 'w-full h-52',
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-[#F1F5F9] flex items-center justify-center select-none ${className}`}
    >
      {/* Subtle architectural drafting grid */}
      <svg
        className="absolute inset-0 w-full h-full opacity-45"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
      >
        <defs>
          <pattern id={`grid-${visualKey}`} width="24" height="24" patternUnits="userSpaceOnUse">
            <path
              d="M 24 0 L 0 0 0 24"
              fill="none"
              stroke="#CBD5E1"
              strokeWidth="0.6"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#grid-${visualKey})`} />
      </svg>

      {visualKey === 'espresso_machine' && (
        <svg viewBox="0 0 320 200" className="relative z-10 w-4/5 h-4/5">
          {/* Travertine Pedestal */}
          <rect x="44" y="156" width="232" height="16" rx="2" fill="#CBD5E1" />
          <rect x="56" y="148" width="208" height="8" fill="#94A3B8" />
          {/* Main Brushed Stainless Chassis */}
          <rect x="64" y="46" width="192" height="102" rx="6" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
          <rect x="72" y="54" width="176" height="34" rx="3" fill="#334155" />
          {/* Dual Pressure Gauges */}
          <circle cx="106" cy="71" r="11" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />
          <line x1="106" y1="71" x2="112" y2="65" stroke="#D97706" strokeWidth="2" />
          <circle cx="214" cy="71" r="11" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />
          <line x1="214" y1="71" x2="220" y2="66" stroke="#16A34A" strokeWidth="2" />
          {/* Digital PID Display */}
          <rect x="140" y="62" width="40" height="18" rx="2" fill="#0F172A" />
          <text x="160" y="74" textAnchor="middle" fill="#38BDF8" fontSize="9" fontFamily="IBM Plex Mono">
            93.4°C
          </text>
          {/* Saturated Groupheads & Walnut Portafilters */}
          <rect x="102" y="88" width="32" height="22" rx="2" fill="#64748B" />
          <rect x="82" y="106" width="36" height="7" rx="3" fill="#78350F" />
          <rect x="186" y="88" width="32" height="22" rx="2" fill="#64748B" />
          <rect x="202" y="106" width="36" height="7" rx="3" fill="#78350F" />
          {/* Drip Tray Grille */}
          <rect x="76" y="134" width="168" height="10" rx="2" fill="#475569" />
        </svg>
      )}

      {visualKey === 'solar_inverter' && (
        <svg viewBox="0 0 320 200" className="relative z-10 w-4/5 h-4/5">
          {/* Hybrid Inverter Unit (Left) */}
          <rect x="58" y="34" width="96" height="132" rx="8" fill="#FFFFFF" stroke="#0F172A" strokeWidth="2" />
          <rect x="70" y="48" width="72" height="36" rx="4" fill="#0F172A" />
          <text x="106" y="65" textAnchor="middle" fill="#4ADE80" fontSize="10" fontFamily="IBM Plex Mono">
            15.0 kW
          </text>
          <text x="106" y="77" textAnchor="middle" fill="#94A3B8" fontSize="7" fontFamily="IBM Plex Mono">
            GRID-TIED LFP
          </text>
          <line x1="70" y1="100" x2="142" y2="100" stroke="#CBD5E1" strokeWidth="2" />
          <line x1="70" y1="112" x2="142" y2="112" stroke="#CBD5E1" strokeWidth="2" />
          <circle cx="106" cy="140" r="9" fill="#0F172A" />
          {/* Modular 20kWh LFP Rack (Right) */}
          <rect x="172" y="46" width="92" height="120" rx="6" fill="#1E293B" stroke="#0F172A" strokeWidth="2" />
          <rect x="182" y="58" width="72" height="22" rx="2" fill="#334155" />
          <rect x="182" y="86" width="72" height="22" rx="2" fill="#334155" />
          <rect x="182" y="114" width="72" height="22" rx="2" fill="#334155" />
          <rect x="190" y="67" width="44" height="4" rx="2" fill="#38BDF8" />
          <rect x="190" y="95" width="44" height="4" rx="2" fill="#38BDF8" />
          <rect x="190" y="123" width="44" height="4" rx="2" fill="#38BDF8" />
        </svg>
      )}

      {visualKey === 'ergonomic_chair' && (
        <svg viewBox="0 0 320 200" className="relative z-10 w-4/5 h-4/5">
          {/* Elastomer Mesh Backrest */}
          <path
            d="M132 28 C160 24, 188 28, 184 68 C180 100, 176 112, 160 112 C144 112, 140 100, 136 68 Z"
            fill="#334155"
            stroke="#0F172A"
            strokeWidth="2.5"
          />
          {/* Aluminum Spine */}
          <path d="M160 66 L160 132" stroke="#94A3B8" strokeWidth="6" strokeLinecap="round" />
          {/* Contoured Seat Pan */}
          <rect x="118" y="112" width="84" height="14" rx="6" fill="#0F172A" />
          {/* 4D Armrests */}
          <path d="M124 88 L142 88 M133 88 L133 114" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          <path d="M178 88 L196 88 M187 88 L187 114" stroke="#475569" strokeWidth="4" strokeLinecap="round" />
          {/* Pneumatic Cylinder & 5-Star Die-Cast Base */}
          <rect x="156" y="126" width="8" height="32" fill="#1E293B" />
          <path d="M160 158 L112 170 M160 158 L208 170 M160 158 L160 172" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
          <circle cx="112" cy="174" r="5" fill="#0F172A" />
          <circle cx="208" cy="174" r="5" fill="#0F172A" />
          <circle cx="160" cy="176" r="5" fill="#0F172A" />
        </svg>
      )}

      {(visualKey === 'calibration_service' || visualKey === 'cnc_spindle' ||
        (visualKey !== 'espresso_machine' && visualKey !== 'solar_inverter' && visualKey !== 'ergonomic_chair')) && (
        <svg viewBox="0 0 320 200" className="relative z-10 w-4/5 h-4/5">
          {/* Precision Calibration & On-Site Engineering Diagnostic Unit */}
          <rect x="56" y="42" width="208" height="116" rx="8" fill="#0F172A" stroke="#334155" strokeWidth="2" />
          <rect x="70" y="56" width="124" height="72" rx="4" fill="#1E293B" />
          {/* Harmonic Waveform Graph */}
          <polyline
            fill="none"
            stroke="#38BDF8"
            strokeWidth="2.5"
            points="78,96 94,74 110,110 126,68 142,102 158,82 174,94 186,78"
          />
          {/* Telemetry Readouts */}
          <rect x="206" y="56" width="44" height="20" rx="3" fill="#334155" />
          <text x="228" y="69" textAnchor="middle" fill="#F8FAFC" fontSize="8" fontFamily="IBM Plex Mono">
            9.2 BAR
          </text>
          <rect x="206" y="82" width="44" height="20" rx="3" fill="#334155" />
          <text x="228" y="95" textAnchor="middle" fill="#4ADE80" fontSize="8" fontFamily="IBM Plex Mono">
            ISO PASS
          </text>
          <rect x="206" y="108" width="44" height="20" rx="3" fill="#334155" />
          <text x="228" y="121" textAnchor="middle" fill="#FBBF24" fontSize="8" fontFamily="IBM Plex Mono">
            ±0.02mm
          </text>
          <text x="132" y="144" textAnchor="middle" fill="#94A3B8" fontSize="8" fontFamily="IBM Plex Mono">
            FIELD CALIBRATION & DIAGNOSTIC PROTOCOL
          </text>
        </svg>
      )}

      {/* Subtle corner specification caption (unboxed plain text) */}
      <div className="absolute bottom-2.5 right-3 text-[11px] font-['IBM_Plex_Mono'] text-slate-500 tabular-nums">
        {listingType === 'service' ? 'ON-SITE SERVICE SPEC' : 'STUDIO HARDWARE SPEC'}
      </div>
    </div>
  );
};

interface SpatialLocationMapProps {
  sellers: SellerPublicRecord[];
  listings: ListingRecord[];
  selectedBuyerCity: string;
  selectedSellerId: string | null;
  onSelectSeller: (sellerId: string) => void;
  onInquireListing: (listing: ListingRecord) => void;
}

export const SpatialLocationMap: React.FC<SpatialLocationMapProps> = ({
  sellers,
  listings,
  selectedBuyerCity,
  selectedSellerId,
  onSelectSeller,
  onInquireListing,
}) => {
  const buyerHub = CITY_HUBS.find((c) => c.name === selectedBuyerCity) || CITY_HUBS[0];
  const activeSeller =
    sellers.find((s) => s.id === selectedSellerId) || sellers[0] || null;

  const sellerListings = activeSeller
    ? listings.filter((l) => l.sellerId === activeSeller.id && l.status === 'active')
    : [];

  // Map lat/lng (India commercial corridor approx lat 8..32, lng 68..88) to SVG 900x520
  const projectCoords = (lat: number, lng: number) => {
    const x = ((lng - 68) / 22) * 760 + 70;
    const y = ((32 - lat) / 24) * 420 + 50;
    return {
      x: Math.max(60, Math.min(840, Math.round(x))),
      y: Math.max(50, Math.min(470, Math.round(y))),
    };
  };

  const buyerPt = projectCoords(buyerHub.lat, buyerHub.lng);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
      {/* Left 7 Columns: Interactive Coordinate & Seller Coverage Map */}
      <div className="lg:col-span-7 border border-slate-200 bg-white rounded-xl p-6 flex flex-col justify-between">
        <div className="flex flex-wrap items-baseline justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-lg font-semibold font-['Outfit'] text-slate-900">
              Regional Seller Proximity & Coverage Radar
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Buyer Reference Hub: {buyerHub.name} ({buyerHub.lat.toFixed(4)}°N, {buyerHub.lng.toFixed(4)}°E) · Click any vendor node to inspect local catalog
            </p>
          </div>
          <div className="text-xs font-['IBM_Plex_Mono'] text-slate-600 tabular-nums">
            {sellers.length} Registered Sellers · {listings.length} Active Listings
          </div>
        </div>

        <div className="relative my-4 bg-[#0F172A] rounded-lg overflow-hidden border border-slate-800">
          <svg viewBox="0 0 900 520" className="w-full h-[380px] md:h-[420px] block">
            <defs>
              <pattern id="radar-grid" width="45" height="45" patternUnits="userSpaceOnUse">
                <path
                  d="M 45 0 L 0 0 0 45"
                  fill="none"
                  stroke="#1E293B"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width="900" height="520" fill="url(#radar-grid)" />

            {/* Concentric Distance Rings from Buyer Hub */}
            <circle
              cx={buyerPt.x}
              cy={buyerPt.y}
              r="95"
              fill="none"
              stroke="#334155"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <circle
              cx={buyerPt.x}
              cy={buyerPt.y}
              r="190"
              fill="none"
              stroke="#334155"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
            <circle
              cx={buyerPt.x}
              cy={buyerPt.y}
              r="285"
              fill="none"
              stroke="#1E293B"
              strokeDasharray="4 4"
              strokeWidth="1"
            />

            {/* Connection Vector from Buyer Hub to Selected Seller */}
            {activeSeller && (() => {
              const sPt = projectCoords(activeSeller.lat, activeSeller.lng);
              const distKm = calculateDistanceKm(
                buyerHub.lat,
                buyerHub.lng,
                activeSeller.lat,
                activeSeller.lng
              );
              const midX = (buyerPt.x + sPt.x) / 2;
              const midY = (buyerPt.y + sPt.y) / 2;
              return (
                <g>
                  {/* Coverage radius of selected seller */}
                  <circle
                    cx={sPt.x}
                    cy={sPt.y}
                    r={Math.min(160, Math.max(45, activeSeller.serviceRadiusKm / 5))}
                    fill="rgba(56, 189, 248, 0.08)"
                    stroke="#0284C7"
                    strokeWidth="1.2"
                    strokeDasharray="3 3"
                  />
                  <line
                    x1={buyerPt.x}
                    y1={buyerPt.y}
                    x2={sPt.x}
                    y2={sPt.y}
                    stroke="#38BDF8"
                    strokeWidth="1.75"
                  />
                  {distKm > 0 && (
                    <g transform={`translate(${midX}, ${midY - 10})`}>
                      <rect x="-46" y="-12" width="92" height="20" rx="3" fill="#0F172A" stroke="#38BDF8" strokeWidth="1" />
                      <text
                        x="0"
                        y="2"
                        textAnchor="middle"
                        fill="#E0F2FE"
                        fontSize="10"
                        fontFamily="IBM Plex Mono"
                      >
                        {distKm} km away
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}

            {/* Buyer Current Hub Marker */}
            <g transform={`translate(${buyerPt.x}, ${buyerPt.y})`}>
              <circle r="7" fill="#F8FAFC" stroke="#0F172A" strokeWidth="2" />
              <text
                y="-14"
                textAnchor="middle"
                fill="#94A3B8"
                fontSize="10"
                fontFamily="IBM Plex Mono"
              >
                BUYER HUB: {buyerHub.name.toUpperCase()}
              </text>
            </g>

            {/* Seller Nodes */}
            {sellers.map((seller, idx) => {
              const pt = projectCoords(seller.lat, seller.lng);
              // Offset slightly if multiple sellers share the same city coordinates
              const offsetAngle = (idx % 5) * 1.25;
              const offsetX = idx > 0 ? Math.round(Math.cos(offsetAngle) * 12) : 0;
              const offsetY = idx > 0 ? Math.round(Math.sin(offsetAngle) * 12) : 0;
              const finalX = pt.x + offsetX;
              const finalY = pt.y + offsetY;
              const isSelected = activeSeller?.id === seller.id;

              return (
                <g
                  key={seller.id}
                  transform={`translate(${finalX}, ${finalY})`}
                  onClick={() => onSelectSeller(seller.id)}
                  className="cursor-pointer"
                >
                  <circle
                    r={isSelected ? 13 : 9}
                    fill={seller.isVerified ? '#0284C7' : '#D97706'}
                    stroke="#FFFFFF"
                    strokeWidth={isSelected ? 3 : 1.5}
                  />
                  <text
                    y={isSelected ? 26 : 22}
                    textAnchor="middle"
                    fill={isSelected ? '#FFFFFF' : '#CBD5E1'}
                    fontSize={isSelected ? '11' : '10'}
                    fontWeight={isSelected ? '600' : '400'}
                    fontFamily="Plus Jakarta Sans"
                  >
                    {seller.city} · {seller.businessName.split(' ')[0]}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 pt-2">
          <div>
            <span>Legend: </span>
            <span className="font-semibold text-sky-700">Blue Node = Verified Seller (Docs Approved)</span>
            <span aria-hidden="true"> · </span>
            <span className="font-semibold text-amber-700">Amber Node = Pending Verification</span>
          </div>
          <div className="font-['IBM_Plex_Mono'] tabular-nums text-slate-500">
            Haversine Geodesic Distance Active
          </div>
        </div>
      </div>

      {/* Right 5 Columns: Selected Seller Location & Local Catalog Inspector */}
      <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 flex flex-col justify-between">
        {activeSeller ? (
          <div>
            <div className="pb-4 border-b border-slate-200">
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                <span className={activeSeller.isVerified ? 'font-semibold text-emerald-700' : 'font-semibold text-amber-700'}>
                  {activeSeller.isVerified ? 'Verified Seller Badge' : 'Verification Pending'}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeSeller.city}</span>
                <span aria-hidden="true">·</span>
                <span className="font-['IBM_Plex_Mono'] tabular-nums">
                  {calculateDistanceKm(buyerHub.lat, buyerHub.lng, activeSeller.lat, activeSeller.lng)} km from {buyerHub.name}
                </span>
              </div>

              <h3 className="text-xl font-bold font-['Outfit'] text-slate-900 mt-1">
                {activeSeller.businessName}
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                Facility Zone: {activeSeller.district}, {activeSeller.city}
              </p>

              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <div className="text-slate-500">Tax / GSTIN</div>
                  <div className="font-['IBM_Plex_Mono'] font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {activeSeller.gstinMasked}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Service Radius</div>
                  <div className="font-['IBM_Plex_Mono'] font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {activeSeller.serviceRadiusKm} km
                  </div>
                </div>
                <div>
                  <div className="text-slate-500">Inquiry Response</div>
                  <div className="font-['IBM_Plex_Mono'] font-semibold text-slate-900 mt-0.5 tabular-nums">
                    {activeSeller.responseRatePct}%
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Products & Services Around {activeSeller.city} ({sellerListings.length})
              </h4>

              {sellerListings.length === 0 ? (
                <p className="text-sm text-slate-500 py-8">
                  No active listings published at this facility location yet.
                </p>
              ) : (
                <div className="divide-y divide-slate-200 mt-2">
                  {sellerListings.map((item) => (
                    <div key={item.id} className="py-3.5 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="text-xs text-slate-500">
                          <span className="capitalize">{item.listingType}</span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-['IBM_Plex_Mono'] tabular-nums">
                            {item.stockCount} available
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span className="font-['IBM_Plex_Mono'] tabular-nums">
                            {item.leadTimeDays}d lead time
                          </span>
                        </div>
                        <div className="text-sm font-semibold text-slate-900 mt-0.5">
                          {item.title}
                        </div>
                        <div className="text-sm font-['IBM_Plex_Mono'] font-semibold text-slate-900 mt-1 tabular-nums">
                          ${item.price.toLocaleString()}{' '}
                          <span className="text-xs font-normal text-slate-500">{item.unit}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onInquireListing(item)}
                        className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Inquire Directly
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-500 py-12 text-center">
            Select a seller node on the radar map to inspect location credentials and local inventory.
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            Quick Switch Seller Facility:
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {sellers.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSeller(s.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeSeller?.id === s.id
                    ? 'bg-[#0F172A] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {s.city}: {s.businessName.split(' ')[0]}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
