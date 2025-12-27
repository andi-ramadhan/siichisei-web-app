import { useState, useEffect, useCallback } from 'react';

/**
 * Hook to monitor network status and trigger reconnection
 */
export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (wasOffline) {
        setWasOffline(false);
        // Trigger reconnection event
        window.dispatchEvent(new CustomEvent('network-reconnect'));
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [wasOffline]);

  return { isOnline, wasOffline };
}

/**
 * Hook to auto-retry a function when network reconnects
 */
export function useAutoRetry(retryFn, dependencies = []) {
  const memoizedRetry = useCallback(retryFn, dependencies);

  useEffect(() => {
    const handleReconnect = () => {
      console.log('Network reconnected, triggering retry...');
      memoizedRetry();
    };

    window.addEventListener('network-reconnect', handleReconnect);
    return () => window.removeEventListener('network-reconnect', handleReconnect);
  }, [memoizedRetry]);
}
