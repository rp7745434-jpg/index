import React, { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
  deleteDoc,
} from 'firebase/firestore';
import {
  clampNumber,
  clampString,
  db,
  handleFirestoreError,
  OperationType,
  sanitizeId,
  signInWithGoogle,
} from '../firebase';
import {
  CITY_HUBS,
  InquiryRecord,
  ListingRecord,
  SellerPrivateRecord,
  SellerPublicRecord,
} from '../types';

interface SellerHubProps {
  currentUser: User | null;
  sellers: SellerPublicRecord[];
  listings: ListingRecord[];
  inquiries: InquiryRecord[];
  onSeedMarketplace: () => Promise<void>;
  isSeeding: boolean;
}

export const SellerHub: React.FC<SellerHubProps> = ({
  currentUser,
  sellers,
  listings,
  inquiries,
  onSeedMarketplace,
  isSeeding,
}) => {
  const [activeTab, setActiveTab] = useState<'analytics' | 'listings' | 'verification' | 'inquiries'>('analytics');
  const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Find current user's primary seller profile
  const mySellerId = currentUser ? sanitizeId(`seller_${currentUser.uid}`) : '';
  const mySellerProfile = sellers.find(
    (s) => s.id === mySellerId || (currentUser && s.ownerId === currentUser.uid)
  );

  // Isolated private KYC state loaded from /seller_private/{sellerId}
  const [privateDocs, setPrivateDocs] = useState<SellerPrivateRecord | null>(null);

  // Registration / Verification Form State
  const [businessName, setBusinessName] = useState('Apex Precision & Industrial Supply');
  const [category, setCategory] = useState('Commercial Espresso & Hospitality');
  const [city, setCity] = useState('Bengaluru');
  const [district, setDistrict] = useState('Peenya Industrial Stage II');
  const [serviceRadiusKm, setServiceRadiusKm] = useState(500);
  const [taxIdFull, setTaxIdFull] = useState('29AAACA8821D1Z5');
  const [tradeLicenseNumber, setTradeLicenseNumber] = useState('TL-BLR-2026-9042');
  const [isoCertRef, setIsoCertRef] = useState('ISO-9001-2026-VERO');
  const [registeredStreet, setRegisteredStreet] = useState('Plot 42, 4th Phase, Peenya Industrial Area, Bengaluru 560058');
  const [contactPhone, setContactPhone] = useState('+91-80-41209876');
  const [contactEmail, setContactEmail] = useState(currentUser?.email || 'compliance@apexindustrial.in');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // New Listing Form State
  const [listingTitle, setListingTitle] = useState('');
  const [listingCategory, setListingCategory] = useState('Commercial Espresso & Hospitality');
  const [listingType, setListingType] = useState<'product' | 'service'>('product');
  const [productGroupKey, setProductGroupKey] = useState('linea_dual_boiler_pro_2g');
  const [customGroupKey, setCustomGroupKey] = useState('');
  const [price, setPrice] = useState(6380);
  const [unit, setUnit] = useState('per unit');
  const [stockCount, setStockCount] = useState(12);
  const [reorderPoint, setReorderPoint] = useState(4);
  const [minOrderQty, setMinOrderQty] = useState(1);
  const [leadTimeDays, setLeadTimeDays] = useState(3);
  const [visualKey, setVisualKey] = useState('espresso_machine');
  const [description, setDescription] = useState(
    'Factory-calibrated commercial unit available for regional inspection and direct B2B dispatch from our local warehouse hub.'
  );
  const [isCreatingListing, setIsCreatingListing] = useState(false);

  // Reply state for seller inquiries
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [updatingInquiryId, setUpdatingInquiryId] = useState<string | null>(null);

  // Load existing seller profile & private compliance record when user signs in
  useEffect(() => {
    if (!currentUser || !mySellerProfile) return;
    setBusinessName(mySellerProfile.businessName);
    setCategory(mySellerProfile.category);
    setCity(mySellerProfile.city);
    setDistrict(mySellerProfile.district);
    setServiceRadiusKm(mySellerProfile.serviceRadiusKm);

    const privPath = `seller_private/${mySellerProfile.id}`;
    getDoc(doc(db, 'seller_private', mySellerProfile.id))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as SellerPrivateRecord;
          setPrivateDocs({ ...data, id: snap.id });
          setTaxIdFull(data.taxIdFull);
          setTradeLicenseNumber(data.tradeLicenseNumber);
          setIsoCertRef(data.isoCertRef);
          setRegisteredStreet(data.registeredStreet);
          setContactPhone(data.contactPhone);
          setContactEmail(data.contactEmail);
        }
      })
      .catch((err) => {
        // Non-fatal if private doc doesn't exist yet for seeded vendor
        console.warn('Could not load private doc:', privPath, err);
      });
  }, [currentUser, mySellerProfile?.id]);

  // Document Verification Validator
  const isTaxIdValid = /^[0-9A-Z\-]{10,32}$/.test(taxIdFull.trim());
  const isTradeLicenseValid = /^TL-[A-Z0-9\-]{6,35}$/i.test(tradeLicenseNumber.trim());
  const isIsoValid = /^(ISO|CE|BIS|UL)-[A-Z0-9\-]{4,35}$/i.test(isoCertRef.trim());
  const isAddressValid = registeredStreet.trim().length >= 10;
  const allDocumentsValid = isTaxIdValid && isTradeLicenseValid && isIsoValid && isAddressValid;

  const handleSaveSellerVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    setIsSavingProfile(true);
    setStatusBanner(null);

    const targetSellerId = mySellerProfile?.id || mySellerId;
    const hub = CITY_HUBS.find((h) => h.name === city) || CITY_HUBS[0];
    const maskedGstin =
      taxIdFull.trim().length >= 8
        ? `${taxIdFull.trim().slice(0, 4)}••••${taxIdFull.trim().slice(-4)}`
        : 'PENDING-TAX-ID';

    const verifiedFlag = allDocumentsValid;
    const verificationStatus: 'verified' | 'pending' = verifiedFlag ? 'verified' : 'pending';

    const publicRef = doc(db, 'sellers', targetSellerId);
    const privateRef = doc(db, 'seller_private', targetSellerId);

    try {
      const existingSnap = await getDoc(publicRef);
      const batch = writeBatch(db);

      if (!existingSnap.exists()) {
        batch.set(publicRef, {
          ownerId: currentUser.uid,
          businessName: clampString(businessName, 2, 100, 'Verified Vendor Hub'),
          category: clampString(category, 2, 60, 'Commercial Equipment'),
          city: clampString(hub.name, 2, 60, 'Bengaluru'),
          district: clampString(district, 2, 80, hub.district),
          lat: clampNumber(hub.lat, -90, 90, 12.9716),
          lng: clampNumber(hub.lng, -180, 180, 77.5946),
          gstinMasked: clampString(maskedGstin, 5, 30, '29AA••••1Z5'),
          isVerified: verifiedFlag,
          verificationStatus,
          serviceRadiusKm: clampNumber(Number(serviceRadiusKm), 1, 5000, 400),
          responseRatePct: 98,
          status: 'active',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.set(privateRef, {
          ownerId: currentUser.uid,
          taxIdFull: clampString(taxIdFull.toUpperCase(), 8, 32, '29AAACA8821D1Z5'),
          tradeLicenseNumber: clampString(tradeLicenseNumber.toUpperCase(), 6, 40, 'TL-BLR-2026-9042'),
          isoCertRef: clampString(isoCertRef.toUpperCase(), 4, 40, 'ISO-9001-2026'),
          registeredStreet: clampString(registeredStreet, 5, 200, 'Peenya Industrial Area'),
          contactPhone: clampString(contactPhone, 7, 24, '+91-80-41209876'),
          contactEmail: clampString(contactEmail || currentUser.email || 'seller@veromarket.in', 5, 120, 'seller@veromarket.in'),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        batch.update(publicRef, {
          businessName: clampString(businessName, 2, 100, 'Verified Vendor Hub'),
          category: clampString(category, 2, 60, 'Commercial Equipment'),
          city: clampString(hub.name, 2, 60, 'Bengaluru'),
          district: clampString(district, 2, 80, hub.district),
          lat: clampNumber(hub.lat, -90, 90, 12.9716),
          lng: clampNumber(hub.lng, -180, 180, 77.5946),
          gstinMasked: clampString(maskedGstin, 5, 30, '29AA••••1Z5'),
          isVerified: verifiedFlag,
          verificationStatus,
          serviceRadiusKm: clampNumber(Number(serviceRadiusKm), 1, 5000, 400),
          updatedAt: serverTimestamp(),
        });

        batch.update(privateRef, {
          taxIdFull: clampString(taxIdFull.toUpperCase(), 8, 32, '29AAACA8821D1Z5'),
          tradeLicenseNumber: clampString(tradeLicenseNumber.toUpperCase(), 6, 40, 'TL-BLR-2026-9042'),
          isoCertRef: clampString(isoCertRef.toUpperCase(), 4, 40, 'ISO-9001-2026'),
          registeredStreet: clampString(registeredStreet, 5, 200, 'Peenya Industrial Area'),
          contactPhone: clampString(contactPhone, 7, 24, '+91-80-41209876'),
          contactEmail: clampString(contactEmail || currentUser.email || 'seller@veromarket.in', 5, 120, 'seller@veromarket.in'),
          updatedAt: serverTimestamp(),
        });
      }

      await batch.commit();
      setStatusBanner({
        type: 'success',
        text: verifiedFlag
          ? 'All compliance documents verified! Your Verified Seller Badge is now active across the marketplace.'
          : 'Seller profile saved with Pending Verification status. Complete all document formats to unlock the Verified Badge.',
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `sellers/${targetSellerId}`);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!mySellerProfile) {
      setStatusBanner({
        type: 'error',
        text: 'Please complete Seller Registration & Document Verification first before publishing listings.',
      });
      setActiveTab('verification');
      return;
    }

    setIsCreatingListing(true);
    setStatusBanner(null);

    const listingId = sanitizeId(`lst_${currentUser.uid.slice(0, 8)}_${Date.now()}`);
    const finalGroupKey = sanitizeId(
      productGroupKey === 'custom' ? customGroupKey || listingTitle : productGroupKey,
      'custom_catalog_item'
    );

    try {
      await setDoc(doc(db, 'listings', listingId), {
        ownerId: currentUser.uid,
        sellerId: mySellerProfile.id,
        sellerName: clampString(mySellerProfile.businessName, 2, 100, 'Verified Seller'),
        sellerVerified: Boolean(mySellerProfile.isVerified),
        productGroupKey: clampString(finalGroupKey, 2, 80, 'general_equipment'),
        title: clampString(listingTitle, 3, 140, 'Commercial Industrial Unit'),
        category: clampString(listingCategory, 2, 60, mySellerProfile.category),
        listingType,
        price: clampNumber(Number(price), 0, 10000000, 1000),
        unit: clampString(unit, 1, 30, 'per unit'),
        stockCount: clampNumber(Number(stockCount), 0, 1000000, 10),
        reorderPoint: clampNumber(Number(reorderPoint), 0, 100000, 3),
        minOrderQty: clampNumber(Number(minOrderQty), 1, 100000, 1),
        leadTimeDays: clampNumber(Number(leadTimeDays), 0, 365, 3),
        description: clampString(
          description,
          10,
          800,
          'Commercial grade hardware and localized support around our registered seller hub.'
        ),
        city: clampString(mySellerProfile.city, 2, 60, 'Bengaluru'),
        district: clampString(mySellerProfile.district, 2, 80, 'Industrial Zone'),
        lat: clampNumber(mySellerProfile.lat, -90, 90, 12.9716),
        lng: clampNumber(mySellerProfile.lng, -180, 180, 77.5946),
        visualKey: clampString(visualKey, 2, 60, 'espresso_machine'),
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setListingTitle('');
      setStatusBanner({
        type: 'success',
        text: `Published listing in ${mySellerProfile.city}! Customers can now compare your price and location.`,
      });
      setActiveTab('analytics');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `listings/${listingId}`);
    } finally {
      setIsCreatingListing(false);
    }
  };

  const handleAdjustInventory = async (
    listing: ListingRecord,
    newStock: number,
    newPrice: number,
    newStatus: 'active' | 'draft' | 'archived' = listing.status
  ) => {
    if (!currentUser) return;
    const path = `listings/${listing.id}`;
    try {
      await updateDoc(doc(db, 'listings', listing.id), {
        price: clampNumber(newPrice, 0, 10000000, listing.price),
        stockCount: clampNumber(newStock, 0, 1000000, 0),
        reorderPoint: listing.reorderPoint,
        leadTimeDays: listing.leadTimeDays,
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteListing = async (listingId: string) => {
    if (!currentUser) return;
    const path = `listings/${listingId}`;
    try {
      await deleteDoc(doc(db, 'listings', listingId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleSellerReplyInquiry = async (
    inquiry: InquiryRecord,
    nextStatus: 'responded' | 'closed'
  ) => {
    if (!currentUser) return;
    const draft =
      replyDrafts[inquiry.id] !== undefined ? replyDrafts[inquiry.id] : inquiry.sellerReply;
    const path = `inquiries/${inquiry.id}`;
    setUpdatingInquiryId(inquiry.id);
    try {
      await updateDoc(doc(db, 'inquiries', inquiry.id), {
        sellerReply: clampString(
          draft,
          1,
          600,
          'Confirmed availability at our local facility. Ready for inspection or dispatch.'
        ),
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setUpdatingInquiryId(null);
    }
  };

  if (!currentUser) {
    return (
      <div className="border border-slate-200 bg-white rounded-xl p-10 max-w-2xl mx-auto text-center my-8">
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Seller Verification & Inventory Console
        </div>
        <h2 className="text-2xl font-bold font-['Outfit'] text-slate-900 mt-2">
          Register as a Verified Seller & Track Local Inventory
        </h2>
        <p className="text-sm text-slate-600 mt-2 leading-relaxed">
          Sign in with your Google account to submit business compliance documents (GSTIN, Municipal Trade License, and ISO Quality Certification), earn a Verified Seller Badge, publish products and services around your city hub, and manage incoming buyer inquiries.
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={() => signInWithGoogle()}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors"
          >
            Sign In with Google to Access Seller Hub
          </button>
        </div>
      </div>
    );
  }

  // Filter listings managed by the current user
  const myListings = listings.filter((l) => l.ownerId === currentUser.uid);
  const sellerInquiries = inquiries.filter((inq) => inq.sellerOwnerId === currentUser.uid);

  // Inventory Analytics Metrics
  const totalStockUnits = myListings.reduce((acc, item) => acc + item.stockCount, 0);
  const totalCatalogValue = myListings.reduce(
    (acc, item) => acc + item.price * item.stockCount,
    0
  );
  const lowStockItems = myListings.filter(
    (item) => item.status === 'active' && item.stockCount <= item.reorderPoint
  );
  const openInquiriesCount = sellerInquiries.filter((i) => i.status === 'open').length;

  return (
    <div className="space-y-8">
      {/* Workspace Header & Segmented Navigation */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>Seller Console</span>
            <span aria-hidden="true">/</span>
            <span className="font-semibold text-slate-900">
              {mySellerProfile ? mySellerProfile.businessName : 'Unregistered Seller Account'}
            </span>
            <span aria-hidden="true">·</span>
            <span
              className={
                mySellerProfile?.isVerified
                  ? 'font-semibold text-emerald-700'
                  : 'font-semibold text-amber-700'
              }
            >
              {mySellerProfile?.isVerified
                ? 'Verified Seller Badge Active'
                : 'Verification Pending — Submit KYC Documents'}
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold font-['Outfit'] text-slate-900 mt-1">
            Inventory Analytics & Seller Compliance Hub
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button
              type="button"
              onClick={() => setActiveTab('analytics')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'analytics'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Inventory Analytics ({myListings.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('verification')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'verification'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              KYC & Verified Badge
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('listings')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'listings'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              + Publish Product / Service
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('inquiries')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'inquiries'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Buyer Inquiries ({sellerInquiries.length})
            </button>
          </div>
        </div>
      </div>

      {statusBanner && (
        <div
          className={`px-4 py-3 rounded-lg border text-sm flex items-center justify-between ${
            statusBanner.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-rose-50 border-rose-200 text-rose-900'
          }`}
        >
          <span>{statusBanner.text}</span>
          <button
            type="button"
            onClick={() => setStatusBanner(null)}
            className="text-xs font-semibold underline ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* TAB 1: INVENTORY ANALYTICS & STOCK LEDGER */}
      {activeTab === 'analytics' && (
        <div className="space-y-8">
          {/* 4-Column KPI Strip with Tabular Numerals */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="border border-slate-200 bg-white rounded-xl p-5">
              <div className="text-xs text-slate-500">Total Inventory Valuation</div>
              <div className="text-2xl font-bold font-['IBM_Plex_Mono'] text-slate-900 mt-1 tabular-nums">
                ${totalCatalogValue.toLocaleString()}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Across {myListings.length} active SKUs & service slots
              </div>
            </div>

            <div className="border border-slate-200 bg-white rounded-xl p-5">
              <div className="text-xs text-slate-500">Available Stock & Service Capacity</div>
              <div className="text-2xl font-bold font-['IBM_Plex_Mono'] text-slate-900 mt-1 tabular-nums">
                {totalStockUnits.toLocaleString()} units
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Hub: {mySellerProfile ? `${mySellerProfile.city} (${mySellerProfile.serviceRadiusKm} km)` : 'Unassigned'}
              </div>
            </div>

            <div className="border border-slate-200 bg-white rounded-xl p-5">
              <div className="text-xs text-slate-500">Low-Stock Reorder Alerts</div>
              <div
                className={`text-2xl font-bold font-['IBM_Plex_Mono'] mt-1 tabular-nums ${
                  lowStockItems.length > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}
              >
                {lowStockItems.length} {lowStockItems.length === 1 ? 'listing' : 'listings'}
              </div>
              <div className="text-xs text-slate-500 mt-2">
                {lowStockItems.length > 0
                  ? 'Stock at or below reorder threshold'
                  : 'All inventory above safety buffer'}
              </div>
            </div>

            <div className="border border-slate-200 bg-white rounded-xl p-5">
              <div className="text-xs text-slate-500">Direct Customer Inquiries</div>
              <div className="text-2xl font-bold font-['IBM_Plex_Mono'] text-slate-900 mt-1 tabular-nums">
                {sellerInquiries.length} total · {openInquiriesCount} open
              </div>
              <div className="text-xs text-slate-500 mt-2">
                Verification: {mySellerProfile?.isVerified ? 'Verified Seller Badge' : 'Pending KYC'}
              </div>
            </div>
          </div>

          {/* High-Density Inventory Ledger Table */}
          <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold font-['Outfit'] text-slate-900">
                  Real-Time SKU & Local Service Inventory Ledger
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Adjust regional pricing, restock inventory quantities, and monitor reorder buffer ratios
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onSeedMarketplace}
                  disabled={isSeeding}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  {isSeeding ? 'Syncing Multi-Vendor Catalog...' : 'Sync Sample Multi-Vendor Catalog to DB'}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('listings')}
                  className="px-3.5 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                >
                  + New Listing
                </button>
              </div>
            </div>

            {myListings.length === 0 ? (
              <div className="p-10 text-center space-y-3">
                <div className="text-sm font-semibold text-slate-900">
                  No Seller Listings Linked to Your Account Yet
                </div>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Register your seller profile with compliance documents or sync the sample multi-vendor catalog into Firestore so you can manage live inventory and respond to customer inquiries.
                </p>
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setActiveTab('verification')}
                    className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    1. Complete Seller Verification
                  </button>
                  <button
                    type="button"
                    onClick={onSeedMarketplace}
                    disabled={isSeeding}
                    className="px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    {isSeeding ? 'Syncing...' : 'Or Load Sample Multi-Vendor Inventory'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider bg-slate-50">
                      <th className="py-3 px-4">Listing & Category</th>
                      <th className="py-3 px-4">Seller Facility Hub</th>
                      <th className="py-3 px-4 text-right">Unit Price ($)</th>
                      <th className="py-3 px-4 text-right">Stock / Capacity</th>
                      <th className="py-3 px-4 text-right">Reorder Point</th>
                      <th className="py-3 px-4">Inventory Health</th>
                      <th className="py-3 px-4 text-right">Quick Controls</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {myListings.map((item) => {
                      const isLow = item.stockCount <= item.reorderPoint;
                      const healthRatio = Math.min(
                        100,
                        Math.round((item.stockCount / Math.max(1, item.reorderPoint * 3)) * 100)
                      );
                      return (
                        <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="text-xs text-slate-500 mt-0.5">
                              <span className="capitalize">{item.listingType}</span>
                              <span aria-hidden="true"> · </span>
                              <span>{item.category}</span>
                              <span aria-hidden="true"> · </span>
                              <span className="font-['IBM_Plex_Mono']">
                                Group: {item.productGroupKey}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-xs text-slate-600">
                            <div className="font-medium text-slate-900">{item.city}</div>
                            <div>{item.sellerName}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-['IBM_Plex_Mono'] font-semibold text-slate-900 tabular-nums">
                            ${item.price.toLocaleString()}
                            <div className="text-[11px] font-normal text-slate-500">{item.unit}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right font-['IBM_Plex_Mono'] font-semibold text-slate-900 tabular-nums">
                            {item.stockCount}
                          </td>
                          <td className="py-3.5 px-4 text-right font-['IBM_Plex_Mono'] text-slate-600 tabular-nums">
                            {item.reorderPoint}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs font-medium">
                              {item.status === 'archived' ? (
                                <span className="text-slate-500">Archived (Locked)</span>
                              ) : isLow ? (
                                <span className="text-amber-700 font-semibold">
                                  Restock Needed ({item.stockCount} left)
                                </span>
                              ) : (
                                <span className="text-emerald-700 font-semibold">
                                  Healthy Stock
                                </span>
                              )}
                            </div>
                            <div className="w-28 h-1.5 bg-slate-200 rounded-full overflow-hidden mt-1.5">
                              <div
                                className={`h-full ${
                                  isLow ? 'bg-amber-600' : 'bg-emerald-600'
                                }`}
                                style={{ width: `${healthRatio}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {item.status !== 'archived' ? (
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdjustInventory(
                                      item,
                                      Math.max(0, item.stockCount - 1),
                                      item.price
                                    )
                                  }
                                  className="px-2 py-1 text-xs font-['IBM_Plex_Mono'] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                                  title="Decrease Stock by 1"
                                >
                                  -1
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdjustInventory(item, item.stockCount + 5, item.price)
                                  }
                                  className="px-2 py-1 text-xs font-['IBM_Plex_Mono'] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-800 rounded"
                                  title="Restock +5 Units"
                                >
                                  +5
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAdjustInventory(
                                      item,
                                      item.stockCount,
                                      Math.max(10, Math.round(item.price * 0.97))
                                    )
                                  }
                                  className="px-2 py-1 text-xs font-['IBM_Plex_Mono'] font-semibold bg-sky-50 hover:bg-sky-100 text-sky-900 rounded"
                                  title="Discount Price by 3%"
                                >
                                  -3% $
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteListing(item.id)}
                                  className="px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50 rounded"
                                >
                                  Remove
                                </button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Locked</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: SELLER REGISTRATION & DOCUMENT VERIFICATION ENGINE */}
      {activeTab === 'verification' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <form
            onSubmit={handleSaveSellerVerification}
            className="lg:col-span-7 border border-slate-200 bg-white rounded-xl p-6 space-y-6"
          >
            <div className="border-b border-slate-200 pb-4">
              <h2 className="text-lg font-bold font-['Outfit'] text-slate-900">
                Seller Registration & Compliance Document Verification
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Submit your facility location and statutory compliance identifiers. When all 3 documents pass format verification, your account automatically receives the Verified Seller Badge.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Business Name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Industry Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
                >
                  <option value="Commercial Espresso & Hospitality">
                    Commercial Espresso & Hospitality
                  </option>
                  <option value="Solar & Energy Systems">Solar & Energy Systems</option>
                  <option value="Architectural Workspace">Architectural Workspace</option>
                  <option value="Industrial CNC & Calibration">Industrial CNC & Calibration</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Seller City Hub (For Location Mapping)
                </label>
                <select
                  value={city}
                  onChange={(e) => {
                    const selected = CITY_HUBS.find((c) => c.name === e.target.value);
                    setCity(e.target.value);
                    if (selected) setDistrict(selected.district);
                  }}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
                >
                  {CITY_HUBS.map((h) => (
                    <option key={h.name} value={h.name}>
                      {h.name} ({h.stateName})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Industrial Estate / District
                </label>
                <input
                  type="text"
                  required
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Regional Service Coverage Radius (km)
                </label>
                <input
                  type="number"
                  min={10}
                  max={5000}
                  required
                  value={serviceRadiusKm}
                  onChange={(e) => setServiceRadiusKm(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Compliance Contact Phone (Isolated in Vault)
                </label>
                <input
                  type="text"
                  required
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Mandatory Verification Documents (Stored in Isolated /seller_private Vault)
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    1. GSTIN / Tax ID (10–32 chars)
                  </label>
                  <input
                    type="text"
                    required
                    value={taxIdFull}
                    onChange={(e) => setTaxIdFull(e.target.value)}
                    placeholder="29AAACA8821D1Z5"
                    className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <div className="text-[11px] mt-1 font-medium">
                    {isTaxIdValid ? (
                      <span className="text-emerald-700">Format Validated</span>
                    ) : (
                      <span className="text-amber-700">Requires 10+ alphanumeric chars</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    2. Trade License (Prefix TL-)
                  </label>
                  <input
                    type="text"
                    required
                    value={tradeLicenseNumber}
                    onChange={(e) => setTradeLicenseNumber(e.target.value)}
                    placeholder="TL-BLR-2026-9042"
                    className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <div className="text-[11px] mt-1 font-medium">
                    {isTradeLicenseValid ? (
                      <span className="text-emerald-700">Format Validated</span>
                    ) : (
                      <span className="text-amber-700">Must start with TL-</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    3. Quality Cert (ISO-/CE-/BIS-)
                  </label>
                  <input
                    type="text"
                    required
                    value={isoCertRef}
                    onChange={(e) => setIsoCertRef(e.target.value)}
                    placeholder="ISO-9001-2026-VERO"
                    className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                  />
                  <div className="text-[11px] mt-1 font-medium">
                    {isIsoValid ? (
                      <span className="text-emerald-700">Format Validated</span>
                    ) : (
                      <span className="text-amber-700">Must start with ISO-, CE-, or BIS-</span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registered Warehouse / Facility Street Address
                </label>
                <input
                  type="text"
                  required
                  value={registeredStreet}
                  onChange={(e) => setRegisteredStreet(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            </div>

            <div className="pt-2 flex items-center justify-between gap-4">
              <div className="text-xs text-slate-600">
                Verification Outcome:{' '}
                <span
                  className={
                    allDocumentsValid
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-amber-700'
                  }
                >
                  {allDocumentsValid
                    ? 'All 3 Documents Valid — Verified Seller Badge Will Be Issued'
                    : 'Incomplete Document Format — Will Save as Pending Verification'}
                </span>
              </div>
              <button
                type="submit"
                disabled={isSavingProfile}
                className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {isSavingProfile
                  ? 'Verifying & Saving...'
                  : mySellerProfile
                  ? 'Update Seller Verification'
                  : 'Register & Verify Seller Account'}
              </button>
            </div>
          </form>

          {/* Right 5 Columns: Live Verification Audit Checklist */}
          <div className="lg:col-span-5 border border-slate-200 bg-white rounded-xl p-6 space-y-5">
            <div className="border-b border-slate-200 pb-4">
              <div className="text-xs text-slate-500">Live Compliance Inspector</div>
              <h3 className="text-lg font-bold font-['Outfit'] text-slate-900 mt-0.5">
                Verified Seller Badge Audit
              </h3>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">1. GSTIN / Tax Registration Check</span>
                <span
                  className={`font-['IBM_Plex_Mono'] text-xs font-semibold ${
                    isTaxIdValid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isTaxIdValid ? 'PASS' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">2. Municipal Trade License Check</span>
                <span
                  className={`font-['IBM_Plex_Mono'] text-xs font-semibold ${
                    isTradeLicenseValid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isTradeLicenseValid ? 'PASS' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">3. ISO / BIS Quality Certificate Check</span>
                <span
                  className={`font-['IBM_Plex_Mono'] text-xs font-semibold ${
                    isIsoValid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isIsoValid ? 'PASS' : 'PENDING'}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="text-slate-600">4. Physical Facility Location Coordinates</span>
                <span
                  className={`font-['IBM_Plex_Mono'] text-xs font-semibold ${
                    isAddressValid ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {isAddressValid ? 'PASS' : 'PENDING'}
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 space-y-1.5">
              <div className="font-semibold text-slate-900">
                Zero-Trust Split Collection Architecture
              </div>
              <p>
                Your full tax registration, street address, and phone number are stored exclusively in{' '}
                <code className="font-['IBM_Plex_Mono'] text-slate-800">/seller_private/{mySellerProfile?.id || mySellerId}</code>{' '}
                while public shoppers only see your masked GSTIN, city hub, and Verified Seller status in{' '}
                <code className="font-['IBM_Plex_Mono'] text-slate-800">/sellers/{mySellerProfile?.id || mySellerId}</code>.
              </p>
              {privateDocs && (
                <div className="pt-2 text-[11px] font-['IBM_Plex_Mono'] text-slate-700">
                  Vault Record Synced: {privateDocs.tradeLicenseNumber} · {privateDocs.isoCertRef}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PUBLISH NEW LOCAL PRODUCT OR SERVICE LISTING */}
      {activeTab === 'listings' && (
        <form
          onSubmit={handleCreateListing}
          className="border border-slate-200 bg-white rounded-xl p-6 max-w-4xl space-y-6"
        >
          <div className="border-b border-slate-200 pb-4">
            <h2 className="text-lg font-bold font-['Outfit'] text-slate-900">
              Publish Product or Local Service Around Your Location
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Listings automatically inherit your registered Seller Hub coordinates ({mySellerProfile?.city || city}) and your Verified Seller Badge status so customers can compare your price and proximity.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product or Service Title
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Linea Chrono Dual-Boiler 2-Group Commercial Espresso System"
                value={listingTitle}
                onChange={(e) => setListingTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Listing Type
              </label>
              <select
                value={listingType}
                onChange={(e) => setListingType(e.target.value as 'product' | 'service')}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
              >
                <option value="product">Physical Commercial Product</option>
                <option value="service">Localized On-Site Engineering / Service</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Multi-Vendor Comparison Group (Compare Against Other Sellers)
              </label>
              <select
                value={productGroupKey}
                onChange={(e) => setProductGroupKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
              >
                <option value="linea_dual_boiler_pro_2g">
                  Linea Chrono Dual-Boiler 2-Group Espresso (Compare Quotes)
                </option>
                <option value="solaris_15kw_hybrid_lfp_pack">
                  VoltCore 15kW Hybrid Solar Inverter + 20kWh LFP (Compare Quotes)
                </option>
                <option value="service_microgrid_audit_install">
                  Commercial Solar & Grid Commissioning Service (Compare Quotes)
                </option>
                <option value="aether_alu_task_chair">
                  Aether Die-Cast Aluminum Task Chair (Compare Quotes)
                </option>
                <option value="custom">Create New Custom Product/Service Group Key</option>
              </select>
            </div>

            {productGroupKey === 'custom' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Comparison Group Key (Alphanumeric & underscores)
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., cnc_5axis_spindle_pro"
                  value={customGroupKey}
                  onChange={(e) => setCustomGroupKey(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                value={listingCategory}
                onChange={(e) => setListingCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
              >
                <option value="Commercial Espresso & Hospitality">
                  Commercial Espresso & Hospitality
                </option>
                <option value="Solar & Energy Systems">Solar & Energy Systems</option>
                <option value="Architectural Workspace">Architectural Workspace</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Technical Illustration Blueprint
              </label>
              <select
                value={visualKey}
                onChange={(e) => setVisualKey(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900 bg-white"
              >
                <option value="espresso_machine">Commercial Dual-Boiler Espresso System</option>
                <option value="solar_inverter">Hybrid Solar Inverter & LFP Storage Rack</option>
                <option value="ergonomic_chair">Architectural Die-Cast Task Chair</option>
                <option value="calibration_service">Field Calibration & Harmonic Diagnostic Unit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quoted Unit Price (USD $)
              </label>
              <input
                type="number"
                min={1}
                required
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Pricing Unit
              </label>
              <input
                type="text"
                required
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="per unit / per site audit"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Initial Stock / Monthly Service Capacity
              </label>
              <input
                type="number"
                min={0}
                required
                value={stockCount}
                onChange={(e) => setStockCount(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Low-Stock Reorder Alert Point
              </label>
              <input
                type="number"
                min={0}
                required
                value={reorderPoint}
                onChange={(e) => setReorderPoint(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Minimum Inquiry Quantity (MOQ)
              </label>
              <input
                type="number"
                min={1}
                required
                value={minOrderQty}
                onChange={(e) => setMinOrderQty(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Dispatch / Mobilization Lead Time (Days)
              </label>
              <input
                type="number"
                min={0}
                required
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-['IBM_Plex_Mono'] border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Technical Specifications & Regional Scope (10–800 chars)
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isCreatingListing}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {isCreatingListing ? 'Publishing Listing...' : 'Publish Listing to Regional Marketplace'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: DIRECT BUYER INQUIRY INBOX FOR SELLERS */}
      {activeTab === 'inquiries' && (
        <div className="border border-slate-200 bg-white rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200">
            <h2 className="text-base font-bold font-['Outfit'] text-slate-900">
              Incoming Buyer Inquiries & Direct Quote Requests
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Respond directly to customers inquiring about your products and local services. Closed threads are permanently locked by Firestore security rules.
            </p>
          </div>

          {sellerInquiries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              No direct buyer inquiries received yet. Try sending an inquiry from the Marketplace tab to test the real-time workflow.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {sellerInquiries.map((inq) => (
                <div key={inq.id} className="p-6 space-y-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-4">
                    <div>
                      <div className="text-xs text-slate-500">
                        <span className="font-semibold text-slate-900">Buyer: {inq.buyerName}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Buyer Hub: {inq.buyerLocation}</span>
                        <span aria-hidden="true"> · </span>
                        <span>Preferred Channel: {inq.preferredContactMethod.replace('_', ' ')}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-900 mt-1">
                        {inq.listingTitle}
                      </h3>
                    </div>

                    <div className="text-right font-['IBM_Plex_Mono'] text-xs tabular-nums">
                      <div>
                        Requested Qty: <span className="font-semibold">{inq.requestedQty}</span> · Target Price:{' '}
                        <span className="font-semibold">${inq.targetPrice.toLocaleString()}</span>
                      </div>
                      <div className="mt-0.5">
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

                  <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-sm text-slate-700">
                    <div className="text-xs text-slate-500 mb-1">Customer Inquiry Message:</div>
                    {inq.message}
                  </div>

                  {inq.status !== 'closed' ? (
                    <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                      <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Direct Seller Quote & Availability Reply
                        </label>
                        <input
                          type="text"
                          value={
                            replyDrafts[inq.id] !== undefined
                              ? replyDrafts[inq.id]
                              : inq.sellerReply
                          }
                          onChange={(e) =>
                            setReplyDrafts((prev) => ({ ...prev, [inq.id]: e.target.value }))
                          }
                          placeholder="Provide official quote, dispatch lead time, or schedule site inspection..."
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-slate-900"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          disabled={updatingInquiryId === inq.id}
                          onClick={() => handleSellerReplyInquiry(inq, 'responded')}
                          className="px-4 py-2 text-xs font-semibold text-white bg-[#0F172A] rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Send Seller Reply
                        </button>
                        <button
                          type="button"
                          disabled={updatingInquiryId === inq.id}
                          onClick={() => handleSellerReplyInquiry(inq, 'closed')}
                          className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 whitespace-nowrap"
                        >
                          Close Thread
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">
                      Final Seller Response: {inq.sellerReply || 'Thread closed without additional notes.'} (Terminal state locked)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
