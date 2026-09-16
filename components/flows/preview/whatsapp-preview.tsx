import React from'react';
import { X, ArrowLeft } from'lucide-react';

interface WhatsAppPreviewProps {
 isOpen: boolean;
 onClose: () => void;
 data: any;
}

export function WhatsAppPreview({ isOpen, onClose, data }: WhatsAppPreviewProps) {
 if (!isOpen) return null;

 return (
 <div className="fixed right-0 top-0 bottom-0 w-[400px] bg-[#E5DDD5] z-50 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300">
 {/* Header */}
 <div className="bg-[#008069] text-white p-4 flex items-center justify-between shadow-sm">
 <div className="flex items-center gap-3">
 <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full">
 <ArrowLeft className="w-5 h-5" />
 </button>
 <div className="flex items-center gap-2">
 <div className="w-8 h-8 rounded-full bg-yellow-400 flex items-center justify-center text-xs font-bold text-white">
 <span className="sr-only">Avatar</span>
 👤
 </div>
 <span className="font-medium">155558098092</span>
 </div>
 </div>
 <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Chat Area */}
 <div className="flex-1 p-4 overflow-y-auto" style={{ 
 backgroundImage:'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d936a28b83.png")',
 backgroundRepeat:'repeat'
 }}>
 <div className="bg-white rounded-lg shadow-sm p-1 max-w-[85%] mb-4">
 {/* Checks for items array (Catalogue) or single body/footer (Message) */}
 {(data?.items && Array.isArray(data.items)) ? (
 <div className="space-y-2">
 {data.items.map((item: any, idx: number) => (
 <div key={idx} className="bg-gray-100 rounded p-4 mb-1">
 <div className="w-full h-8 bg-white rounded mb-2"></div>
 <div className="space-y-2">
 <p className="text-sm text-gray-800">{item.body || "Body text"}</p>
 <p className="text-xs text-gray-500">{item.footer || "Footer text"}</p>
 </div>
 </div>
 ))}
 </div>
 ) : (
 <div className="bg-gray-100 rounded p-4 mb-1">
 <div className="w-full h-8 bg-white rounded mb-2"></div>
 <div className="space-y-2">
 <p className="text-sm text-gray-800">{data?.body || "Body text"}</p>
 <p className="text-xs text-gray-500">{data?.footer || "Footer text"}</p>
 </div>
 </div>
 )}
 {/* Buttons placeholder */}
 <div className="bg-white p-2 text-center text-[#00A3FF] text-sm font-medium border-t">
 View Catalogue
 </div>
 </div>
 
 {/* Time stamp */}
 <div className="text-center">
 <span className="bg-[#E1F3FB] text-gray-600 text-xs py-1 px-3 rounded shadow-sm">
 Today
 </span>
 </div>
 </div>

 {/* Footer Input Area Placeholder */}
 <div className="p-2 bg-[#F0F2F5] flex items-center gap-2">
 <div className="bg-white flex-1 rounded-full h-10 px-4 flex items-center text-gray-400 text-sm">
 Type a message
 </div>
 <div className="w-10 h-10 bg-[#008069] rounded-full flex items-center justify-center text-white">
 <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
 <path d="M1.101 21.757 23.8 12.028 1.101 2.3l.011 7.912 13.623 1.816-13.623 1.817-.011 7.912z"></path>
 </svg>
 </div>
 </div>
 </div>
 );
}
