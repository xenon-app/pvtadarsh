import { useEffect, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, Loader2 } from 'lucide-react';
import { cn } from '../lib/utils';

export default function KitchenDashboard() {
  const { socket } = useSocket();
  const { token, restaurantId } = useAuth();
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    fetch('/api/staff/orders', {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.json())
    .then(data => {
      // Filter out paid/completed orders if needed, but backend already does some filtering
      setOrders(data.filter((o: any) => o.status !== 'paid' && o.status !== 'completed'));
    });
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

    return () => {
      socket.off('new_order');
      socket.off('order_updated');
    };
  }, [socket, restaurantId]);

  const updateStatus = async (orderId: number, status: string) => {
    await fetch('/api/staff/order/status', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
      body: JSON.stringify({ orderId, status }),
    });
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Kitchen Display System</h1>
        <div className="flex gap-4">
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
            <span className="text-sm font-medium">Pending: {orders.filter(o => o.status === 'pending').length}</span>
          </div>
          <div className="bg-white px-4 py-2 rounded-lg shadow-sm flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-400"></div>
            <span className="text-sm font-medium">Prep: {orders.filter(o => o.status === 'preparing').length}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {orders.map(order => (
          <motion.div 
            key={order.id}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-200 flex flex-col"
          >
            <div className={cn("p-4 border-b flex justify-between items-center", getStatusColor(order.status))}>
              <h3 className="font-bold text-lg">Table {order.table_name}</h3>
              <span className="text-xs font-mono bg-white/50 px-2 py-1 rounded">
                #{order.id}
              </span>
            </div>
            
            <div className="p-4 flex-1">
              <div className="space-y-3">
                {order.items.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-center">
                    <span className="font-medium text-slate-700">{item.quantity} x {item.name_at_time}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(order.created_at).toLocaleTimeString()}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-100 grid grid-cols-2 gap-2">
              {order.status === 'pending' && (
                <button 
                  onClick={() => updateStatus(order.id, 'preparing')}
                  className="col-span-2 bg-blue-600 text-white py-2 rounded-lg font-medium hover:bg-blue-700 flex items-center justify-center gap-2"
                >
                  <Loader2 className="w-4 h-4 animate-spin" /> Start Prep
                </button>
              )}
              {order.status === 'preparing' && (
                <button 
                  onClick={() => updateStatus(order.id, 'ready')}
                  className="col-span-2 bg-green-600 text-white py-2 rounded-lg font-medium hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" /> Mark Ready
                </button>
              )}
              {order.status === 'ready' && (
                <div className="col-span-2 text-center text-green-600 font-bold py-2 bg-green-50 rounded-lg border border-green-100">
                  Ready to Serve
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
