# VeroMarket Security Specification (Phase 0 TDD)

## 1. Data Invariants & Relational Mapping

1. **Global Default Deny**: Any path not explicitly matched in `firestore.rules` is unconditionally denied (`allow read, write: if false;`).
2. **Verified Identity Gate**: Every write operation (`create`, `update`, `delete`) across all collections requires `request.auth != null && request.auth.token.email_verified == true`.
3. **PII Split-Collection Isolation (`sellers` vs `seller_private`)**:
   - Public storefront metadata (`businessName`, `city`, `district`, `lat`, `lng`, `gstinMasked`, `isVerified`) lives in `/sellers/{sellerId}`.
   - Sensitive KYC and direct contact data (`taxIdFull`, `tradeLicenseNumber`, `registeredStreet`, `contactPhone`, `contactEmail`) is isolated in `/seller_private/{sellerId}`.
   - `/seller_private/{sellerId}` is strictly readable (`get`) ONLY by the owner (`request.auth.uid == sellerId`) or a verified admin (`isAdmin()`). `list` on `/seller_private` is unconditionally denied (`allow list: if false;`).
   - Creating `/seller_private/{sellerId}` requires atomic co-existence of `/sellers/{sellerId}` via `existsAfter(/databases/$(database)/documents/sellers/$(sellerId))`.
4. **Master Gate for Listings (`/listings/{listingId}`)**:
   - A listing can only be created if its `sellerId == request.auth.uid`, the parent seller profile `/sellers/$(incoming().sellerId)` exists (`exists(...)`), and `get(/databases/$(database)/documents/sellers/$(incoming().sellerId)).data.ownerId == request.auth.uid`.
   - Terminal State Lock: Once a listing's `status == 'archived'`, no subsequent updates are permitted unless `isAdmin()`.
5. **Master Gate for Inquiries (`/inquiries/{inquiryId}`)**:
   - An inquiry can only be created by a verified buyer (`incoming().buyerId == request.auth.uid`) referencing an existing listing (`exists(/databases/$(database)/documents/listings/$(incoming().listingId))`) and an existing seller (`exists(/databases/$(database)/documents/sellers/$(incoming().sellerId))`).
   - Inquiries are readable (`get`, `list`) strictly by the participating `buyerId` or `sellerId` (or `isAdmin()` on `get`).
   - Tiered Action-Based Updates on Inquiries:
     - **Tier 1 (Seller Reply Action)**: Only `existing().sellerId == request.auth.uid` can update `['sellerReply', 'status', 'updatedAt']`.
     - **Tier 2 (Buyer Close/Update Action)**: Only `existing().buyerId == request.auth.uid` can update `['message', 'requestedQty', 'targetPrice', 'status', 'updatedAt']`.
   - Terminal State Lock: Once an inquiry's `status == 'closed'`, no subsequent updates are permitted unless `isAdmin()`.
6. **Temporal Integrity**: All `createdAt` and `updatedAt` fields must equal `request.time`. On updates, `createdAt` must equal `existing().createdAt`.

---

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Payload 1 (Identity Spoofing on Seller Registration)**: Authenticated user `uid: "attacker_1"` attempts to create `/sellers/victim_1` with `ownerId: "victim_1"`. -> `PERMISSION_DENIED`
2. **Payload 2 (Shadow Field Injection on Listing)**: Verified seller attempts to create `/listings/item_1` with an extra unapproved field `"featuredBoost": true`. -> `PERMISSION_DENIED`
3. **Payload 3 (Unverified Email Admin Spoof)**: User with `email: "rp7745434@gmail.com"` but `email_verified: false` attempts to delete `/listings/item_1`. -> `PERMISSION_DENIED`
4. **Payload 4 (PII Cross-Tenant Read)**: Authenticated user `uid: "buyer_2"` attempts `get` on `/seller_private/seller_1`. -> `PERMISSION_DENIED`
5. **Payload 5 (PII Collection Scraping)**: Authenticated user `uid: "seller_1"` attempts a `list` query on `/seller_private`. -> `PERMISSION_DENIED`
6. **Payload 6 (Orphaned Listing Creation)**: Verified user `uid: "ghost_seller"` (who has no document in `/sellers/ghost_seller`) attempts to create `/listings/item_99`. -> `PERMISSION_DENIED`
7. **Payload 7 (Orphaned Seller Private Creation without Atomic Public Profile)**: Verified user `uid: "new_seller"` writes `/seller_private/new_seller` alone without `/sellers/new_seller` existing after the batch. -> `PERMISSION_DENIED`
8. **Payload 8 (Terminal State Unlocking on Closed Inquiry)**: Seller `uid: "seller_1"` attempts to update `sellerReply` on `/inquiries/inq_1` when `existing().status == "closed"`. -> `PERMISSION_DENIED`
9. **Payload 9 (Tier Violation — Buyer Modifying Seller Reply)**: Buyer `uid: "buyer_1"` attempts to update `sellerReply` on `/inquiries/inq_1`. -> `PERMISSION_DENIED`
10. **Payload 10 (Resource Poisoning / Oversized String)**: Seller attempts to update `description` on `/listings/item_1` with a 5,000-character string (exceeding `maxLength: 800`). -> `PERMISSION_DENIED`
11. **Payload 11 (Timestamp Forgery / Backdating)**: Buyer attempts to create `/inquiries/inq_2` with a client-forged past timestamp (`createdAt != request.time`). -> `PERMISSION_DENIED`
12. **Payload 12 (Unbounded / Unauthorized Inquiry List Scraping)**: User `uid: "snooper_9"` executes an unconstrained `list` query on `/inquiries` without filtering for their own `buyerId` or `sellerId`. -> `PERMISSION_DENIED`
