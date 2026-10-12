"""
GST Tax Invoice Calculation and Renderer for MOSS E-Commerce.
Adheres to Indian GST invoice rules (CGST, SGST, IGST, HSN Codes, Seller GSTIN).
"""
from typing import Dict, Any, List
import datetime

SELLER_INFO = {
    "legal_name": "Trovi Commerce India Private Limited",
    "trade_name": "Trovi",
    "gstin": "29AABCM1234F1Z5",
    "pan": "AABCM1234F",
    "address": "Eco Farmhouse 12, Sarjapur Rural Road, Bengaluru, Karnataka 562125",
    "fssai_license": "11226334000189",
    "support_email": "support@trovi.ai",
    "support_phone": "+91 80 4968 2026",
}

HSN_DIRECTORY = {
    "honey": ("04090000", 0.05),
    "grains": ("11041200", 0.05),
    "oil": ("15159099", 0.05),
    "nuts": ("08021200", 0.05),
    "tea": ("09024090", 0.05),
    "fruits-vegetables": ("07099900", 0.00),
    "luxury": ("21069099", 0.18),
    "default": ("21069099", 0.05),
}


def get_hsn_and_gst_rate(category: str) -> tuple[str, float]:
    norm = (category or "").lower().strip()
    for cat_key, val in HSN_DIRECTORY.items():
        if cat_key in norm:
            return val
    return HSN_DIRECTORY["default"]


def generate_gst_invoice(order_data: Dict[str, Any], items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Computes precise GST breakdown (Taxable value + CGST + SGST)
    and formats complete Tax Invoice document.
    """
    order_num = order_data.get("order_number", "ORD-UNKNOWN")
    invoice_num = f"INV-2026-{order_num.split('-')[-1] if '-' in order_num else order_num}"
    
    invoice_date = order_data.get("ordered_at") or datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")
    
    taxable_subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    
    invoice_items = []
    
    for it in items:
        qty = int(it.get("quantity", 1))
        unit_price = float(it.get("unit_price_inr") or round(float(it.get("unit_price", 0)) * 85))
        gross_item_total = unit_price * qty
        
        category = it.get("category", "")
        hsn_code, gst_rate = get_hsn_and_gst_rate(category)
        
        # Calculate reverse tax: Gross price includes GST in consumer pricing
        # Taxable = Gross / (1 + GST rate)
        taxable_value = gross_item_total / (1.0 + gst_rate) if gst_rate > 0 else gross_item_total
        tax_amount = gross_item_total - taxable_value
        cgst_amount = tax_amount / 2.0
        sgst_amount = tax_amount / 2.0
        
        taxable_subtotal += taxable_value
        total_cgst += cgst_amount
        total_sgst += sgst_amount
        
        invoice_items.append({
            "product_name": it.get("product_name", "Item"),
            "hsn_code": hsn_code,
            "quantity": qty,
            "unit_price_inr": unit_price,
            "taxable_value_inr": round(taxable_value, 2),
            "gst_rate_pct": int(gst_rate * 100),
            "cgst_rate_pct": round(gst_rate * 50, 1),
            "cgst_amount_inr": round(cgst_amount, 2),
            "sgst_rate_pct": round(gst_rate * 50, 1),
            "sgst_amount_inr": round(sgst_amount, 2),
            "total_inr": round(gross_item_total, 2),
        })

    delivery_fee = float(order_data.get("delivery_fee_inr", 0))
    # Delivery fee carries 18% standard logistics GST
    delivery_taxable = delivery_fee / 1.18 if delivery_fee > 0 else 0
    delivery_cgst = (delivery_fee - delivery_taxable) / 2.0
    delivery_sgst = (delivery_fee - delivery_taxable) / 2.0

    total_cgst += delivery_cgst
    total_sgst += delivery_sgst
    total_gst = total_cgst + total_sgst
    grand_total = int(order_data.get("total_price_inr", round(taxable_subtotal + total_gst + delivery_fee)))

    billing_addr_display = order_data.get('billing_address') or order_data.get('customer_address', 'Bengaluru, Karnataka')
    shipping_addr_display = order_data.get('customer_address', 'Bengaluru, Karnataka')
    buyer_company = order_data.get('buyer_company')
    buyer_gstin = order_data.get('buyer_gstin')
    payment_method_display = order_data.get('payment_method') or 'Demo Pay / COD'

    shipped_to_block = ""
    if shipping_addr_display and shipping_addr_display != billing_addr_display:
        shipped_to_block = f"""
  <div style="margin-top: 16px; padding: 10px 14px; background: #faf9f5; border: 1px solid #e6e5df; border-radius: 6px; font-size: 12px; line-height: 1.5;">
    <strong style="color: #1c3024;">Shipped To (Delivery Destination):</strong><br>
    {shipping_addr_display}
  </div>"""

    company_line = f"<strong>{buyer_company}</strong><br>" if buyer_company else ""
    gstin_line = f"<div style='font-weight: 700; color: #1c3024; margin-top: 2px;'>Buyer GSTIN: {buyer_gstin}</div>" if buyer_gstin else ""

    rendered_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Tax Invoice - {invoice_num}</title>
<style>
  body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1c3024; margin: 0; padding: 40px; background: #ffffff; }}
  .invoice-box {{ max-width: 800px; margin: auto; border: 1px solid #e6e5df; border-radius: 12px; padding: 36px; box-shadow: 0 4px 18px rgba(0,0,0,0.04); }}
  .header {{ display: flex; justify-content: space-between; border-bottom: 2px solid #1c3024; padding-bottom: 20px; }}
  .logo {{ font-size: 26px; font-weight: 800; letter-spacing: -0.02em; color: #1c3024; }}
  .badge {{ background: #edf4ee; color: #1c3024; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; }}
  .addresses {{ display: flex; justify-content: space-between; margin-top: 24px; font-size: 13px; line-height: 1.6; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 28px; font-size: 13px; }}
  th {{ background: #f4f3ec; color: #1c3024; text-align: left; padding: 10px 12px; border-bottom: 1px solid #e6e5df; font-weight: 700; }}
  td {{ padding: 10px 12px; border-bottom: 1px solid #f0eee6; }}
  .totals {{ margin-top: 24px; display: flex; justify-content: flex-end; }}
  .totals-table {{ width: 320px; font-size: 13px; }}
  .totals-table td {{ padding: 6px 12px; }}
  .grand-total {{ font-size: 17px; font-weight: 800; color: #1c3024; border-top: 2px solid #1c3024; }}
  .footer {{ margin-top: 40px; font-size: 11px; color: #828e84; text-align: center; border-top: 1px solid #e6e5df; padding-top: 16px; }}
</style>
</head>
<body>
<div class="invoice-box">
  <div class="header">
    <div>
      <div class="logo">Trovi</div>
      <div style="font-size: 12px; color: #576259; margin-top: 4px;">Multi-Category Curated Store</div>
      <div style="font-size: 12px; color: #828e84;">GSTIN: {SELLER_INFO['gstin']} · FSSAI: {SELLER_INFO['fssai_license']}</div>
    </div>
    <div style="text-align: right;">
      <span class="badge">Original Tax Invoice</span>
      <div style="font-size: 15px; font-weight: 700; margin-top: 8px;">{invoice_num}</div>
      <div style="font-size: 12px; color: #828e84;">Date: {invoice_date}</div>
      <div style="font-size: 12px; color: #828e84;">Order: {order_num}</div>
    </div>
  </div>

  <div class="addresses">
    <div style="max-width: 48%;">
      <strong>Billed By (Seller):</strong><br>
      {SELLER_INFO['legal_name']}<br>
      {SELLER_INFO['address']}<br>
      Support: {SELLER_INFO['support_phone']}
    </div>
    <div style="max-width: 48%; text-align: right;">
      <strong>Billed To (Tax Invoice Recipient):</strong><br>
      {company_line}
      {order_data.get('customer_name', 'Valued Customer')}<br>
      {billing_addr_display}<br>
      {gstin_line}
      Email: {order_data.get('customer_email', 'shopper@moss.internal')}<br>
      <span style="font-size: 12px; color: #576259;">Payment: {payment_method_display}</span>
    </div>
  </div>
  {shipped_to_block}

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th>HSN</th>
        <th style="text-align: center;">Qty</th>
        <th style="text-align: right;">Rate (₹)</th>
        <th style="text-align: right;">Taxable (₹)</th>
        <th style="text-align: right;">GST (₹)</th>
        <th style="text-align: right;">Total (₹)</th>
      </tr>
    </thead>
    <tbody>
      {''.join([f'''<tr>
        <td><strong>{it['product_name']}</strong></td>
        <td>{it['hsn_code']}</td>
        <td style="text-align: center;">{it['quantity']}</td>
        <td style="text-align: right;">₹{it['unit_price_inr']:,.2f}</td>
        <td style="text-align: right;">₹{it['taxable_value_inr']:,.2f}</td>
        <td style="text-align: right;">₹{(it['cgst_amount_inr'] + it['sgst_amount_inr']):,.2f} ({it['gst_rate_pct']}%)</td>
        <td style="text-align: right;">₹{it['total_inr']:,.2f}</td>
      </tr>''' for it in invoice_items])}
    </tbody>
  </table>

  <div class="totals">
    <table class="totals-table">
      <tr>
        <td>Taxable Subtotal:</td>
        <td style="text-align: right;">₹{round(taxable_subtotal, 2):,.2f}</td>
      </tr>
      <tr>
        <td>CGST:</td>
        <td style="text-align: right;">₹{round(total_cgst, 2):,.2f}</td>
      </tr>
      <tr>
        <td>SGST:</td>
        <td style="text-align: right;">₹{round(total_sgst, 2):,.2f}</td>
      </tr>
      <tr>
        <td>Delivery & Logistics:</td>
        <td style="text-align: right;">₹{round(delivery_fee, 2):,.2f}</td>
      </tr>
      <tr class="grand-total">
        <td>Total Paid:</td>
        <td style="text-align: right;">₹{grand_total:,.2f}</td>
      </tr>
    </table>
  </div>

  <div class="footer">
    This is a computer-generated tax invoice issued under the Goods and Services Tax Act 2017. No signature required.<br>
    Thank you for purchasing pure, authentic essentials from Trovi.
  </div>
</div>
</body>
</html>"""

    return {
        "invoice_number": invoice_num,
        "invoice_date": invoice_date,
        "seller": SELLER_INFO,
        "buyer": {
            "name": order_data.get("customer_name"),
            "email": order_data.get("customer_email"),
            "shipping_address": shipping_addr_display,
            "billing_address": billing_addr_display,
            "address": billing_addr_display,
            "company_name": buyer_company,
            "gstin": buyer_gstin,
            "payment_method": payment_method_display,
        },
        "items": invoice_items,
        "summary": {
            "taxable_subtotal_inr": round(taxable_subtotal, 2),
            "cgst_inr": round(total_cgst, 2),
            "sgst_inr": round(total_sgst, 2),
            "total_gst_inr": round(total_gst, 2),
            "delivery_fee_inr": round(delivery_fee, 2),
            "grand_total_inr": grand_total,
        },
        "rendered_html": rendered_html,
    }
