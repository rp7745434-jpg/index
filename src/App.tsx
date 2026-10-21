/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  or,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  clampNumber,
  clampString,
  db,
  handleFirestoreError,
  logOutUser,
  OperationType,
  sanitizeId,
  signInWithGoogle,
} from './firebase';
import {
  BASELINE_LISTINGS,
  BASELINE_SELLERS,
  CITY_HUBS,
  calculateDistanceKm,
  InquiryRecord,
  ListingRecord,
  SellerPublicRecord,
} from './types';
import { ProductVisual, SpatialLocationMap } from './components/ProductVisual';
import { SellerHub } from './components/SellerHub';

type ActiveSection = 'marketplace' | 'compare' | 'locations' | 'inquiries' | 'seller-hub';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [activeSection, setActiveSection] = useState<ActiveSection>('marketplace');

  // Firestore Live State
  const [dbSellers, setDbSellers] = useState<SellerPublicRecord[]>([]);
  const [dbListings, setDbListings] = useState<ListingRecord[]>([]);
  const [dbInquiries, setDbInquiries] = useState<InquiryRecord[]>([]);
  const [isSeeding, setIsSeeding] = useState(false);

  // Buyer Discovery & Filter Controls
  const [buyerCity, setBuyerCity] = useState<string>('Bengaluru');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'product' | 'service'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [verifiedOnly, setVerifiedOnly] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<'price-asc' | 'distance-asc' | 'stock-desc'>('distance-asc');

  // Comparison & Map Selection State
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>('linea_dual_boiler_pro_2g');
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>('vendor_kinetix_blr');

  // Direct Seller Inquiry Modal State
  const [inquiryTarget, setInquiryTarget] = useState<ListingRecord | null>(null);
  const [inquiryBuyerName, setInquiryBuyerName] = useState<string>('');
  const [inquiryQty, setInquiryQty] = useState<number>(1);
  const [inquiryTargetPrice, setInquiryTargetPrice] = useState<number>(0);
  const [inquiryContactMethod, setInquiryContactMethod] = useState<
    'portal' | 'phone_callback' | 'site_visit'
  >('portal');
  const [inquiryMessage, setInquiryMessage] = useState<string>('');
  const [isSubmittingInquiry, setIsSubmittingInquiry] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Track Firebase Authentication State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user?.displayName) {
        setInquiryBuyerName(user.displayName);
      } else if (user?.email) {
        setInquiryBuyerName(user.email.split('@')[0]);
      }
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // 2. Attach Firestore Real-Time Listeners (Strictly adhering to Secure List Query Rules)
  useEffect(() => {
    if (!authReady) return;

    const sellersPath = 'sellers';
    const sellersQ = query(collection(db, sellersPath), where('status', '==', 'active'));
    const unsubSellers = onSnapshot(
      sellersQ,
      (snap) => {
        const list: SellerPublicRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as SellerPublicRecord), id: docSnap.id });
        });
        setDbSellers(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, sellersPath);
      }
    );

    const listingsPath = 'listings';
    const listingsQ = query(collection(db, listingsPath), where('status', '==', 'active'));
    const unsubListings = onSnapshot(
      listingsQ,
      (snap) => {
        const list: ListingRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as ListingRecord), id: docSnap.id });
        });
        setDbListings(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, listingsPath);
      }
    );

    return () => {
      unsubSellers();
      unsubListings();
    };
  }, [authReady]);

  // 3. Attach Authenticated Inquiry Listener (Strictly filtered by buyerId or sellerOwnerId)
  useEffect(() => {
    if (!authReady || !currentUser) {
      setDbInquiries([]);
      return;
    }

    const inquiriesPath = 'inquiries';
    const inquiriesQ = query(
      collection(db, inquiriesPath),
      or(
        where('buyerId', '==', currentUser.uid),
        where('sellerOwnerId', '==', currentUser.uid)
      )
    );

    const unsubInquiries = onSnapshot(
      inquiriesQ,
      (snap) => {
        const list: InquiryRecord[] = [];
        snap.forEach((docSnap) => {
          list.push({ ...(docSnap.data() as InquiryRecord), id: docSnap.id });
        });
        setDbInquiries(list);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, inquiriesPath);
      }
    );

    return () => unsubInquiries();
  }, [authReady, currentUser]);

  // Merge Firestore records with Baseline Multi-Vendor Catalog so the marketplace is always rich
  const allSellers = useMemo(() => {
    const map = new Map<string, SellerPublicRecord>();
    BASELINE_SELLERS.forEach((s) => map.set(s.id, s));
    dbSellers.forEach((s) => map.set(s.id, s));
    return Array.from(map.values());
  }, [dbSellers]);

  const allListings = useMemo(() => {
    const map = new Map<string, ListingRecord>();
    BASELINE_LISTINGS.forEach((l) => map.set(l.id, l));
    dbListings.forEach((l) => map.set(l.id, l));
    return Array.from(map.values());
  }, [dbListings]);

  const buyerHub = useMemo(
    () => CITY_HUBS.find((h) => h.name === buyerCity) || CITY_HUBS[0],
    [buyerCity]
  );

  // Filtered & Sorted Marketplace Listings
  const filteredListings = useMemo(() => {
    return allListings
      .filter((item) => {
        if (item.status !== 'active') return false;
        if (typeFilter !== 'all' && item.listingType !== typeFilter) return false;
        if (categoryFilter !== 'all' && item.category !== categoryFilter) return false;
        if (verifiedOnly && !item.sellerVerified) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = item.title.toLowerCase().includes(q);
          const matchSeller = item.sellerName.toLowerCase().includes(q);
          const matchCity = item.city.toLowerCase().includes(q);
          const matchCat = item.category.toLowerCase().includes(q);
          if (!matchTitle && !matchSeller && !matchCity && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price-asc') return a.price - b.price;
        if (sortBy === 'stock-desc') return b.stockCount - a.stockCount;
        const distA = calculateDistanceKm(buyerHub.lat, buyerHub.lng, a.lat, a.lng);
        const distB = calculateDistanceKm(buyerHub.lat, buyerHub.lng, b.lat, b.lng);
        return distA - distB;
      });
  }, [allListings, typeFilter, categoryFilter, verifiedOnly, searchQuery, sortBy, buyerHub]);

  // Group listings by productGroupKey for Multi-Vendor Price & Location Comparison
  const comparisonGroups = useMemo(() => {
    const groups = new Map<
      string,
      {
        groupKey: string;
        title: string;
        category: string;
        listingType: 'product' | 'service';
        visualKey: string;
        offers: ListingRecord[];
      }
    >();

    allListings.forEach((item) => {
      if (item.status !== 'active') return;
      const existing = groups.get(item.productGroupKey);
      if (existing) {
        existing.offers.push(item);
      } else {
        groups.set(item.productGroupKey, {
          groupKey: item.productGroupKey,
          title: item.title,
          category: item.category,
          listingType: item.listingType,
          visualKey: item.visualKey,
          offers: [item],
        });
      }
    });

    return Array.from(groups.values());
  }, [allListings]);

  const activeComparisonGroup = useMemo(() => {
    return (
      comparisonGroups.find((g) => g.groupKey === selectedGroupKey) ||
      comparisonGroups[0] ||
      null
    );
  }, [comparisonGroups, selectedGroupKey]);

  // Seed / Sync Baseline Multi-Vendor Sellers & Listings into Firestore under current user's ownership
  const handleSeedMarketplaceToFirestore = async () => {
    if (!currentUser) {
      await signInWithGoogle();
      return;
    }
    setIsSeeding(true);
    try {
      // 1. Seed sellers + seller_private atomically via writeBatch
      const sellerBatch = writeBatch(db);
      for (const s of BASELINE_SELLERS) {
        const sRef = doc(db, 'sellers', s.id);
        const pRef = doc(db, 'seller_private', s.id);
        const snap = await getDoc(sRef);
        if (!snap.exists()) {
          sellerBatch.set(sRef, {
            ownerId: currentUser.uid,
            businessName: s.businessName,
            category: s.category,
            city: s.city,
            district: s.district,
            lat: s.lat,
            lng: s.lng,
            gstinMasked: s.gstinMasked,
            isVerified: s.isVerified,
            verificationStatus: s.verificationStatus,
            serviceRadiusKm: s.serviceRadiusKm,
            responseRatePct: s.responseRatePct,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          sellerBatch.set(pRef, {
            ownerId: currentUser.uid,
            taxIdFull: `${s.gstinMasked.slice(0, 6)}9912F1Z8`,
            tradeLicenseNumber: `TL-${s.city.slice(0, 3).toUpperCase()}-2026-8810`,
            isoCertRef: 'ISO-9001-2026-VERO',
            registeredStreet: `${s.district}, ${s.city}`,
            contactPhone: '+91-80-40901122',
            contactEmail: currentUser.email || 'compliance@veromarket.in',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }
      await sellerBatch.commit();

      // 2. Seed listings referencing the committed sellers
      for (const l of BASELINE_LISTINGS) {
        const lRef = doc(db, 'listings', l.id);
        const lSnap = await getDoc(lRef);
        if (!lSnap.exists()) {
          await setDoc(lRef, {
            ownerId: currentUser.uid,
            sellerId: l.sellerId,
            sellerName: l.sellerName,
            sellerVerified: l.sellerVerified,
            productGroupKey: l.productGroupKey,
            title: l.title,
            category: l.category,
            listingType: l.listingType,
            price: l.price,
            unit: l.unit,
            stockCount: l.stockCount,
            reorderPoint: l.reorderPoint,
            minOrderQty: l.minOrderQty,
            leadTimeDays: l.leadTimeDays,
            description: l.description,
            city: l.city,
            district: l.district,
            lat: l.lat,
            lng: l.lng,
            visualKey: l.visualKey,
            status: 'active',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      }

      setToastMessage('Multi-vendor catalog synced to your Firestore database.');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'sellers_and_listings_seed');
    } finally {
      setIsSeeding(false);
    }
  };

  // Open Direct Seller Inquiry Modal
  const openInquiryModal = (listing: ListingRecord) => {
    setInquiryTarget(listing);
    setInquiryQty(listing.minOrderQty || 1);
    setInquiryTargetPrice(listing.price);
    setInquiryMessage(
      `Requesting direct seller availability, regional dispatch timeline to ${buyerCity}, and official tax invoice quote for ${listing.title}.`
    );
  };

  // Submit Direct Inquiry to Seller in Firestore
  const handleSendDirectInquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryTarget) return;

    if (!currentUser) {
      await signInWithGoogle();
      return;
    }

    setIsSubmittingInquiry(true);
    const inquiryId = sanitizeId(`inq_${currentUser.uid.slice(0, 6)}_${Date.now()}`);

    try {
      // Ensure the referenced seller & listing exist in Firestore before creating the inquiry
      // (Satisfies Pillar 11 Global Consistency Invariant: exists(/sellers/...) & exists(/listings/...))
      const sellerRef = doc(db, 'sellers', inquiryTarget.sellerId);
      const sellerSnap = await getDoc(sellerRef);
      let sellerOwnerId = currentUser.uid;

      if (!sellerSnap.exists()) {
        const baseSeller =
          allSellers.find((s) => s.id === inquiryTarget.sellerId) || BASELINE_SELLERS[0];
        const batch = writeBatch(db);
        batch.set(sellerRef, {
          ownerId: currentUser.uid,
          businessName: clampString(baseSeller.businessName, 2, 100, inquiryTarget.sellerName),
          category: clampString(baseSeller.category, 2, 60, inquiryTarget.category),
          city: clampString(baseSeller.city, 2, 60, inquiryTarget.city),
          district: clampString(baseSeller.district, 2, 80, inquiryTarget.district),
          lat: clampNumber(baseSeller.lat, -90, 90, inquiryTarget.lat),
          lng: clampNumber(baseSeller.lng, -180, 180, inquiryTarget.lng),
          gstinMasked: clampString(baseSeller.gstinMasked, 5, 30, '29AAACK8412F1Z9'),
          isVerified: Boolean(baseSeller.isVerified),
          verificationStatus: baseSeller.verificationStatus,
          serviceRadiusKm: clampNumber(baseSeller.serviceRadiusKm, 1, 5000, 500),
          responseRatePct: clampNumber(baseSeller.responseRatePct, 0, 100, 96),
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        batch.set(doc(db, 'seller_private', inquiryTarget.sellerId), {
          ownerId: currentUser.uid,
          taxIdFull: '29AAACK8412F1Z9',
          tradeLicenseNumber: 'TL-BLR-2026-8841',
          isoCertRef: 'ISO-9001-2026-VERO',
          registeredStreet: `${inquiryTarget.district}, ${inquiryTarget.city}`,
          contactPhone: '+91-80-41209876',
          contactEmail: currentUser.email || 'seller@veromarket.in',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        await batch.commit();
      } else {
        sellerOwnerId = (sellerSnap.data() as SellerPublicRecord).ownerId;
      }

      const listingRef = doc(db, 'listings', inquiryTarget.id);
      const listingSnap = await getDoc(listingRef);
      if (!listingSnap.exists()) {
        await setDoc(listingRef, {
          ownerId: currentUser.uid,
          sellerId: inquiryTarget.sellerId,
          sellerName: clampString(inquiryTarget.sellerName, 2, 100, 'Verified Seller'),
          sellerVerified: Boolean(inquiryTarget.sellerVerified),
          productGroupKey: clampString(inquiryTarget.productGroupKey, 2, 80, 'catalog_group'),
          title: clampString(inquiryTarget.title, 3, 140, 'Commercial Unit'),
          category: clampString(inquiryTarget.category, 2, 60, 'Commercial'),
          listingType: inquiryTarget.listingType,
          price: clampNumber(inquiryTarget.price, 0, 10000000, 1000),
          unit: clampString(inquiryTarget.unit, 1, 30, 'per unit'),
          stockCount: clampNumber(inquiryTarget.stockCount, 0, 1000000, 10),
          reorderPoint: clampNumber(inquiryTarget.reorderPoint, 0, 100000, 3),
          minOrderQty: clampNumber(inquiryTarget.minOrderQty, 1, 100000, 1),
          leadTimeDays: clampNumber(inquiryTarget.leadTimeDays, 0, 365, 3),
          description: clampString(inquiryTarget.description, 10, 800, 'Commercial product specification.'),
          city: clampString(inquiryTarget.city, 2, 60, 'Bengaluru'),
          district: clampString(inquiryTarget.district, 2, 80, 'Industrial District'),
          lat: clampNumber(inquiryTarget.lat, -90, 90, 12.9716),
          lng: clampNumber(inquiryTarget.lng, -180, 180, 77.5946),
          visualKey: clampString(inquiryTarget.visualKey, 2, 60, 'espresso_machine'),
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }

      await setDoc(doc(db, 'inquiries', inquiryId), {
        listingId: inquiryTarget.id,
        listingTitle: clampString(inquiryTarget.title, 3, 140, 'Commercial Listing'),
        sellerId: inquiryTarget.sellerId,
        sellerOwnerId,
        sellerName: clampString(inquiryTarget.sellerName, 2, 100, 'Verified Seller'),
        buyerId: currentUser.uid,
        buyerName: clampString(inquiryBuyerName || currentUser.displayName || 'Verified Buyer', 2, 100, 'Verified Buyer'),
        buyerLocation: clampString(buyerCity, 2, 80, 'Bengaluru'),
        requestedQty: clampNumber(Number(inquiryQty), 1, 1000000, 1),
        targetPrice: clampNumber(Number(inquiryTargetPrice), 0, 10000000, inquiryTarget.price),
        preferredContactMethod: inquiryContactMethod,
        message: clampString(
          inquiryMessage,
          5,
          600,
          'Please share direct availability and regional delivery terms.'
        ),
        sellerReply: '',
        status: 'open',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setInquiryTarget(null);
      setToastMessage(`Direct inquiry sent to ${inquiryTarget.sellerName} (${inquiryTarget.city}).`);
      setActiveSection('inquiries');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `inquiries/${inquiryId}`);
    } finally {
      setIsSubmittingInquiry(false);
    }
  };

  const handleBuyerCloseInquiry = async (inquiry: InquiryRecord) => {
    if (!currentUser) return;
    const path = `inquiries/${inquiry.id}`;
    try {
      await updateDoc(doc(db, 'inquiries', inquiry.id), {
        requestedQty: inquiry.requestedQty,
        targetPrice: inquiry.targetPrice,
        message: inquiry.message,
        status: 'closed',
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-[#0F172A] font-['Plus_Jakarta_Sans']">
      {/* TOP BAR CONTRACT: Strictly 1 row, 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-6 lg:px-10 py-4 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#marketplace"
          onClick={(e) => {
            e.preventDefault();
            setActiveSection('marketplace');
          }}
          className="text-xl font-bold tracking-tight font-['Outfit'] text-slate-900 whitespace-nowrap shrink-0"
        >
          VeroMarket
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setActiveSection('marketplace')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeSection === 'marketplace'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : ''
            }`}
          >
            Marketplace
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('compare')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeSection === 'compare'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : ''
            }`}
          >
            Compare Quotes
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('locations')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeSection === 'locations'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : ''
            }`}
          >
            Seller Locations
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('inquiries')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeSection === 'inquiries'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : ''
            }`}
          >
            Direct Inquiries ({dbInquiries.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSection('seller-hub')}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 py-0.5 ${
              activeSection === 'seller-hub'
                ? 'text-slate-900 font-semibold border-b-2 border-slate-900'
                : ''
            }`}
          >
            Seller Hub
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action */}
        <div className="flex items-center shrink-0">
          {currentUser ? (
            <button
              type="button"
              onClick={() =>
                activeSection === 'seller-hub' ? logOutUser() : setActiveSection('seller-hub')
              }
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              {activeSection === 'seller-hub' ? 'Sign Out' : 'Open Seller Console'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => signInWithGoogle()}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
            >
              Sign In / Register Seller
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Bar */}
      <div className="md:hidden flex items-center gap-2 overflow-x-auto px-4 py-2.5 bg-white border-b border-slate-200">
        {(
          [
            ['marketplace', 'Marketplace'],
            ['compare', 'Compare Quotes'],
            ['locations', 'Seller Locations'],
            ['inquiries', `Inquiries (${dbInquiries.length})`],
            ['seller-hub', 'Seller Hub'],
          ] as [ActiveSection, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 ${
              activeSection === key
                ? 'bg-[#0F172A] text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Dismissible Notification Banner */}
      {toastMessage && (
        <div className="bg-slate-900 text-white px-6 py-2.5 text-xs flex items-center justify-between">
          <span>{toastMessage}</span>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="underline font-semibold ml-4"
          >
            Close
          </button>
        </div>
      )}

      {/* MAIN WORKSPACE CONTENT CONTAINER (1440px Desktop Presence) */}
      <main className="flex-1 w-full max-w-[1380px] mx-auto px-6 lg:px-10 py-8 space-y-12">
        {/* SECTION 1: MARKETPLACE & MULTI-VENDOR DISCOVERY */}
        {activeSection === 'marketplace' && (
          <>
            {/* Storefront Split Hero */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch border border-slate-200 bg-white rounded-xl p-6 lg:p-10">
              <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
                <div className="space-y-4">
                  <div className="text-xs text-slate-500">
                    <span>Direct Inquiry B2B & Local Service Marketplace</span>
                    <span aria-hidden="true"> · </span>
                    <span>KYC-Verified Vendors</span>
                    <span aria-hidden="true"> · </span>
                    <span>Zero Checkout Commissions</span>
                  </div>

                  <h1
                    className="font-bold font-['Outfit'] text-slate-900 tracking-tight leading-[1.12]"
                    style={{
                      fontSize: 'clamp(2.1rem, 3.6vw, 3.25rem)',
                      textWrap: 'balance',
                    }}
                  >
                    Compare Regional Seller Prices, Inspect Locations & Inquire Directly.
                  </h1>

                  <p className="text-base text-slate-600 max-w-[64ch] leading-relaxed">
                    Browse commercial hardware and localized engineering services from verified regional vendors. Compare unit quotes and geodesic distance from your facility, verify seller compliance credentials, and contact sellers directly without middleman order markups.
                  </p>
                </div>

                {/* Buyer Location Selector & Search Bar */}
                <div className="pt-2 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-4">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Your Location Hub (Distance Calc)
                      </label>
                      <select
                        value={buyerCity}
                        onChange={(e) => setBuyerCity(e.target.value)}
                        className="w-full px-3.5 py-2.5 text-sm font-medium border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-none focus:border-slate-900"
                      >
                        {CITY_HUBS.map((hub) => (
                          <option key={hub.name} value={hub.name}>
                            Near {hub.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-8">
                      <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-1">
                        Search Products, Local Services, or Seller Hubs
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Search espresso systems, solar inverters, commissioning services, Mumbai..."
                          className="flex-1 px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                        />
                        {searchQuery && (
                          <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 whitespace-nowrap shrink-0"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-2">
                    <button
                      type="button"
                      onClick={() => setActiveSection('compare')}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                    >
                      Compare Multi-Seller Quotes
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('locations')}
                      className="px-4 py-2.5 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap shrink-0"
                    >
                      Explore Seller Locations Map
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSection('seller-hub')}
                      className="text-xs font-semibold text-slate-700 hover:text-slate-900 underline whitespace-nowrap shrink-0"
                    >
                      Become a Verified Seller →
                    </button>
                  </div>
                </div>
              </div>

              {/* Right 5 Columns: Architectural Verification & Proximity Card */}
              <div className="lg:col-span-5 bg-[#0F172A] text-white rounded-xl p-6 flex flex-col justify-between border border-slate-800">
                <div>
                  <div className="text-xs font-['IBM_Plex_Mono'] text-sky-400">
                    DIRECT INQUIRY ARCHITECTURE · NO CHECKOUT FEES
                  </div>
                  <h2 className="text-xl font-bold font-['Outfit'] mt-2">
                    How Multi-Vendor Price & Location Discovery Works
                  </h2>
                  <div className="space-y-4 mt-5 text-sm text-slate-300">
                    <div className="pb-3 border-b border-slate-800">
                      <div className="font-semibold text-white">
                        01. Compare Identical Models Across Regional Sellers
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Evaluate unit price, minimum inquiry quantity, and geodesic distance from {buyerCity} across multiple competing vendors.
                      </p>
                    </div>
                    <div className="pb-3 border-b border-slate-800">
                      <div className="font-semibold text-white">
                        02. Inspect Verified Seller Compliance Badges
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Sellers submit GSTIN, Municipal Trade Licenses, and ISO certificates to earn the Verified Seller status before listing local stock.
                      </p>
                    </div>
                    <div>
                      <div className="font-semibold text-white">
                        03. Contact Sellers Directly via Inquiry Thread
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Instead of placing blind online orders, send a direct inquiry with your target price, quantity, and preferred site-visit or callback channel.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 pt-6 mt-6 border-t border-slate-800 font-['IBM_Plex_Mono'] tabular-nums">
                  <div>
                    <div className="text-lg font-bold text-white">{allSellers.length}</div>
                    <div className="text-[11px] text-slate-400">Regional Sellers</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-emerald-400">
                      {allSellers.filter((s) => s.isVerified).length}/{allSellers.length}
                    </div>
                    <div className="text-[11px] text-slate-400">KYC Verified</div>
                  </div>
                  <div>
                    <div className="text-lg font-bold text-sky-400">{CITY_HUBS.length} Hubs</div>
                    <div className="text-[11px] text-slate-400">Live Coordinates</div>
                  </div>
                </div>
              </div>
            </section>

            {/* Interactive Filter Bar */}
            <section className="space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                {/* Interactive Segmented Type & Category Controls */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setTypeFilter('all')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        typeFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      All Listings ({allListings.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter('product')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        typeFilter === 'product'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Physical Products
                    </button>
                    <button
                      type="button"
                      onClick={() => setTypeFilter('service')}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                        typeFilter === 'service'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Local On-Site Services
                    </button>
                  </div>

                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  >
                    <option value="all">All Categories</option>
                    <option value="Commercial Espresso & Hospitality">
                      Commercial Espresso & Hospitality
                    </option>
                    <option value="Solar & Energy Systems">Solar & Energy Systems</option>
                    <option value="Architectural Workspace">Architectural Workspace</option>
                    <option value="Industrial CNC & Calibration">Industrial CNC & Calibration</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => setVerifiedOnly(!verifiedOnly)}
                    className={`px-3 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      verifiedOnly
                        ? 'bg-emerald-900 text-white border-emerald-900'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {verifiedOnly ? 'Showing Verified Sellers Only' : 'Filter: Verified Sellers Only'}
                  </button>
                </div>

                {/* Sort Selector */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 whitespace-nowrap">Sort by:</span>
                  <select
                    value={sortBy}
                    onChange={(e) =>
                      setSortBy(e.target.value as 'price-asc' | 'distance-asc' | 'stock-desc')
                    }
                    className="px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  >
                    <option value="distance-asc">Nearest to {buyerCity} First</option>
                    <option value="price-asc">Lowest Unit Price First</option>
                    <option value="stock-desc">Highest Available Stock</option>
                  </select>
                </div>
              </div>

              {/* 3-Column Featured Product & Service Catalog Grid */}
              {filteredListings.length === 0 ? (
                <div className="border border-slate-200 bg-white rounded-xl p-12 text-center space-y-3">
                  <div className="text-base font-semibold text-slate-900">
                    No matching products or services found
                  </div>
                  <p className="text-xs text-slate-500">
                    Try clearing your search filter or switching categories to view all regional seller listings.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setTypeFilter('all');
                      setCategoryFilter('all');
                      setVerifiedOnly(false);
                    }}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg"
                  >
                    Reset All Filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
                  {filteredListings.map((item) => {
                    const distKm = calculateDistanceKm(
                      buyerHub.lat,
                      buyerHub.lng,
                      item.lat,
                      item.lng
                    );
                    const competingCount = allListings.filter(
                      (l) => l.productGroupKey === item.productGroupKey && l.status === 'active'
                    ).length;

                    return (
                      <article
                        key={item.id}
                        className="border border-slate-200 bg-white rounded-xl overflow-hidden flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        <div>
                          {/* Lead with Imagery (65%+ visual prominence) */}
                          <ProductVisual
                            visualKey={item.visualKey}
                            listingType={item.listingType}
                            className="w-full h-52 border-b border-slate-100"
                          />

                          <div className="p-5 space-y-2.5">
                            {/* Clean Unboxed Metadata with Middot Separators (Zero-Pill Discipline) */}
                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                              <span className="uppercase tracking-wider font-medium text-slate-600">
                                {item.category}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="capitalize font-medium text-slate-700">
                                {item.listingType}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-['IBM_Plex_Mono'] tabular-nums text-slate-700">
                                {distKm === 0 ? `Local in ${item.city}` : `${distKm} km from ${buyerCity}`}
                              </span>
                            </div>

                            {/* Product / Service Title (16px SemiBold) */}
                            <h3 className="text-base font-semibold text-slate-900 leading-snug">
                              {item.title}
                            </h3>

                            <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                              {item.description}
                            </p>

                            {/* Seller Identity & Verification Status (Unboxed text) */}
                            <div className="pt-2 border-t border-slate-100 text-xs text-slate-600 space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-semibold text-slate-900 truncate">
                                  {item.sellerName}
                                </span>
                                <span
                                  className={`font-semibold shrink-0 ${
                                    item.sellerVerified ? 'text-emerald-700' : 'text-amber-700'
                                  }`}
                                >
                                  {item.sellerVerified ? '✓ Verified Seller' : 'Pending KYC'}
                                </span>
                              </div>
                              <div className="text-slate-500 flex items-center justify-between">
                                <span>
                                  Location: {item.district}, {item.city}
                                </span>
                                <span className="font-['IBM_Plex_Mono'] tabular-nums">
                                  {item.stockCount} avail
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Price & Direct Inquiry Action Bar (No Order Checkout) */}
                        <div className="px-5 py-4 bg-slate-50/70 border-t border-slate-200 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-base font-bold font-['IBM_Plex_Mono'] text-slate-900 tabular-nums">
                              ${item.price.toLocaleString()}{' '}
                              <span className="text-xs font-normal text-slate-500">
                                {item.unit}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 font-['IBM_Plex_Mono'] tabular-nums">
                              MOQ: {item.minOrderQty} · Lead: {item.leadTimeDays}d
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {competingCount > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedGroupKey(item.productGroupKey);
                                  setActiveSection('compare');
                                }}
                                className="px-2.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0"
                                title="Compare prices and locations from multiple sellers"
                              >
                                Compare ({competingCount})
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openInquiryModal(item)}
                              className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                            >
                              Send Inquiry
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {/* SECTION 2: SIDE-BY-SIDE MULTI-VENDOR PRICE & LOCATION COMPARISON */}
        {activeSection === 'compare' && (
          <section className="space-y-8">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500">
                  Multi-Vendor Price & Proximity Matrix · Reference Buyer Hub: {buyerCity}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold font-['Outfit'] text-slate-900 mt-1">
                  Compare Seller Quotes, Locations & Verification Credentials
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Your City Hub:
                </label>
                <select
                  value={buyerCity}
                  onChange={(e) => setBuyerCity(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                >
                  {CITY_HUBS.map((h) => (
                    <option key={h.name} value={h.name}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Product / Service Group Selector Tabs */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Select Product or Local Service to Compare Across Sellers:
              </div>
              <div className="flex flex-wrap gap-2">
                {comparisonGroups.map((group) => (
                  <button
                    key={group.groupKey}
                    type="button"
                    onClick={() => setSelectedGroupKey(group.groupKey)}
                    className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                      activeComparisonGroup?.groupKey === group.groupKey
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {group.title.slice(0, 42)} ({group.offers.length}{' '}
                    {group.offers.length === 1 ? 'Seller' : 'Sellers'})
                  </button>
                ))}
              </div>
            </div>

            {activeComparisonGroup && (
              <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
                <div className="p-6 border-b border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className="lg:col-span-4">
                    <ProductVisual
                      visualKey={activeComparisonGroup.visualKey}
                      listingType={activeComparisonGroup.listingType}
                      className="w-full h-44 rounded-lg border border-slate-200"
                    />
                  </div>
                  <div className="lg:col-span-8 space-y-2">
                    <div className="text-xs text-slate-500">
                      <span>{activeComparisonGroup.category}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="capitalize">{activeComparisonGroup.listingType}</span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-['IBM_Plex_Mono']">
                        Model Key: {activeComparisonGroup.groupKey}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold font-['Outfit'] text-slate-900">
                      {activeComparisonGroup.title}
                    </h2>
                    <p className="text-sm text-slate-600">
                      Comparing {activeComparisonGroup.offers.length} regional vendor quotes side by side. Evaluate unit pricing, distance from {buyerCity}, dispatch lead time, and seller KYC verification status before sending a direct inquiry.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                        <th className="py-3.5 px-5">Seller & Verification Status</th>
                        <th className="py-3.5 px-5">Seller Location & Distance</th>
                        <th className="py-3.5 px-5 text-right">Quoted Price</th>
                        <th className="py-3.5 px-5 text-right">MOQ & Lead Time</th>
                        <th className="py-3.5 px-5 text-right">Available Stock</th>
                        <th className="py-3.5 px-5 text-right">Direct Contact</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-sm">
                      {activeComparisonGroup.offers
                        .slice()
                        .sort((a, b) => a.price - b.price)
                        .map((offer, idx) => {
                          const distKm = calculateDistanceKm(
                            buyerHub.lat,
                            buyerHub.lng,
                            offer.lat,
                            offer.lng
                          );
                          return (
                            <tr key={offer.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-4 px-5">
                                <div className="font-semibold text-slate-900">
                                  {offer.sellerName}
                                </div>
                                <div className="text-xs mt-0.5">
                                  <span
                                    className={
                                      offer.sellerVerified
                                        ? 'font-semibold text-emerald-700'
                                        : 'font-semibold text-amber-700'
                                    }
                                  >
                                    {offer.sellerVerified
                                      ? '✓ Verified Seller (All Docs Approved)'
                                      : 'Pending Document Verification'}
                                  </span>
                                  {idx === 0 && (
                                    <>
                                      <span aria-hidden="true"> · </span>
                                      <span className="font-semibold text-sky-700">
                                        Lowest Price Quote
                                      </span>
                                    </>
                                  )}
                                </div>
                              </td>

                              <td className="py-4 px-5">
                                <div className="font-medium text-slate-900">
                                  {offer.city} — {offer.district}
                                </div>
                                <div className="text-xs font-['IBM_Plex_Mono'] text-slate-500 tabular-nums mt-0.5">
                                  {distKm === 0
                                    ? `Same City Hub (${buyerCity})`
                                    : `${distKm} km from ${buyerCity}`}
                                </div>
                              </td>

                              <td className="py-4 px-5 text-right font-['IBM_Plex_Mono'] tabular-nums">
                                <div className="text-base font-bold text-slate-900">
                                  ${offer.price.toLocaleString()}
                                </div>
                                <div className="text-xs text-slate-500">{offer.unit}</div>
                              </td>

                              <td className="py-4 px-5 text-right font-['IBM_Plex_Mono'] text-xs text-slate-700 tabular-nums">
                                <div>Min Qty: {offer.minOrderQty}</div>
                                <div className="text-slate-500 mt-0.5">
                                  Lead Time: {offer.leadTimeDays} days
                                </div>
                              </td>

                              <td className="py-4 px-5 text-right font-['IBM_Plex_Mono'] font-semibold text-slate-900 tabular-nums">
                                {offer.stockCount} units
                              </td>

                              <td className="py-4 px-5 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedSellerId(offer.sellerId);
                                      setActiveSection('locations');
                                    }}
                                    className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors whitespace-nowrap"
                                  >
                                    Inspect Location
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openInquiryModal(offer)}
                                    className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap"
                                  >
                                    Inquire Directly
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}

        {/* SECTION 3: INTERACTIVE SELLER LOCATIONS & PROXIMITY RADAR */}
        {activeSection === 'locations' && (
          <section className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500">
                  Geodesic Seller Location Explorer · Haversine Distance Reference: {buyerCity}
                </div>
                <h1 className="text-2xl md:text-3xl font-bold font-['Outfit'] text-slate-900 mt-1">
                  Seller Facility Locations & Regional Service Coverage
                </h1>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-xs font-semibold text-slate-600 whitespace-nowrap">
                  Measure Distance From:
                </label>
                <select
                  value={buyerCity}
                  onChange={(e) => setBuyerCity(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg bg-white"
                >
                  {CITY_HUBS.map((h) => (
                    <option key={h.name} value={h.name}>
                      {h.name} ({h.stateName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <SpatialLocationMap
              sellers={allSellers}
              listings={allListings}
              selectedBuyerCity={buyerCity}
              selectedSellerId={selectedSellerId}
              onSelectSeller={(id) => setSelectedSellerId(id)}
              onInquireListing={(item) => openInquiryModal(item)}
            />
          </section>
        )}

        {/* SECTION 4: CUSTOMER DIRECT INQUIRIES TRACKER */}
        {activeSection === 'inquiries' && (
          <section className="space-y-6">
            <div className="pb-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500">
                  Direct Buyer-to-Seller Communication Ledger
                </div>
                <h1 className="text-2xl md:text-3xl font-bold font-['Outfit'] text-slate-900 mt-1">
                  Your Direct Seller Inquiries & Quote Threads
                </h1>
              </div>
              <button
                type="button"
                onClick={() => setActiveSection('marketplace')}
                className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors"
              >
                Browse More Products & Services
              </button>
            </div>

            {!currentUser ? (
              <div className="border border-slate-200 bg-white rounded-xl p-10 text-center space-y-4">
                <h2 className="text-lg font-bold font-['Outfit'] text-slate-900">
                  Sign In to Track Your Direct Seller Inquiries
                </h2>
                <p className="text-sm text-slate-600 max-w-md mx-auto">
                  Authenticate with your Google account to send direct price and availability inquiries to verified sellers and view real-time seller responses.
                </p>
                <button
                  type="button"
                  onClick={() => signInWithGoogle()}
                  className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800"
                >
                  Sign In with Google
                </button>
              </div>
            ) : dbInquiries.length === 0 ? (
              <div className="border border-slate-200 bg-white rounded-xl p-10 text-center space-y-3">
                <div className="text-base font-semibold text-slate-900">
                  No Direct Inquiries Sent Yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Remember: Customers do not place online orders on VeroMarket. Click "Send Inquiry" on any product or service card to contact the seller directly.
                </p>
                <button
                  type="button"
                  onClick={() => setActiveSection('marketplace')}
                  className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg"
                >
                  Explore Marketplace
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-200 border border-slate-200 bg-white rounded-xl overflow-hidden">
                {dbInquiries.map((inq) => (
                  <div key={inq.id} className="p-6 space-y-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-4">
                      <div>
                        <div className="text-xs text-slate-500">
                          <span className="font-semibold text-slate-900">
                            Seller: {inq.sellerName}
                          </span>
                          <span aria-hidden="true"> · </span>
                          <span>Buyer Hub: {inq.buyerLocation}</span>
                          <span aria-hidden="true"> · </span>
                          <span>Channel: {inq.preferredContactMethod.replace('_', ' ')}</span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">
                          {inq.listingTitle}
                        </h3>
                      </div>

                      <div className="text-right font-['IBM_Plex_Mono'] text-xs tabular-nums">
                        <div>
                          Requested Qty: <span className="font-semibold">{inq.requestedQty}</span> · Target Unit Price:{' '}
                          <span className="font-semibold">${inq.targetPrice.toLocaleString()}</span>
                        </div>
                        <div className="mt-1">
                          Status:{' '}
                          <span
                            className={
                              inq.status === 'closed'
                                ? 'text-slate-500 font-semibold'
                                : inq.status === 'responded'
                                ? 'text-emerald-700 font-semibold'
                                : 'text-amber-700 font-semibold'
                            }
                          >
                            {inq.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 mb-1">
                          Your Inquiry Specification:
                        </div>
                        <p className="text-slate-800">{inq.message}</p>
                      </div>

                      <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="text-xs font-semibold text-slate-500 mb-1">
                          Seller Direct Response:
                        </div>
                        {inq.sellerReply ? (
                          <p className="text-emerald-950 font-medium">{inq.sellerReply}</p>
                        ) : (
                          <p className="text-slate-500 italic">
                            Awaiting seller response (You can also test replying in the Seller Hub tab).
                          </p>
                        )}
                      </div>
                    </div>

                    {inq.status !== 'closed' && (
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => setActiveSection('seller-hub')}
                          className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                        >
                          View in Seller Inbox
                        </button>
                        <button
                          type="button"
                          onClick={() => handleBuyerCloseInquiry(inq)}
                          className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded-lg"
                        >
                          Close Inquiry Thread
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* SECTION 5: SELLER HUB (KYC VERIFICATION, LISTINGS & INVENTORY ANALYTICS) */}
        {activeSection === 'seller-hub' && (
          <SellerHub
            currentUser={currentUser}
            sellers={allSellers}
            listings={allListings}
            inquiries={dbInquiries}
            onSeedMarketplace={handleSeedMarketplaceToFirestore}
            isSeeding={isSeeding}
          />
        )}
      </main>

      {/* DIRECT SELLER INQUIRY MODAL (User Intent Triggered Only) */}
      {inquiryTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <div className="text-xs text-slate-500">
                  <span>Direct Seller Inquiry</span>
                  <span aria-hidden="true"> · </span>
                  <span
                    className={
                      inquiryTarget.sellerVerified
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-amber-700'
                    }
                  >
                    {inquiryTarget.sellerVerified ? '✓ Verified Seller' : 'Pending KYC Seller'}
                  </span>
                </div>
                <h2 className="text-lg font-bold font-['Outfit'] text-slate-900 mt-0.5">
                  Contact {inquiryTarget.sellerName}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Seller Location: {inquiryTarget.district}, {inquiryTarget.city} (
                  {calculateDistanceKm(
                    buyerHub.lat,
                    buyerHub.lng,
                    inquiryTarget.lat,
                    inquiryTarget.lng
                  )}{' '}
                  km from {buyerCity})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInquiryTarget(null)}
                className="px-2.5 py-1 text-xs font-semibold text-slate-600 bg-slate-100 rounded hover:bg-slate-200"
              >
                Close
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-500 capitalize">
                  {inquiryTarget.listingType} Inquiry
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {inquiryTarget.title}
                </div>
              </div>
              <div className="text-right font-['IBM_Plex_Mono'] tabular-nums shrink-0">
                <div className="text-sm font-bold text-slate-900">
                  ${inquiryTarget.price.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500">{inquiryTarget.unit}</div>
              </div>
            </div>

            <form onSubmit={handleSendDirectInquiry} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Name / Organization
                  </label>
                  <input
                    type="text"
                    required
                    value={inquiryBuyerName}
                    onChange={(e) => setInquiryBuyerName(e.target.value)}
                    placeholder="e.g., Arjun Mehta — Horizon Hospitality"
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Preferred Seller Contact Channel
                  </label>
                  <select
                    value={inquiryContactMethod}
                    onChange={(e) =>
                      setInquiryContactMethod(
                        e.target.value as 'portal' | 'phone_callback' | 'site_visit'
                      )
                    }
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
                  >
                    <option value="portal">Direct Portal Quote Thread</option>
                    <option value="phone_callback">Executive Phone Callback</option>
                    <option value="site_visit">Facility Inspection / Site Visit</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Requested Quantity (MOQ: {inquiryTarget.minOrderQty})
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={inquiryQty}
                    onChange={(e) => setInquiryQty(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Your Target Unit Price ($ USD)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={inquiryTargetPrice}
                    onChange={(e) => setInquiryTargetPrice(Number(e.target.value))}
                    className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Direct Message to Seller (Delivery Timeline, Technical Questions, Inspection Request)
                </label>
                <textarea
                  rows={3}
                  required
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div className="pt-2 flex items-center justify-between gap-4">
                <div className="text-xs text-slate-500">
                  No online payment required. Inquiry goes directly to the seller.
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setInquiryTarget(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingInquiry}
                    className="px-5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSubmittingInquiry
                      ? 'Sending Inquiry...'
                      : currentUser
                      ? 'Send Direct Inquiry'
                      : 'Sign In & Send Inquiry'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quiet Editorial Footer (No Fake Telemetry Tickers) */}
      <footer className="border-t border-slate-200 bg-white px-6 lg:px-10 py-6 mt-12">
        <div className="max-w-[1380px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>
            VeroMarket · Multi-Vendor Price, Location & Direct Inquiry Discovery Platform
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveSection('marketplace')}
              className="hover:text-slate-900"
            >
              Marketplace
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('compare')}
              className="hover:text-slate-900"
            >
              Price Comparison
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('locations')}
              className="hover:text-slate-900"
            >
              Seller Locations
            </button>
            <button
              type="button"
              onClick={() => setActiveSection('seller-hub')}
              className="hover:text-slate-900"
            >
              Seller Verification & Analytics
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
