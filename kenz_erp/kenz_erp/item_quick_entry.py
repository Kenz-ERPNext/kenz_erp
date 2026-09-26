import frappe
from frappe.utils import flt


def sync_price_list_rates(doc, method=None):
	"""Item on_update (from the quick entry, create or edit): reconcile this item's Item Prices
	against the price list rows in the dialog - create missing ones, update changed rates, and
	remove rows that were deleted in the dialog. The rows' UOM conversions and barcodes are
	already on the Item (set by the quick entry)."""
	prices_json = doc.get("quick_entry_prices")
	if prices_json is None:
		return

	wanted = {}
	for price in frappe.parse_json(prices_json or "[]"):
		price_list = price.get("price_list")
		if not price_list:
			continue
		uom = price.get("uom") or doc.stock_uom
		wanted[(price_list, uom)] = flt(price.get("rate"))

	existing = frappe.get_all(
		"Item Price",
		filters={"item_code": doc.name},
		fields=["name", "price_list", "uom"],
	)

	seen = set()
	for row in existing:
		key = (row.price_list, row.uom or doc.stock_uom)
		if key in wanted:
			seen.add(key)
			frappe.db.set_value("Item Price", row.name, "price_list_rate", wanted[key])
		else:
			frappe.delete_doc("Item Price", row.name, ignore_permissions=True)

	for (price_list, uom), rate in wanted.items():
		if (price_list, uom) in seen:
			continue
		frappe.get_doc(
			{
				"doctype": "Item Price",
				"item_code": doc.name,
				"uom": uom,
				"price_list": price_list,
				"price_list_rate": rate,
				"currency": frappe.db.get_value("Price List", price_list, "currency"),
			}
		).insert(ignore_permissions=True)
