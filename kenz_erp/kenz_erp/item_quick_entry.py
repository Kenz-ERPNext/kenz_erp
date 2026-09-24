import erpnext
import frappe
from frappe import _
from frappe.utils import flt


def add_buying_price(doc, method=None):
	"""Item after_insert: create a buying Item Price from the quick entry's Standard Buying Rate,
	the same way ERPNext creates the selling Item Price from standard_rate."""
	rate = flt(doc.get("standard_buying_rate"))
	if not rate:
		return

	price_list = frappe.db.get_single_value("Buying Settings", "buying_price_list") or frappe.db.get_value(
		"Price List", _("Standard Buying")
	)
	if not price_list:
		return

	frappe.get_doc(
		{
			"doctype": "Item Price",
			"price_list": price_list,
			"item_code": doc.name,
			"uom": doc.stock_uom,
			"brand": doc.brand,
			"currency": erpnext.get_default_currency(),
			"price_list_rate": rate,
		}
	).insert()
