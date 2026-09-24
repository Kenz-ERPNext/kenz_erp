frappe.provide("frappe.ui.form");

// Item quick entry: 3 column layout with opening stock / pricing and item tax template.
// Fields are saved on the Item directly, except Standard Buying Rate (kenz_erp.kenz_erp.item_quick_entry).
frappe.ui.form.ItemQuickEntryForm = class ItemQuickEntryForm extends (
	frappe.ui.form.QuickEntryForm
) {
	render_dialog() {
		const df = {};
		this.meta.fields.forEach((f) => (df[f.fieldname] = { ...f }));

		const section = (label) => ({
			fieldtype: "Section Break",
			label: label && __(label),
			collapsible: label ? 1 : 0,
		});
		const column = () => ({ fieldtype: "Column Break" });
		const layout = [
			section(),
			"item_code",
			"item_name",
			{
				label: __("Item Tax Template"),
				fieldname: "quick_entry_item_tax_template",
				fieldtype: "Link",
				options: "Item Tax Template",
			},
			column(),
			"item_group",
			"stock_uom",
			column(),
			"is_stock_item",
			"is_fixed_asset",
			"asset_category",

			section("Opening Stock & Pricing"),
			"opening_stock",
			"valuation_rate",
			column(),
			{
				label: __("Standard Buying Rate"),
				fieldname: "standard_buying_rate",
				fieldtype: "Currency",
			},
			column(),
			"standard_rate",
		];
		const used = new Set(layout.filter((f) => typeof f === "string"));

		// other mandatory / quick entry fields (e.g. from customizations) go at the end of the first section
		const others = this.mandatory.filter((f) => f.fieldname && !used.has(f.fieldname));
		const first_section_end = layout.indexOf("asset_category") + 1;
		layout.splice(first_section_end, 0, ...others.map((f) => f.fieldname));

		this.mandatory = layout.map((f) => (typeof f === "string" ? df[f] : f)).filter(Boolean);
		super.render_dialog();
	}

	insert() {
		// Item Tax Template is a child table on Item, add the selected template as its row
		const template = this.dialog.get_value("quick_entry_item_tax_template");
		this.dialog.doc.taxes = template ? [{ item_tax_template: template }] : [];
		delete this.dialog.doc.quick_entry_item_tax_template;
		return super.insert();
	}
};
