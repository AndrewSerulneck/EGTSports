// Stripe Payment Service
// This handles payment intent creation and verification

const STRIPE_PUBLISHABLE_KEY = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || 'pk_test_51SOnukKKQiytwUlORKHAqMJZJekMJreoMlAbqvps0n7eIvRuQT07UYCRyFu1GREjWgoigCB6kqPDAMnxB3CoFG2Y00awbsXNcV';
const STRIPE_API_ENDPOINT = process.env.REACT_APP_STRIPE_API_ENDPOINT || 'https://api.egtsports.ws/api/stripe';

/**
 * Create a payment intent for guest users
 * This creates a pending payment record that will be verified via webhook
 */
export const createPaymentIntent = async (ticketNumber, amount, contactInfo, paymentMethod) => {
  try {
    console.log('🔄 Creating payment intent for ticket:', ticketNumber);
    
    const response = await fetch(`${STRIPE_API_ENDPOINT}/create-payment-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketNumber,
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        contactInfo,
        paymentMethod, // 'venmo' or 'zelle'
        metadata: {
          ticketNumber,
          email: contactInfo.email,
          name: contactInfo.name,
          paymentMethod
        }
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to create payment intent');
    }

    const data = await response.json();
    console.log('✅ Payment intent created:', data.paymentIntentId);
    
    return {
      success: true,
      paymentIntentId: data.paymentIntentId,
      clientSecret: data.clientSecret,
      status: data.status
    };
  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Check payment status for a ticket
 * Used to verify if a guest payment has been confirmed
 */
export const checkPaymentStatus = async (ticketNumber) => {
  try {
    console.log('🔍 Checking payment status for ticket:', ticketNumber);
    
    const response = await fetch(`${STRIPE_API_ENDPOINT}/check-payment-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ticketNumber })
    });

    if (!response.ok) {
      throw new Error('Failed to check payment status');
    }

    const data = await response.json();
    
    return {
      success: true,
      isPaid: data.status === 'succeeded' || data.status === 'verified',
      status: data.status,
      amount: data.amount,
      paidAt: data.paidAt
    };
  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    return {
      success: false,
      isPaid: false,
      error: error.message
    };
  }
};

/**
 * Mark a payment as manually verified (admin action)
 * Used when admin confirms Venmo/Zelle payment manually
 */
export const markPaymentVerified = async (ticketNumber, adminId) => {
  try {
    console.log('✅ Marking payment as verified for ticket:', ticketNumber);
    
    const response = await fetch(`${STRIPE_API_ENDPOINT}/verify-payment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ticketNumber,
        verifiedBy: adminId,
        verifiedAt: new Date().toISOString()
      })
    });

    if (!response.ok) {
      throw new Error('Failed to verify payment');
    }

    const data = await response.json();
    
    return {
      success: true,
      status: data.status
    };
  } catch (error) {
    console.error('❌ Error verifying payment:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get pending payments for admin review
 */
export const getPendingPayments = async () => {
  try {
    const response = await fetch(`${STRIPE_API_ENDPOINT}/pending-payments`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch pending payments');
    }

    const data = await response.json();
    
    return {
      success: true,
      payments: data.payments || []
    };
  } catch (error) {
    console.error('❌ Error fetching pending payments:', error);
    return {
      success: false,
      payments: [],
      error: error.message
    };
  }
};

export default {
  createPaymentIntent,
  checkPaymentStatus,
  markPaymentVerified,
  getPendingPayments
};