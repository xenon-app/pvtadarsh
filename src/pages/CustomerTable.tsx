import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ShoppingBag, Minus, Plus, ChevronRight, UtensilsCrossed, Check } from 'lucide-react';
import { cn } from '../lib/utils';

interface MenuItem {
  id: number;
  name: string;
  price: number;
  description: string;
  category_id: number;
}

interface Category {
  id: number;
  name: string;
  items: MenuItem[];
}

interface CartItem extends MenuItem {
  quantity: number;
}

export default function CustomerTable() {
  const { tableId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [restaurant, setRestaurant] = useState<any>(null);
  const [menu, setMenu] = useState<Category[]>([]);
  const [cart, setCart] = useState<CartItem[]>(() => {
    const saved = localStorage.getItem('cart');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);
  const [activeCategory, setActiveCategory] = useState<number>(0);
  const [nickname, setNickname] = useState('');
  const [locationVerified, setLocationVerified] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Fetch Table & Restaurant Info
  useEffect(() => {
    fetch(`/api/public/table/${tableId}`)
      .then(res => res.ok ? res.json() : Promise.reject('Invalid Table'))
      .then(data => {
        setRestaurant(data);
        // In real app, we would verify location here using navigator.geolocation
        // For demo, we'll simulate a check
        checkLocation(data);
        return fetch(`/api/public/menu/${data.restaurant_id}`);
      })
      .then(res => res.json())
      .then(data => {
        setMenu(data);
        if (data.length > 0) setActiveCategory(data[0].id);
        setLoading(false);
      })
      .catch(err => {
        setError(err.toString());
        setLoading(false);
      });
  }, [tableId]);

  const checkLocation = (restData: any) => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
            // Simple distance check (mocked for now as we can't easily test real GPS in this env)
            // const dist = getDistanceFromLatLonInKm(position.coords.latitude, position.coords.longitude, restData.lat, restData.lng);
            // if (dist <= restData.radius_meters / 1000) setLocationVerified(true);
            
            // For DEMO purposes, we ALWAYS verify location to allow testing
            setLocationVerified(true); 
        },
        (error) => {
          // Fallback or error
          console.error("Location error", error);
          // For DEMO purposes, allow access even if location fails
          setLocationVerified(true);
        }
      );
    } else {
        setLocationVerified(true);
    }
  };

  const addToCart = (item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(i => i.id === itemId ? { ...i, quantity: i.quantity - 1 } : i);
      }
      return prev.filter(i => i.id !== itemId);
    });
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const placeOrder = async () => {
    if (!nickname) {
      alert('Please enter your name');
      return;
    }

    try {
      const res = await fetch('/api/public/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          restaurantId: restaurant.restaurant_id,
          tableId: restaurant.id,
          customerNickname: nickname,
          items: cart
        }),
      });
      
      if (res.ok) {
        setOrderPlaced(true);
        setCart([]);
      }
    } catch (err) {
      alert('Failed to place order');
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (error) return <div className="min-h-screen flex items-center justify-center text-red-500">{error}</div>;

  if (!locationVerified) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <MapPin className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Location Check Failed</h2>
        <p className="text-gray-600">You must be at the restaurant to order.</p>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="min-h-screen bg-green-50 flex flex-col items-center justify-center p-6 text-center">
        <motion.div 
          initial={{ scale: 0 }} 
          animate={{ scale: 1 }}
          className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mb-6 shadow-lg shadow-green-200"
        >
          <Check className="text-white w-12 h-12" strokeWidth={3} />
        </motion.div>
        <h2 className="text-3xl font-bold text-green-800 mb-2">Order Confirmed!</h2>
        <p className="text-xl font-semibold text-green-700 mb-2">{nickname}</p>
        <p className="text-green-600 mb-8 max-w-xs mx-auto">Your order Come soon Just wait for few minute</p>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm w-full max-w-sm border border-green-100">
          <p className="text-sm text-gray-500 uppercase tracking-wider font-semibold mb-2">Table</p>
          <p className="text-2xl font-bold text-gray-800">{restaurant.name}</p>
        </div>

        <button 
          onClick={() => {
            setOrderPlaced(false);
            setNickname('');
          }}
          className="mt-8 bg-white text-green-600 px-6 py-2 rounded-full font-medium shadow-sm hover:bg-green-50 transition-colors"
        >
          Place another order
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <div className="bg-white p-4 sticky top-0 z-10 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-xl font-bold text-gray-800">{restaurant.restaurant_name}</h1>
          <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-sm font-medium">
            Table {restaurant.name}
          </span>
        </div>
        <input
          type="text"
          placeholder="Enter your name (Optional)"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="w-full bg-gray-100 border-0 rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Categories */}
      <div className="overflow-x-auto whitespace-nowrap p-4 gap-2 flex bg-white border-b border-gray-100">
        {menu.map(cat => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-colors",
              activeCategory === cat.id 
                ? "bg-indigo-600 text-white" 
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Menu Items */}
      <div className="p-4 space-y-4">
        {menu.find(c => c.id === activeCategory)?.items.map(item => {
          const inCart = cart.find(i => i.id === item.id);
          return (
            <motion.div 
              key={item.id}
              layoutId={`item-${item.id}`}
              className="bg-white p-4 rounded-2xl shadow-sm flex justify-between items-center"
            >
              <div className="flex-1">
                <h3 className="font-semibold text-gray-800">{item.name}</h3>
                <p className="text-sm text-gray-500 line-clamp-2">{item.description}</p>
                <p className="text-indigo-600 font-bold mt-1">₹{item.price}</p>
              </div>
              
              <div className="ml-4">
                {inCart ? (
                  <div className="flex items-center bg-indigo-50 rounded-lg overflow-hidden">
                    <button onClick={() => removeFromCart(item.id)} className="p-2 hover:bg-indigo-100 text-indigo-700">
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className="w-8 text-center font-medium text-indigo-700">{inCart.quantity}</span>
                    <button onClick={() => addToCart(item)} className="p-2 hover:bg-indigo-100 text-indigo-700">
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={() => addToCart(item)}
                    className="bg-white border border-gray-200 text-indigo-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-50 transition-colors shadow-sm"
                  >
                    ADD
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Sticky Cart */}
      <AnimatePresence>
        {cart.length > 0 && (
          <motion.div 
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.1)] p-4 rounded-t-3xl z-50"
          >
            <div className="flex justify-between items-center mb-4">
              <div>
                <p className="text-xs text-gray-500 uppercase font-semibold">{cartCount} Items</p>
                <p className="text-2xl font-bold text-gray-900">₹{cartTotal}</p>
              </div>
              <button 
                onClick={placeOrder}
                className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 flex items-center gap-2"
              >
                Order <ChevronRight className="w-5 h-5" />
              </button>
            </div>
            
            <div className="max-h-32 overflow-y-auto border-t border-gray-100 pt-2 space-y-2">
              {cart.map(item => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.name} x {item.quantity}</span>
                  <span className="font-medium">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
