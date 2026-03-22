import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socketInstance = null;

export function getSocket() {
  if (!socketInstance) {
    socketInstance = io('/', {
      withCredentials: true,
      auth: { token: document.cookie.split(';').find(c => c.trim().startsWith('token='))?.split('=')[1] }
    });
  }
  return socketInstance;
}

export function useRfqSocket(rfqId, { onBidsUpdated, onRfqUpdated, onAuctionEnded } = {}) {
  const socket = getSocket();

  useEffect(() => {
    if (!rfqId) return;
    socket.emit('join_rfq', rfqId);

    if (onBidsUpdated) socket.on('bids_updated', onBidsUpdated);
    if (onRfqUpdated) socket.on('rfq_updated', onRfqUpdated);
    if (onAuctionEnded) socket.on('auction_ended', onAuctionEnded);

    return () => {
      socket.emit('leave_rfq', rfqId);
      if (onBidsUpdated) socket.off('bids_updated', onBidsUpdated);
      if (onRfqUpdated) socket.off('rfq_updated', onRfqUpdated);
      if (onAuctionEnded) socket.off('auction_ended', onAuctionEnded);
    };
  }, [rfqId]);
}
