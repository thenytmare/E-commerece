'use client';

import React from 'react';
import { Printer, Share2 } from 'lucide-react';
import { buildWhatsAppLink } from '@repo/utils';
import { formatPrice } from '@/lib/format';

type OrderItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  price: number;
};

type ReceiptProps = {
  storeName: string;
  storePhone: string;
  storeEmail: string;
  storeAddress: string;
  orderNumber: string;
  orderDate: string;
  status: string;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  items: OrderItem[];
  subtotal: string;
  shipping: string;
  discount: string;
  total: string;
  paymentMethod: string;
};

export function DigitalReceipt(props: ReceiptProps) {
  const handlePrint = () => {
    window.print();
  };

  const handleShareWhatsApp = () => {
    const text =
      `Receipt for order ${props.orderNumber}\n` +
      `Store: ${props.storeName}\n` +
      `Total: ${props.total}\n` +
      `Date: ${props.orderDate}`;
    window.open(buildWhatsAppLink(props.storePhone, text), '_blank');
  };

  return (
    <div>
      {/* Print controls - hidden during print */}
      <div className="no-print flex items-center gap-3 mb-6">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <Printer className="h-4 w-4" /> Print Receipt
        </button>
        <button
          onClick={handleShareWhatsApp}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md text-sm font-medium hover:bg-green-700 transition-colors"
        >
          <Share2 className="h-4 w-4" /> Share via WhatsApp
        </button>
      </div>

      {/* Receipt content */}
      <div className="receipt bg-white text-black rounded-xl border-2 border-gray-200 p-8 max-w-2xl mx-auto" id="digital-receipt">
        {/* Header */}
        <div className="text-center border-b-2 border-gray-200 pb-6 mb-6">
          <h2 className="text-2xl font-bold tracking-tight mb-1">{props.storeName}</h2>
          <p className="text-gray-600 text-sm">{props.storeAddress}</p>
          <p className="text-gray-600 text-sm">{props.storePhone} | {props.storeEmail}</p>
          <div className="mt-4 inline-block bg-gray-100 rounded-lg px-4 py-2">
            <span className="text-xs text-gray-500 uppercase tracking-wider">Order Receipt</span>
          </div>
        </div>

        {/* Order Info */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Order Number</p>
            <p className="font-mono font-bold text-lg">{props.orderNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Date</p>
            <p className="font-medium">{props.orderDate}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
              props.status === 'DELIVERED' || props.status === 'CONFIRMED' 
                ? 'bg-green-100 text-green-800' 
                : props.status === 'PENDING' 
                ? 'bg-amber-100 text-amber-800'
                : props.status === 'CANCELLED' || props.status === 'REFUNDED'
                ? 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800'
            }`}>
              {props.status}
            </span>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Payment</p>
            <p className="font-medium">{props.paymentMethod}</p>
          </div>
        </div>

        {/* Customer Info */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Customer</p>
          <p className="font-bold">{props.customerName}</p>
          <p className="text-sm text-gray-600">{props.customerPhone}</p>
          <p className="text-sm text-gray-600">{props.customerAddress}</p>
        </div>

        {/* Items Table */}
        <div className="mb-6">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Order Items</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-2 font-semibold">Item</th>
                <th className="text-center py-2 font-semibold">SKU</th>
                <th className="text-center py-2 font-semibold">Qty</th>
                <th className="text-right py-2 font-semibold">Total</th>
              </tr>
            </thead>
            <tbody>
              {props.items.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-3">
                    <p className="font-medium">{item.name}</p>
                  </td>
                  <td className="py-3 text-center text-gray-500 text-xs font-mono">{item.sku}</td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="py-3 text-right font-medium">
                    {formatPrice(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="border-t-2 border-gray-200 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span>{props.subtotal}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Shipping</span>
            <span>{props.shipping}</span>
          </div>
          {props.discount !== 'KES 0' && (
            <div className="flex justify-between text-sm text-green-700">
              <span>Discount</span>
              <span>-{props.discount}</span>
            </div>
          )}
          <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200">
            <span>Total</span>
            <span>{props.total}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Thank you for shopping with {props.storeName}!</p>
          <p className="mt-1">For any inquiries, contact {props.storePhone}</p>
          <p className="mt-3 text-[10px] text-gray-400">This is a computer-generated receipt.</p>
        </div>
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .receipt, .receipt * {
            visibility: visible;
          }
          .receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            box-shadow: none !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}