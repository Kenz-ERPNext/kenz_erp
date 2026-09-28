import frappe

# Supplier / Customer quick entry fieldname -> Address fieldname
QUICK_ENTRY_ADDRESS_FIELDS = {
	"address_type": "address_type",
	"address_building_number": "custom_building_number",
	"address_area": "custom_area",
	"address_county": "county",
	"address_tax_category": "tax_category",
	"address_phone": "phone",
	"address_email": "email_id",
	"address_is_primary": "is_primary_address",
	"address_is_shipping": "is_shipping_address",
}

# Supplier / Customer quick entry fieldname -> Contact fieldname
QUICK_ENTRY_CONTACT_FIELDS = {
	"contact_salutation": "salutation",
	"contact_middle_name": "middle_name",
	"contact_gender": "gender",
	"contact_designation": "designation",
	"contact_department": "department",
	"contact_phone": "phone",
}


PARTY_DOCTYPES = ("Supplier", "Customer")

# Fields kenz_erp's Quick Entry shows (see party_quick_entry.js) that used to only exist because
# kenz_trading's own custom/customer.json put them there under its own module. Uninstalling
# kenz_trading deletes every Custom Field/Property Setter still linked to its Module Def, which
# would silently delete these from underneath Quick Entry - so kenz_erp now ships them itself
# (see custom/customer.json) under its own module instead. That file alone isn't quite enough:
# if kenz_trading is ever reinstalled, its own customize-form sync runs on every `bench migrate`
# too and would claim "module" back to "Kenz Trading" for any field both apps define, re-coupling
# it. Re-asserting kenz_erp's ownership here, in an after_migrate hook (which always runs last,
# after every app's customize-form sync), keeps it decoupled no matter which app syncs last.
RECLAIMED_CUSTOM_FIELDS = {
	("Customer", "custom_customer_name_arabic"): "Kenz Erp",
}


def reclaim_custom_field_ownership():
	for (dt, fieldname), module in RECLAIMED_CUSTOM_FIELDS.items():
		name = f"{dt}-{fieldname}"
		if frappe.db.exists("Custom Field", name) and frappe.db.get_value(
			"Custom Field", name, "module"
		) != module:
			frappe.db.set_value("Custom Field", name, "module", module)


def stash_quick_entry_fields(doc, method=None):
	"""Supplier / Customer validate: keep the quick entry values for the Address and Contact that
	ERPNext's make_address / make_contact create in the party's on_update."""
	if not doc.is_new():
		return

	stash = frappe.flags.setdefault("party_quick_entry_fields", {})
	for doctype, mapping in (
		("Address", QUICK_ENTRY_ADDRESS_FIELDS),
		("Contact", QUICK_ENTRY_CONTACT_FIELDS),
	):
		# keep 0 from unticked checkboxes, skip empty fields
		values = {
			target: doc.get(source) for source, target in mapping.items() if doc.get(source) not in (None, "")
		}
		if values:
			stash[(doctype, doc.doctype, doc.name)] = values


def apply_quick_entry_fields(doc, method=None):
	"""Address / Contact before_insert: runs before naming, so address_type is also reflected in the name."""
	stash = frappe.flags.get("party_quick_entry_fields")
	if not stash:
		return

	for link in doc.links:
		if link.link_doctype not in PARTY_DOCTYPES:
			continue
		values = stash.pop((doc.doctype, link.link_doctype, link.link_name), None)
		if not values:
			continue

		# Contact.phone is derived from the phone_nos table on validate
		if doc.doctype == "Contact" and (phone := values.pop("phone", None)):
			doc.add_phone(phone, is_primary_phone=True)
		doc.update(values)
		break
