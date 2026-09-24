frappe.provide("frappe.ui.form");

// Extra Address fields for the Primary Address Details section of the Supplier quick entry.
// Fieldnames are prefixed where Supplier has a field of the same name (tax_category, email_id).
// kenz_erp loads before erpnext (apps.txt order), so wait until erpnext's scripts have run.
$(() => {
	frappe.ui.form.SupplierQuickEntryForm = class SupplierQuickEntryForm extends (
		frappe.ui.form.ContactAddressQuickEntryForm
	) {
		get_variant_fields() {
			const fields = super.get_variant_fields();

			// Primary Contact Details / Primary Address Details as collapsible sections
			fields
				.filter((f) => f.fieldtype === "Section Break")
				.forEach((f) => (f.collapsible = 1));

			const address_fields = [
				{
					label: __("Address Type"),
					fieldname: "address_type",
					fieldtype: "Select",
					options: [
						"",
						"Billing",
						"Shipping",
						"Office",
						"Personal",
						"Plant",
						"Postal",
						"Shop",
						"Subsidiary",
						"Warehouse",
						"Current",
						"Permanent",
						"Other",
					].join("\n"),
				},
			];
			const extra_fields = [
				{
					label: __("County"),
					fieldname: "address_county",
					fieldtype: "Data",
				},
				{
					label: __("Tax Category"),
					fieldname: "address_tax_category",
					fieldtype: "Link",
					options: "Tax Category",
				},
				{
					label: __("Phone"),
					fieldname: "address_phone",
					fieldtype: "Data",
					options: "Phone",
				},
				{
					label: __("Email Address"),
					fieldname: "address_email",
					fieldtype: "Data",
					options: "Email",
				},
			];

			const company_only = "eval:doc.supplier_type=='Company'";
			const contact_name_fields = [
				{
					label: __("Salutation"),
					fieldname: "contact_salutation",
					fieldtype: "Link",
					options: "Salutation",
					depends_on: company_only,
				},
			];
			const contact_middle_name = [
				{
					label: __("Middle Name"),
					fieldname: "contact_middle_name",
					fieldtype: "Data",
					depends_on: company_only,
				},
			];
			const contact_extra_fields = [
				{
					label: __("Phone"),
					fieldname: "contact_phone",
					fieldtype: "Data",
					options: "Phone",
				},
				{
					label: __("Designation"),
					fieldname: "contact_designation",
					fieldtype: "Data",
				},
				{
					label: __("Department"),
					fieldname: "contact_department",
					fieldtype: "Data",
				},
				{
					label: __("Gender"),
					fieldname: "contact_gender",
					fieldtype: "Link",
					options: "Gender",
				},
			];

			const first_name_idx = fields.findIndex((f) => f.fieldname === "map_to_first_name");
			fields.splice(first_name_idx, 0, ...contact_name_fields);
			fields.splice(first_name_idx + 2, 0, ...contact_middle_name);

			const mobile_idx = fields.findIndex((f) => f.fieldname === "mobile_number");
			fields.splice(mobile_idx + 1, 0, ...contact_extra_fields);

			const line1_idx = fields.findIndex((f) => f.fieldname === "address_line1");
			fields.splice(line1_idx, 0, ...address_fields);

			const country_idx = fields.findIndex((f) => f.fieldname === "country");
			fields.splice(country_idx + 1, 0, ...extra_fields);

			return fields;
		}
	};
});
