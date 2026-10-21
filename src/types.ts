export interface CityHub {
  name: string;
  district: string;
  stateName: string;
  lat: number;
  lng: number;
  mapX: number; // Normalized 0-1000 SVG coordinate
  mapY: number; // Normalized 0-600 SVG coordinate
}

export const CITY_HUBS: CityHub[] = [
  {
    name: 'Bengaluru',
    district: 'Peenya Industrial & Whitefield Tech Corridor',
    stateName: 'Karnataka',
    lat: 12.9716,
    lng: 77.5946,
    mapX: 460,
    mapY: 455,
  },
  {
    name: 'Mumbai',
    district: 'Andheri MIDC & Navi Mumbai Logistics Hub',
    stateName: 'Maharashtra',
    lat: 19.076,
    lng: 72.8777,
    mapX: 295,
    mapY: 315,
  },
  {
    name: 'Delhi NCR',
    district: 'Okhla Phase III & Gurugram Udyog Vihar',
    stateName: 'Delhi / Haryana',
    lat: 28.6139,
    lng: 77.209,
    mapX: 445,
    mapY: 135,
  },
  {
    name: 'Hyderabad',
    district: 'Balanagar & HITEC Precision Zone',
    stateName: 'Telangana',
    lat: 17.385,
    lng: 78.4867,
    mapX: 495,
    mapY: 350,
  },
  {
    name: 'Pune',
    district: 'Chakan Auto Cluster & Pimpri-Chinchwad',
    stateName: 'Maharashtra',
    lat: 18.5204,
    lng: 73.8567,
    mapX: 335,
    mapY: 345,
  },
  {
    name: 'Chennai',
    district: 'Guindy Industrial Estate & Sriperumbudur',
    stateName: 'Tamil Nadu',
    lat: 13.0827,
    lng: 80.2707,
    mapX: 545,
    mapY: 460,
  },
];

export interface SellerPublicRecord {
  id: string;
  ownerId: string;
  businessName: string;
  category: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  gstinMasked: string;
  isVerified: boolean;
  verificationStatus: 'verified' | 'pending' | 'rejected';
  serviceRadiusKm: number;
  responseRatePct: number;
  status: 'active' | 'suspended';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface SellerPrivateRecord {
  id: string;
  ownerId: string;
  taxIdFull: string;
  tradeLicenseNumber: string;
  isoCertRef: string;
  registeredStreet: string;
  contactPhone: string;
  contactEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface ListingRecord {
  id: string;
  ownerId: string;
  sellerId: string;
  sellerName: string;
  sellerVerified: boolean;
  productGroupKey: string;
  title: string;
  category: string;
  listingType: 'product' | 'service';
  price: number;
  unit: string;
  stockCount: number;
  reorderPoint: number;
  minOrderQty: number;
  leadTimeDays: number;
  description: string;
  city: string;
  district: string;
  lat: number;
  lng: number;
  visualKey: string;
  status: 'active' | 'draft' | 'archived';
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface InquiryRecord {
  id: string;
  listingId: string;
  listingTitle: string;
  sellerId: string;
  sellerOwnerId: string;
  sellerName: string;
  buyerId: string;
  buyerName: string;
  buyerLocation: string;
  requestedQty: number;
  targetPrice: number;
  preferredContactMethod: 'portal' | 'phone_callback' | 'site_visit';
  message: string;
  sellerReply: string;
  status: 'open' | 'responded' | 'closed';
  createdAt?: unknown;
  updatedAt?: unknown;
}

// Haversine distance calculator in kilometers
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Curated baseline multi-vendor sellers and listings for immediate discovery and price/location comparison
export const BASELINE_SELLERS: SellerPublicRecord[] = [
  {
    id: 'vendor_kinetix_blr',
    ownerId: 'system_seed_owner',
    businessName: 'Kinetix Roast & Precision Systems',
    category: 'Commercial Espresso & Hospitality',
    city: 'Bengaluru',
    district: 'Peenya Industrial Stage II',
    lat: 12.9716,
    lng: 77.5946,
    gstinMasked: '29AAACK8412F1Z9',
    isVerified: true,
    verificationStatus: 'verified',
    serviceRadiusKm: 450,
    responseRatePct: 98,
    status: 'active',
  },
  {
    id: 'vendor_aurelia_mum',
    ownerId: 'system_seed_owner',
    businessName: 'Aurelia Brewtech & Foodservice Ltd',
    category: 'Commercial Espresso & Hospitality',
    city: 'Mumbai',
    district: 'Andheri East MIDC',
    lat: 19.076,
    lng: 72.8777,
    gstinMasked: '27AABCA9920L1Z2',
    isVerified: true,
    verificationStatus: 'verified',
    serviceRadiusKm: 600,
    responseRatePct: 95,
    status: 'active',
  },
  {
    id: 'vendor_northstar_del',
    ownerId: 'system_seed_owner',
    businessName: 'NorthStar Roastery Supply Co',
    category: 'Commercial Espresso & Hospitality',
    city: 'Delhi NCR',
    district: 'Okhla Industrial Area Phase III',
    lat: 28.6139,
    lng: 77.209,
    gstinMasked: '07AAACN4419B1Z4',
    isVerified: false,
    verificationStatus: 'pending',
    serviceRadiusKm: 350,
    responseRatePct: 86,
    status: 'active',
  },
  {
    id: 'vendor_solaris_pune',
    ownerId: 'system_seed_owner',
    businessName: 'Solaris Grid & Energy Storage Engineering',
    category: 'Solar & Energy Systems',
    city: 'Pune',
    district: 'Chakan Industrial Phase II',
    lat: 18.5204,
    lng: 73.8567,
    gstinMasked: '27AADCS3310P1Z8',
    isVerified: true,
    verificationStatus: 'verified',
    serviceRadiusKm: 800,
    responseRatePct: 99,
    status: 'active',
  },
  {
    id: 'vendor_deccan_hyd',
    ownerId: 'system_seed_owner',
    businessName: 'Deccan Volt & Microgrid Solutions',
    category: 'Solar & Energy Systems',
    city: 'Hyderabad',
    district: 'Balanagar Technical Estate',
    lat: 17.385,
    lng: 78.4867,
    gstinMasked: '36AABCD7712M1Z1',
    isVerified: true,
    verificationStatus: 'verified',
    serviceRadiusKm: 550,
    responseRatePct: 94,
    status: 'active',
  },
  {
    id: 'vendor_forma_che',
    ownerId: 'system_seed_owner',
    businessName: 'Forma Architectural Seating & Studio',
    category: 'Architectural Workspace',
    city: 'Chennai',
    district: 'Guindy Industrial Estate',
    lat: 13.0827,
    lng: 80.2707,
    gstinMasked: '33AAACF5518K1Z6',
    isVerified: true,
    verificationStatus: 'verified',
    serviceRadiusKm: 700,
    responseRatePct: 97,
    status: 'active',
  },
];

export const BASELINE_LISTINGS: ListingRecord[] = [
  // Product Group 1: Dual-Boiler Espresso Machine across 3 Sellers (Bengaluru, Mumbai, Delhi NCR)
  {
    id: 'lst_espresso_blr',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_kinetix_blr',
    sellerName: 'Kinetix Roast & Precision Systems',
    sellerVerified: true,
    productGroupKey: 'linea_dual_boiler_pro_2g',
    title: 'Linea Chrono Dual-Boiler 2-Group Commercial Espresso System',
    category: 'Commercial Espresso & Hospitality',
    listingType: 'product',
    price: 6450,
    unit: 'per unit',
    stockCount: 14,
    reorderPoint: 4,
    minOrderQty: 1,
    leadTimeDays: 3,
    description:
      'Saturated dual-boiler PID temperature-stabilized 2-group commercial espresso machine in brushed 304 stainless steel with walnut portafilters and volumetric gravimetric scales.',
    city: 'Bengaluru',
    district: 'Peenya Industrial Stage II',
    lat: 12.9716,
    lng: 77.5946,
    visualKey: 'espresso_machine',
    status: 'active',
  },
  {
    id: 'lst_espresso_mum',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_aurelia_mum',
    sellerName: 'Aurelia Brewtech & Foodservice Ltd',
    sellerVerified: true,
    productGroupKey: 'linea_dual_boiler_pro_2g',
    title: 'Linea Chrono Dual-Boiler 2-Group Commercial Espresso System',
    category: 'Commercial Espresso & Hospitality',
    listingType: 'product',
    price: 6290,
    unit: 'per unit',
    stockCount: 9,
    reorderPoint: 3,
    minOrderQty: 1,
    leadTimeDays: 5,
    description:
      'Direct-import commercial 2-group dual-boiler espresso workstation with pre-infusion pressure profiling, cool-touch steam wands, and 24-month western region warranty.',
    city: 'Mumbai',
    district: 'Andheri East MIDC',
    lat: 19.076,
    lng: 72.8777,
    visualKey: 'espresso_machine',
    status: 'active',
  },
  {
    id: 'lst_espresso_del',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_northstar_del',
    sellerName: 'NorthStar Roastery Supply Co',
    sellerVerified: false,
    productGroupKey: 'linea_dual_boiler_pro_2g',
    title: 'Linea Chrono Dual-Boiler 2-Group Commercial Espresso System',
    category: 'Commercial Espresso & Hospitality',
    listingType: 'product',
    price: 6120,
    unit: 'per unit',
    stockCount: 3,
    reorderPoint: 5,
    minOrderQty: 2,
    leadTimeDays: 7,
    description:
      'Wholesale multi-unit package for Linea Chrono 2-group commercial espresso machines. Ex-warehouse Okhla Phase III pricing for specialty cafes and hotel chains.',
    city: 'Delhi NCR',
    district: 'Okhla Industrial Area Phase III',
    lat: 28.6139,
    lng: 77.209,
    visualKey: 'espresso_machine',
    status: 'active',
  },

  // Product Group 2: Hybrid 15kW Solar Inverter + LFP Storage across 2 Sellers (Pune, Hyderabad)
  {
    id: 'lst_solar_pune',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_solaris_pune',
    sellerName: 'Solaris Grid & Energy Storage Engineering',
    sellerVerified: true,
    productGroupKey: 'solaris_15kw_hybrid_lfp_pack',
    title: 'VoltCore 15kW Three-Phase Hybrid Solar Inverter + 20kWh LFP Rack',
    category: 'Solar & Energy Systems',
    listingType: 'product',
    price: 4820,
    unit: 'per system',
    stockCount: 22,
    reorderPoint: 6,
    minOrderQty: 1,
    leadTimeDays: 4,
    description:
      'Industrial IP65 three-phase 15kW hybrid inverter paired with modular 20kWh LiFePO4 battery cabinet. Sub-8ms UPS switchover for commercial facilities and clinics.',
    city: 'Pune',
    district: 'Chakan Industrial Phase II',
    lat: 18.5204,
    lng: 73.8567,
    visualKey: 'solar_inverter',
    status: 'active',
  },
  {
    id: 'lst_solar_hyd',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_deccan_hyd',
    sellerName: 'Deccan Volt & Microgrid Solutions',
    sellerVerified: true,
    productGroupKey: 'solaris_15kw_hybrid_lfp_pack',
    title: 'VoltCore 15kW Three-Phase Hybrid Solar Inverter + 20kWh LFP Rack',
    category: 'Solar & Energy Systems',
    listingType: 'product',
    price: 4950,
    unit: 'per system',
    stockCount: 16,
    reorderPoint: 5,
    minOrderQty: 1,
    leadTimeDays: 2,
    description:
      'Ready-to-dispatch 15kW hybrid solar inverter and 20kWh LFP rack in Hyderabad with free pre-commissioning harmonic load diagnostics included.',
    city: 'Hyderabad',
    district: 'Balanagar Technical Estate',
    lat: 17.385,
    lng: 78.4867,
    visualKey: 'solar_inverter',
    status: 'active',
  },

  // Service Group 3: On-Site Commercial Microgrid & Solar Commissioning Service (Pune, Hyderabad)
  {
    id: 'lst_service_solar_pune',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_solaris_pune',
    sellerName: 'Solaris Grid & Energy Storage Engineering',
    sellerVerified: true,
    productGroupKey: 'service_microgrid_audit_install',
    title: 'Commercial Rooftop Solar & Harmonic Grid Commissioning Service',
    category: 'Solar & Energy Systems',
    listingType: 'service',
    price: 680,
    unit: 'per site audit & setup',
    stockCount: 12,
    reorderPoint: 3,
    minOrderQty: 1,
    leadTimeDays: 2,
    description:
      'Certified electrical engineers perform on-site structural load testing, thermal imaging of switchgear, net-metering filing, and full hybrid inverter commissioning.',
    city: 'Pune',
    district: 'Chakan Industrial Phase II',
    lat: 18.5204,
    lng: 73.8567,
    visualKey: 'calibration_service',
    status: 'active',
  },
  {
    id: 'lst_service_solar_hyd',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_deccan_hyd',
    sellerName: 'Deccan Volt & Microgrid Solutions',
    sellerVerified: true,
    productGroupKey: 'service_microgrid_audit_install',
    title: 'Commercial Rooftop Solar & Harmonic Grid Commissioning Service',
    category: 'Solar & Energy Systems',
    listingType: 'service',
    price: 640,
    unit: 'per site audit & setup',
    stockCount: 8,
    reorderPoint: 2,
    minOrderQty: 1,
    leadTimeDays: 1,
    description:
      'Turnkey on-site microgrid installation, earthing pit certification, and CEIG safety inspection documentation across Telangana and Andhra corridors.',
    city: 'Hyderabad',
    district: 'Balanagar Technical Estate',
    lat: 17.385,
    lng: 78.4867,
    visualKey: 'calibration_service',
    status: 'active',
  },

  // Product Group 4: Architectural Task Seating (Chennai, Bengaluru)
  {
    id: 'lst_chair_che',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_forma_che',
    sellerName: 'Forma Architectural Seating & Studio',
    sellerVerified: true,
    productGroupKey: 'aether_alu_task_chair',
    title: 'Aether Die-Cast Aluminum & Elastomer Mesh Task Chair',
    category: 'Architectural Workspace',
    listingType: 'product',
    price: 540,
    unit: 'per chair',
    stockCount: 65,
    reorderPoint: 15,
    minOrderQty: 4,
    leadTimeDays: 3,
    description:
      'BIFMA-certified ergonomic studio task chair with polished die-cast aluminum chassis, 4D synchronous tilt mechanism, and breathable graphite pellicle suspension.',
    city: 'Chennai',
    district: 'Guindy Industrial Estate',
    lat: 13.0827,
    lng: 80.2707,
    visualKey: 'ergonomic_chair',
    status: 'active',
  },
  {
    id: 'lst_chair_blr',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_kinetix_blr',
    sellerName: 'Kinetix Roast & Precision Systems',
    sellerVerified: true,
    productGroupKey: 'aether_alu_task_chair',
    title: 'Aether Die-Cast Aluminum & Elastomer Mesh Task Chair',
    category: 'Architectural Workspace',
    listingType: 'product',
    price: 565,
    unit: 'per chair',
    stockCount: 28,
    reorderPoint: 10,
    minOrderQty: 2,
    leadTimeDays: 1,
    description:
      'Same-week Bengaluru dispatch for Aether die-cast aluminum studio task seating, including on-site assembly and 5-year structural warranty.',
    city: 'Bengaluru',
    district: 'Peenya Industrial Stage II',
    lat: 12.9716,
    lng: 77.5946,
    visualKey: 'ergonomic_chair',
    status: 'active',
  },

  // Service Group 5: Preventive Espresso & Water Filtration Calibration Service
  {
    id: 'lst_service_espresso_mum',
    ownerId: 'system_seed_owner',
    sellerId: 'vendor_aurelia_mum',
    sellerName: 'Aurelia Brewtech & Foodservice Ltd',
    sellerVerified: true,
    productGroupKey: 'service_espresso_overhaul_annual',
    title: 'On-Site Espresso Boiler Descaling, Pump Calibration & RO Audit',
    category: 'Commercial Espresso & Hospitality',
    listingType: 'service',
    price: 290,
    unit: 'per visit',
    stockCount: 18,
    reorderPoint: 4,
    minOrderQty: 1,
    leadTimeDays: 1,
    description:
      'Comprehensive on-site technician service covering grouphead gasket replacement, rotary vane pump pressure calibration, TDS remineralization tuning, and safety valve testing.',
    city: 'Mumbai',
    district: 'Andheri East MIDC',
    lat: 19.076,
    lng: 72.8777,
    visualKey: 'cnc_spindle',
    status: 'active',
  },
];
