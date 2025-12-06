import { http } from "./http";

interface CheckoutSessionResponse {
  isFree?: boolean;
  alreadyOwned?: boolean;
  url?: string | null;
}

export async function createClassCheckoutSession(
  classId: string,
): Promise<CheckoutSessionResponse> {
  try {
    const res = await http.post(`/stripe/classes/${classId}/checkout-session`);
    // Backend wraps response in { status, message, data, statusCode }
    // Extract the actual data from res.data.data, fallback to res.data for compatibility
    return res.data?.data || res.data;
  } catch (error: any) {
    // Log the full error for debugging
    console.error("Error creating checkout session:", error);
    // Re-throw with more context
    if (error.response) {
      // Server responded with error status
      throw new Error(
        error.response.data?.message || 
        `Server error: ${error.response.status} - ${error.response.statusText}`
      );
    } else if (error.request) {
      // Request was made but no response received
      throw new Error("No response from server. Please check your connection.");
    } else {
      // Something else happened
      throw new Error(error.message || "Failed to create checkout session");
    }
  }
}

interface VerifyEnrollmentResponse {
  success: boolean;
  alreadyEnrolled?: boolean;
}

export async function verifyAndCompleteEnrollment(
  classId: string,
  sessionId: string,
): Promise<VerifyEnrollmentResponse> {
  try {
    const res = await http.post(`/stripe/classes/${classId}/verify-enrollment`, {
      sessionId,
    });
    // Backend wraps response in { status, message, data, statusCode }
    return res.data?.data || res.data;
  } catch (error: any) {
    console.error("Error verifying enrollment:", error);
    if (error.response) {
      throw new Error(
        error.response.data?.message || 
        `Server error: ${error.response.status} - ${error.response.statusText}`
      );
    } else if (error.request) {
      throw new Error("No response from server. Please check your connection.");
    } else {
      throw new Error(error.message || "Failed to verify enrollment");
    }
  }
}


