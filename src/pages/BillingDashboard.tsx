import React, { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, Printer, Trash2, X, Banknote, QrCode } from 'lucide-react';
import QRCode from 'qrcode';

export default function BillingDashboard() {
  const { socket } = useSocket();
  const { token, restaurantId } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'online' | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [printOrder, setPrintOrder] = useState<any>(null);

  useEffect(() => {
    if (printOrder) {
      // Small delay to ensure DOM is updated
      setTimeout(() => {
        window.print();
        setPrintOrder(null);
      }, 500);
    }
  }, [printOrder]);

  // Simulate automatic payment detection for online payments
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (paymentMethod === 'online' && selectedOrder) {
      // Simulate waiting for bank webhook
      timer = setTimeout(() => {
        // Auto-confirm payment
        markPaid(selectedOrder.id);
      }, 8000); // 8 seconds delay to simulate user scanning and paying
    }
    return () => clearTimeout(timer);
  }, [paymentMethod, selectedOrder]);

  useEffect(() => {
    fetch('/api/staff/orders', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => setOrders(data));
  }, [token]);

  useEffect(() => {
    if (!socket || !restaurantId) return;

    socket.emit('join_restaurant', restaurantId);

    socket.on('new_order', (order) => {
      setOrders(prev => [order, ...prev]);
    });

    socket.on('order_updated', (updatedOrder) => {
      setOrders(prev => prev.map(o => o.id === updatedOrder.id ? updatedOrder : o));
    });

    socket.on('order_paid', ({ orderId }) => {
      setOrders(prev => prev.filter(o => o.id !== orderId));
    });

    socket.on('system_reset', () => {
      setOrders([]);
      setSelectedOrder(null);
      setShowPaymentModal(false);
      setPaymentMethod(null);
    });

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
      socket.off('order_paid');
      socket.off('system_reset');
    };
  }, [socket, restaurantId]);

  const initiatePayment = (order: any) => {
    setSelectedOrder(order);
    setPaymentMethod(null);
    setQrCodeUrl('');
    setShowPaymentModal(true);
  };

  const handlePaymentMethodSelect = async (method: 'cash' | 'online') => {
    setPaymentMethod(method);
    if (method === 'online') {
      // Generate UPI QR Code
      // Format: upi://pay?pa=MOBILE_NUMBER&pn=NAME&am=AMOUNT&tr=REF_ID&tn=NOTE
      
      const payeeName = "Adarsh PVT";
      const mobileNumber = "9534722845"; 
      
      const vpa = `${mobileNumber}@upi`; 
      const amount = selectedOrder.total_amount;
      const note = `${selectedOrder.customer_nickname || 'Customer'} - ${selectedOrder.items.map((i:any) => i.name_at_time).join(', ')}`.substring(0, 50); 
      
      const upiString = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tn=${encodeURIComponent(note)}`;
      
      try {
        const url = await QRCode.toDataURL(upiString, { width: 300, margin: 2 });
        setQrCodeUrl(url);
      } catch (err) {
        console.error(err);
        alert('Failed to generate QR code');
      }
    }
  };

  const markPaid = async (orderId: number) => {
    // Set order for printing BEFORE removing it from the list (optimistic UI might remove it)
    // We need the full order details for printing. 
    // If selectedOrder is the one being paid, use it.
    const orderToPrint = orders.find(o => o.id === orderId) || selectedOrder;
    setPrintOrder(orderToPrint);

    await fetch('/api/staff/order/pay', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ orderId }),
    });
    setShowPaymentModal(false);
    setPaymentMethod(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 print:p-0 print:bg-white">
      <div className="print:hidden">
        <h1 className="text-3xl font-bold text-slate-800 mb-8">Billing & Counter</h1>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-600">Table</th>
                <th className="p-4 font-semibold text-slate-600">Customer</th>
                <th className="p-4 font-semibold text-slate-600">Items</th>
                <th className="p-4 font-semibold text-slate-600">Status</th>
                <th className="p-4 font-semibold text-slate-600">Total</th>
                <th className="p-4 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map(order => (
                <tr key={order.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">{order.table_name}</td>
                  <td className="p-4 text-slate-600">{order.customer_nickname || '-'}</td>
                  <td className="p-4 text-slate-600 text-sm max-w-xs">
                    {order.items.map((i: any) => `${i.quantity}x ${i.name_at_time}`).join(', ')}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium uppercase ${
                      order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {order.status}
                    </span>
                  </td>
                  <td className="p-4 font-bold text-slate-900">₹{order.total_amount}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button 
                        onClick={() => initiatePayment(order)}
                        className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-1"
                      >
                        <IndianRupee className="w-4 h-4" /> Pay
                      </button>
                      <button 
                        onClick={() => {
                          setPrintOrder(order);
                        }}
                        className="text-slate-400 hover:text-slate-600 p-1.5"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <div className="p-12 text-center text-slate-400">
              No active orders
            </div>
          )}
        </div>
      </div>

      {/* Printable Receipt - Only visible when printing */}
      {printOrder && (
        <div className="hidden print:block p-8 max-w-sm mx-auto">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-1">Adarsh PVT.</h1>
            <p className="text-sm text-gray-500">Bangalore, India</p>
            <p className="text-sm text-gray-500">Ph: 9534722845</p>
          </div>
          
          <div className="border-b border-dashed border-gray-300 mb-4 pb-4">
            <div className="flex justify-between text-sm mb-1">
              <span>Date:</span>
              <span>{new Date().toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>Time:</span>
              <span>{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Order #:</span>
              <span>{printOrder.id}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Table:</span>
              <span>{printOrder.table_name}</span>
            </div>
          </div>

          <div className="mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-1">Item</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Price</th>
                </tr>
              </thead>
              <tbody>
                {printOrder.items.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-1">{item.name_at_time}</td>
                    <td className="text-center py-1">{item.quantity}</td>
                    <td className="text-right py-1">₹{item.price_at_time * item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="border-t border-dashed border-gray-300 pt-4 mb-8">
            <div className="flex justify-between font-bold text-lg">
              <span>TOTAL</span>
              <span>₹{printOrder.total_amount}</span>
            </div>
            <div className="text-center text-xs text-gray-400 mt-4">
              Thank you for dining with us!
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <AnimatePresence>
        {showPaymentModal && selectedOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-lg text-slate-800">Payment for Table {selectedOrder.table_name}</h3>
                <button onClick={() => setShowPaymentModal(false)} className="text-slate-400 hover:text-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6">
                <div className="text-center mb-8">
                  <p className="text-slate-500 text-sm mb-1">Total Amount</p>
                  <p className="text-4xl font-bold text-slate-900">₹{selectedOrder.total_amount}</p>
                </div>

                {!paymentMethod ? (
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => handlePaymentMethodSelect('cash')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-green-500 hover:bg-green-50 transition-all group"
                    >
                      <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600 group-hover:bg-green-200">
                        <Banknote className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-green-700">Cash</span>
                    </button>

                    <button 
                      onClick={() => handlePaymentMethodSelect('online')}
                      className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-slate-100 hover:border-blue-500 hover:bg-blue-50 transition-all group"
                    >
                      <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 group-hover:bg-blue-200">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <span className="font-bold text-slate-700 group-hover:text-blue-700">Online / UPI</span>
                    </button>
                  </div>
                ) : paymentMethod === 'cash' ? (
                  <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
                      <Banknote className="w-10 h-10" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-800 mb-2">Cash Payment</h4>
                    <p className="text-slate-500 mb-8">Please collect <span className="font-bold text-slate-900">₹{selectedOrder.total_amount}</span> from the customer.</p>
                    
                    <button 
                      onClick={() => markPaid(selectedOrder.id)}
                      className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" /> Confirm & Print Bill
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod(null)}
                      className="mt-3 text-slate-500 text-sm hover:text-slate-700"
                    >
                      Back to methods
                    </button>
                  </div>
                ) : paymentMethod === 'online' ? (
                  <div className="text-center">
                    <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block mb-4 shadow-sm relative">
                      {qrCodeUrl ? (
                        <img src={qrCodeUrl} alt="Payment QR" className="w-48 h-48" />
                      ) : (
                        <div className="w-48 h-48 flex items-center justify-center text-slate-400">Generating QR...</div>
                      )}
                      
                      {/* Simulation Indicator */}
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-white/80 flex flex-col items-center justify-center backdrop-blur-sm"
                      >
                        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                        <p className="text-sm font-medium text-blue-800">Waiting for payment...</p>
                        <p className="text-xs text-blue-600 mt-1">(Simulating success in 8s)</p>
                      </motion.div>
                    </div>
                    <p className="text-sm text-slate-500 mb-6">Scan with any UPI app to pay</p>
                    
                    <button 
                      onClick={() => markPaid(selectedOrder.id)}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <CheckCircle className="w-5 h-5" /> Payment Received
                    </button>
                    
                    <button 
                      onClick={() => setPaymentMethod(null)}
                      className="mt-3 text-slate-500 text-sm hover:text-slate-700"
                    >
                      Back to methods
                    </button>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for icon
function CheckCircle({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
