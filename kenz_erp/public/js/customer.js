frappe.provide("frappe.ui.form");

// Customer full form: keep custom_vat_registration_number / custom_cr_no in sync with the
// standard tax_id field and the "Additional IDs" child table (TIN / CRN rows) as they're typed -
// the same sync party_quick_entry.js already does when a customer is first created via Quick
// Entry, extended here to edits made afterwards on the full form.
frappe.ui.form.on("Customer", {
	custom_vat_registration_number(frm) {
		sync_additional_id(frm, "custom_vat_registration_number", "Tax Identification Number", "TIN");
		const vat = frm.doc.custom_vat_registration_number;
		if (vat && frm.doc.tax_id !== vat) frm.set_value("tax_id", vat);
	},
	custom_cr_no(frm) {
		sync_additional_id(frm, "custom_cr_no", "Commercial Registration Number", "CRN");
	},
	refresh(frm) {
		// catches records saved before this sync existed, or edited outside the form (import,
		// API) - sync_additional_id() is a no-op when the row already matches, so this never
		// dirties a form that doesn't actually need it.
		sync_additional_id(frm, "custom_vat_registration_number", "Tax Identification Number", "TIN");
		sync_additional_id(frm, "custom_cr_no", "Commercial Registration Number", "CRN");
	},
});

function sync_additional_id(frm, source_fieldname, type_name, type_code) {
	if (!frappe.meta.has_field(frm.doctype, "custom_additional_ids")) return;

	const value = frm.doc[source_fieldname];
	if (!value) return;

	let row = (frm.doc.custom_additional_ids || []).find((r) => r.type_code === type_code);
	if (row && row.value === value) return;

	if (!row) {
		row = frm.add_child("custom_additional_ids");
		row.type_name = type_name;
		row.type_code = type_code;
	}
	row.value = value;
	frm.refresh_field("custom_additional_ids");
}
