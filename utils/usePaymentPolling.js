/**
 * usePaymentPolling - React Hook for automatic QR payment confirmation
 * 
 * This hook implements polling-based payment verification using SePay backend API.
 * It checks payment status every 3 seconds until payment is confirmed or expires.
 * 
 * Usage in React Component:
 * 
 * import usePaymentPolling from '../utils/usePaymentPolling';
 * 
 * function PaymentPage({ paymentId }) {
 *   const { status, isPolling, stopPolling } = usePaymentPolling(paymentId);
 * 
 *   useEffect(() => {
 *     if (status === 'PAID') {
 *       // Show success toast
 *       // Redirect to order success page
 *     } else if (status === 'EXPIRED') {
 *       // Show expired modal
 *       // Allow user to regenerate QR
 *     }
 *   }, [status]);
 * 
 *   return (
 *     <div>
 *       {isPolling && <div>Checking payment...</div>}
 *     </div>
 *   );
 * }
 */

import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook for polling payment status via SePay backend API
 * 
 * @param {string} paymentId - The payment ID to check
 * @param {number} pollInterval - Poll interval in milliseconds (default: 3000ms)
 * @returns {Object} { status, isPolling, error, stopPolling, startPolling }
 */
export const usePaymentPolling = (paymentId, pollInterval = 3000) => {
  const [status, setStatus] = useState('PENDING');
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState(null);
  const pollTimeoutRef = useRef(null);

  const checkPaymentStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/payments/${paymentId}/check`, {
        method: 'GET',
        credentials: 'include', // Include auth cookies
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setStatus('NOT_FOUND');
          setIsPolling(false);
          return;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.status) {
        // Status can be: PENDING, PAID, EXPIRED, NOT_FOUND
        setStatus(data.status);

        // Stop polling if payment is confirmed or expired
        if (data.status === 'PAID' || data.status === 'EXPIRED') {
          setIsPolling(false);
          return; // Exit polling loop
        }
      }

      // Continue polling for PENDING status
      if (isPolling) {
        pollTimeoutRef.current = setTimeout(checkPaymentStatus, pollInterval);
      }
    } catch (err) {
      console.error('[Payment Polling] Error:', err);
      setError(err.message);

      // Retry on error (continue polling)
      if (isPolling) {
        pollTimeoutRef.current = setTimeout(checkPaymentStatus, pollInterval);
      }
    }
  }, [paymentId, pollInterval, isPolling]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    setIsPolling(true);
    setStatus('PENDING');
    setError(null);
    checkPaymentStatus();
  }, [checkPaymentStatus]);

  // Start polling on mount
  useEffect(() => {
    if (isPolling) {
      checkPaymentStatus();
    }

    // Cleanup on unmount
    return () => {
      if (pollTimeoutRef.current) {
        clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []); // Only run on mount/unmount

  return {
    status,        // 'PENDING' | 'PAID' | 'EXPIRED' | 'NOT_FOUND'
    isPolling,     // Boolean - whether polling is active
    error,         // Error message if any
    stopPolling,   // Function to stop polling
    startPolling   // Function to restart polling
  };
};

export default usePaymentPolling;
