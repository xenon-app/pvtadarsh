import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import QRCode from 'qrcode';
import { Download, Edit, Plus, Tag, ToggleLeft, ToggleRight, Trash2, AlertTriangle } from 'lucide-react';

export default function AdminDashboard() {
  const { token, restaurantId } = useAuth();
  const { socket } = useSocket();
  const [tables, setTables] = useState<any[]>([]);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [discounts, setDiscounts] = useState<any[]>([]);
  const [stats, setStats] = useState({ activeOrders: 0, todaySales: 0 });
  const [newDiscountCode, setNewDiscountCode] = useState('');
  const [newDiscountPercent, setNewDiscountPercent] = useState('');
  const [activeTab, setActiveTab] = useState<'tables' | 'menu' | 'discounts'>('tables');

  const fetchStats = () => {
    fetch('/api/admin/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.json())
      .then(data => setStats(data));
  };

  useEffect(() => {
    fetchStats();
    
    if (activeTab === 'tables') {
      fetch('/api/staff/tables', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setTables(data));
    } else if (activeTab === 'menu') {
      fetch('/api/admin/menu', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setMenuItems(data));
    } else if (activeTab === 'discounts') {
      fetch('/api/admin/discounts', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setDiscounts(data));
    }
  }, [token, activeTab]);

  useEffect(() => {
    if (!socket || !restaurantId) return;

    socket.emit('join_restaurant', restaurantId);

    const handleUpdate = () => {
      fetchStats();
      // Also refresh tables if on tables tab
      if (activeTab === 'tables') {
        fetch('/api/staff/tables', { headers: { Authorization: `Bearer ${token}` } })
          .then(res => res.json())
          .then(data => setTables(data));
      }
    };

    socket.on('new_order', handleUpdate);
    socket.on('order_updated', handleUpdate);
    socket.on('order_paid', handleUpdate);

    return () => {
      socket.off('new_order', handleUpdate);
      socket.off('order_updated', handleUpdate);
      socket.off('order_paid', handleUpdate);
    };
  }, [socket, restaurantId, token, activeTab]);

  const createDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDiscountCode || !newDiscountPercent) return;

    const res = await fetch('/api/admin/discount', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: newDiscountCode, percentage: Number(newDiscountPercent) }),
    });

    if (res.ok) {
      setNewDiscountCode('');
      setNewDiscountPercent('');
      // Refresh list
      fetch('/api/admin/discounts', { headers: { Authorization: `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => setDiscounts(data));
    }
  };

  const downloadQR = async (table: any) => {
    const url = `${window.location.origin}/table/${table.restaurant_id}/${table.id}`;
    const qrDataUrl = await QRCode.toDataURL(url, { width: 300 });
    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = `QR-Table-${table.name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const toggleItemAvailability = async (itemId: number, currentStatus: number) => {
    await fetch('/api/admin/menu/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ itemId, isAvailable: !currentStatus }),
    });
    setMenuItems(prev => prev.map(i => i.id === itemId ? { ...i, is_available: !currentStatus } : i));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-slate-800">Admin Dashboard</h1>
        <div className="flex bg-white rounded-lg p-1 shadow-sm border border-slate-200">
          <button 
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tables' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Tables
          </button>
          <button 
            onClick={() => setActiveTab('menu')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'menu' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Menu
          </button>
          <button 
            onClick={() => setActiveTab('discounts')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'discounts' ? 'bg-indigo-100 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            Discounts
          </button>
        </div>
      </div>

      {activeTab === 'tables' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-full md:col-span-2">
            <h2 className="text-xl font-bold mb-4">Table QR Codes</h2>
            <div className="space-y-4">
              {tables.map(table => (
                <div key={table.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <div>
                    <p className="font-semibold text-slate-800">{table.name}</p>
                    <p className="text-xs text-slate-500 uppercase">{table.status}</p>
                  </div>
                  <button 
                    onClick={() => downloadQR(table)}
                    className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-lg transition-colors"
                    title="Download QR"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-xl font-bold mb-4">Quick Stats</h2>
            <div className="grid grid-cols-1 gap-4">
              <div className="bg-indigo-50 p-4 rounded-lg">
                <p className="text-indigo-600 text-sm font-medium">Today's Sales</p>
                <p className="text-2xl font-bold text-indigo-900">₹{stats.todaySales.toLocaleString()}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-600 text-sm font-medium">Active Orders</p>
                <p className="text-2xl font-bold text-green-900">{stats.activeOrders}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'menu' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold">Menu Items</h2>
            <button className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="p-4 font-semibold text-slate-600">Name</th>
                <th className="p-4 font-semibold text-slate-600">Category</th>
                <th className="p-4 font-semibold text-slate-600">Price</th>
                <th className="p-4 font-semibold text-slate-600">Status</th>
                <th className="p-4 font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {menuItems.map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="p-4 font-medium text-slate-900">{item.name}</td>
                  <td className="p-4 text-slate-600">{item.category_name}</td>
                  <td className="p-4 font-bold text-slate-900">₹{item.price}</td>
                  <td className="p-4">
                    <button 
                      onClick={() => toggleItemAvailability(item.id, item.is_available)}
                      className={`flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {item.is_available ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                      {item.is_available ? 'Available' : 'Unavailable'}
                    </button>
                  </td>
                  <td className="p-4">
                    <button className="text-slate-400 hover:text-indigo-600 p-1">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'discounts' && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-xl font-bold mb-6">Discount Codes</h2>
          
          <form onSubmit={createDiscount} className="flex gap-4 mb-8 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">Code</label>
              <input
                type="text"
                value={newDiscountCode}
                onChange={(e) => setNewDiscountCode(e.target.value.toUpperCase())}
                placeholder="SUMMER20"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-slate-700 mb-1">Percentage</label>
              <input
                type="number"
                value={newDiscountPercent}
                onChange={(e) => setNewDiscountPercent(e.target.value)}
                placeholder="20"
                min="1"
                max="100"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button 
              type="submit"
              className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-indigo-700 mb-[1px]"
            >
              Create
            </button>
          </form>

          <div className="space-y-3">
            {discounts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Tag className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                No active discounts
              </div>
            ) : (
              discounts.map(discount => (
                <div key={discount.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-lg">
                      <Tag className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{discount.code}</p>
                      <p className="text-sm text-slate-500">{discount.percentage}% Off</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${discount.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {discount.is_active ? 'ACTIVE' : 'INACTIVE'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
