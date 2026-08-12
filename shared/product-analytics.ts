export const PRODUCT_ANALYTICS_POLICY_VERSION = "eos-product-analytics-consent.v1";

export const productEvents = {
  pageViewed: "eos_page_viewed",
  userSignedIn: "eos_user_signed_in",
  supportRequested: "eos_support_requested",
  legalAccepted: "eos_legal_accepted",
  workPacketCompleted: "eos_work_packet_completed",
} as const;
