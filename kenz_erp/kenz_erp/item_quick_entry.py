import frappe
from frappe.utils import flt


def add_price_list_rates(doc, method=None):
	"""Item after_insert: create an Item Price for each price list row added in the quick entry.
	The rows' UOM conversions and barcodes are already on the Item (set by the quick entry)."""
	prices = frappe.parse_json(doc.get("quick_entry_prices") or "[]")
	for price in prices:
		frappe.get_doc(
			{
				"doctype": "Item Price",
				"item_code": doc.name,
				"uom": price.get("uom") or doc.stock_uom,
				"price_list": price.get("price_list"),
				"price_list_rate": flt(price.get("rate")),
				"currency": frappe.db.get_value("Price List", price.get("price_list"), "currency"),
			}
		).insert()
