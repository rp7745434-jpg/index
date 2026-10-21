/**
 * Phase 0: Security Rules Test Specification (Dirty Dozen Verification)
 * Verifies that all 12 adversarial payloads defined in security_spec.md return PERMISSION_DENIED.
 */

export interface AdversarialTestCase {
  id: number;
  name: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  path: string;
  auth: {
    uid: string;
    email: string;
    email_verified: boolean;
  } | null;
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_TEST_SUITE: AdversarialTestCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Seller Registration',
    operation: 'create',
    path: '/sellers/victim_1',
    auth: { uid: 'attacker_1', email: 'attacker@example.com', email_verified: true },
    payload: { ownerId: 'victim_1', businessName: 'Spoofed Corp' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Shadow Field Injection on Listing',
    operation: 'create',
    path: '/listings/item_1',
    auth: { uid: 'seller_1', email: 'seller1@example.com', email_verified: true },
    payload: { sellerId: 'seller_1', featuredBoost: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Unverified Email Admin Spoof',
    operation: 'delete',
    path: '/listings/item_1',
    auth: { uid: 'spoof_admin', email: 'rp7745434@gmail.com', email_verified: false },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'PII Cross-Tenant Read on seller_private',
    operation: 'get',
    path: '/seller_private/seller_1',
    auth: { uid: 'buyer_2', email: 'buyer2@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'PII Collection List Scraping on seller_private',
    operation: 'list',
    path: '/seller_private',
    auth: { uid: 'seller_1', email: 'seller1@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Orphaned Listing Creation Without Seller Profile',
    operation: 'create',
    path: '/listings/item_99',
    auth: { uid: 'ghost_seller', email: 'ghost@example.com', email_verified: true },
    payload: { sellerId: 'ghost_seller', title: 'Unbacked Product' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Orphaned Seller Private Creation Without Atomic Public Profile',
    operation: 'create',
    path: '/seller_private/new_seller',
    auth: { uid: 'new_seller', email: 'new@example.com', email_verified: true },
    payload: { ownerId: 'new_seller', taxIdFull: '27AAACV1234F1Z5' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Terminal State Unlocking on Closed Inquiry',
    operation: 'update',
    path: '/inquiries/inq_closed_1',
    auth: { uid: 'seller_1', email: 'seller1@example.com', email_verified: true },
    payload: { sellerReply: 'Trying to reopen closed inquiry', status: 'responded' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Tier Violation - Buyer Modifying Seller Reply',
    operation: 'update',
    path: '/inquiries/inq_open_1',
    auth: { uid: 'buyer_1', email: 'buyer1@example.com', email_verified: true },
    payload: { sellerReply: 'Forged seller quote' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Resource Poisoning - Oversized Description String',
    operation: 'update',
    path: '/listings/item_1',
    auth: { uid: 'seller_1', email: 'seller1@example.com', email_verified: true },
    payload: { description: 'X'.repeat(5000) },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Timestamp Forgery / Backdating on Inquiry Creation',
    operation: 'create',
    path: '/inquiries/inq_2',
    auth: { uid: 'buyer_1', email: 'buyer1@example.com', email_verified: true },
    payload: { buyerId: 'buyer_1', createdAt: '2020-01-01T00:00:00Z' },
    expectedOutcome: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Unauthorized Inquiry List Scraping by Non-Participant',
    operation: 'list',
    path: '/inquiries',
    auth: { uid: 'snooper_9', email: 'snooper@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
  },
];
