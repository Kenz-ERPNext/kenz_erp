import frappe

# Supplier quick entry fieldname -> Address fieldname
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

# Supplier quick entry fieldname -> Contact fieldname
QUICK_ENTRY_CONTACT_FIELDS = {
	"contact_salutation": "salutation",
	"contact_middle_name": "middle_name",
	"contact_gender": "gender",
	"contact_designation": "designation",
	"contact_department": "department",
	"contact_phone": "phone",
}


def stash_quick_entry_fields(doc, method=None):
	"""Supplier validate: keep the quick entry values for the Address and Contact that
	ERPNext's make_address / make_contact create in Supplier.on_update."""
	if not doc.is_new():
		return

	stash = frappe.flags.setdefault("supplier_quick_entry_fields", {})
	for doctype, mapping in (
		("Address", QUICK_ENTRY_ADDRESS_FIELDS),
		("Contact", QUICK_ENTRY_CONTACT_FIELDS),
	):
		# keep 0 from unticked checkboxes, skip empty fields
		values = {
			target: doc.get(source) for source, target in mapping.items() if doc.get(source) not in (None, "")
		}
		if values:
			stash[(doctype, doc.name)] = values


def apply_quick_entry_fields(doc, method=None):
	"""Address / Contact before_insert: runs before naming, so address_type is also reflected in the name."""
	stash = frappe.flags.get("supplier_quick_entry_fields")
	if not stash:
		return

	for link in doc.links:
		if link.link_doctype != "Supplier":
			continue
		values = stash.pop((doc.doctype, link.link_name), None)
		if not values:
			continue

		# Contact.phone is derived from the phone_nos table on validate
		if doc.doctype == "Contact" and (phone := values.pop("phone", None)):
			doc.add_phone(phone, is_primary_phone=True)
		doc.update(values)
		break
