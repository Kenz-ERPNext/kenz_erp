frappe.provide("frappe.ui.form");

// Supplier / Customer quick entry: extra Contact and Address fields, laid out in 3 columns per section.
// Contact/Address fieldnames are prefixed (contact_*, address_*) so they don't clash with party fields;
// kenz_erp.kenz_erp.party_quick_entry maps them onto the Contact and Address that ERPNext creates.
// kenz_erp loads before erpnext (apps.txt order), so wait until erpnext's scripts have run.
$(() => {
	// party: "supplier" or "customer" (prefix of the <party>_name / <party>_type fields)
	const make_party_quick_entry_form = (party) =>
		class extends frappe.ui.form.ContactAddressQuickEntryForm {
			render_dialog() {
				// Name | Type side by side
				const name_idx = this.mandatory.findIndex((f) => f.fieldname === `${party}_name`);
				if (name_idx !== -1) {
					this.mandatory.splice(name_idx + 1, 0, { fieldtype: "Column Break" });
				}
				super.render_dialog();
			}

			get_variant_fields() {
				const erpnext_fields = {};
				super.get_variant_fields().forEach((f) => {
					if (f.fieldname) erpnext_fields[f.fieldname] = f;
				});

				const section = (label) => ({
					fieldtype: "Section Break",
					label: __(label),
					collapsible: 1,
				});
				const column = () => ({ fieldtype: "Column Break" });
				const company_only = `eval:doc.${party}_type=='Company'`;

				return [
					section("Primary Contact Details"),
					{
						label: __("Salutation"),
						fieldname: "contact_salutation",
						fieldtype: "Link",
						options: "Salutation",
						depends_on: company_only,
					},
					erpnext_fields.map_to_first_name,
					{
						label: __("Middle Name"),
						fieldname: "contact_middle_name",
						fieldtype: "Data",
						depends_on: company_only,
					},
					erpnext_fields.map_to_last_name,
					column(),
					erpnext_fields.email_address,
					erpnext_fields.mobile_number,
					{
						label: __("Phone"),
						fieldname: "contact_phone",
						fieldtype: "Data",
						options: "Phone",
					},
					column(),
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

					section("Primary Address Details"),
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
					erpnext_fields.address_line1,
					erpnext_fields.address_line2,
					{
						label: __("Building Number"),
						fieldname: "address_building_number",
						fieldtype: "Data",
					},
					{
						label: __("Area/District"),
						fieldname: "address_area",
						fieldtype: "Data",
					},
					column(),
					erpnext_fields.city,
					{
						label: __("County"),
						fieldname: "address_county",
						fieldtype: "Data",
					},
					erpnext_fields.state,
					erpnext_fields.pincode,
					erpnext_fields.country,
					column(),
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
					{
						label: __("Preferred Billing Address"),
						fieldname: "address_is_primary",
						fieldtype: "Check",
						default: 1,
					},
					{
						label: __("Preferred Shipping Address"),
						fieldname: "address_is_shipping",
						fieldtype: "Check",
						default: 1,
					},
					erpnext_fields.customer_pos_id,
				];
			}
		};

	frappe.ui.form.SupplierQuickEntryForm = make_party_quick_entry_form("supplier");
	frappe.ui.form.CustomerQuickEntryForm = make_party_quick_entry_form("customer");
});
