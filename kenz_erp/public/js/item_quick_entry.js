frappe.provide("frappe.ui.form");

// Item quick entry: 3 column layout with item tax template, opening stock, a Price List
// (frappe.kenz_erp.ItemPriceEditor) and a separate Barcode list (frappe.kenz_erp.ItemBarcodeEditor)
// - a barcode doesn't need a price and a price doesn't need a barcode, so they're independent.
// Price list rows become Item Prices in kenz_erp.kenz_erp.item_quick_entry, everything else
// is saved on the Item directly.
frappe.ui.form.ItemQuickEntryForm = class ItemQuickEntryForm extends (
	frappe.ui.form.QuickEntryForm
) {
	render_dialog() {
		const df = {};
		this.meta.fields.forEach((f) => (df[f.fieldname] = { ...f }));

		const section = (label, collapsible = 0) => ({
			fieldtype: "Section Break",
			label: label && __(label),
			collapsible,
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
				reqd: 1,
			},
			column(),
			"item_group",
			"stock_uom",
			column(),
			"is_stock_item",
			"is_fixed_asset",
			"asset_category",
			"opening_stock",
			"valuation_rate",

			section("Price List"),
			{
				fieldname: "quick_entry_prices_html",
				fieldtype: "HTML",
			},

			section("Barcode"),
			{
				fieldname: "quick_entry_barcodes_html",
				fieldtype: "HTML",
			},
		];
		const used = new Set(layout.filter((f) => typeof f === "string"));

		// other mandatory / quick entry fields (e.g. from customizations) go at the end of the first section
		const others = this.mandatory.filter((f) => f.fieldname && !used.has(f.fieldname));
		const first_section_end = layout.indexOf("valuation_rate") + 1;
		layout.splice(first_section_end, 0, ...others.map((f) => f.fieldname));

		this.mandatory = layout.map((f) => (typeof f === "string" ? df[f] : f)).filter(Boolean);
		super.render_dialog();

		this.price_editor = new frappe.kenz_erp.ItemPriceEditor({
			get_stock_uom: () => this.dialog.get_value("stock_uom"),
			get_item_code: () => this.dialog.get_value("item_code"),
		});
		this.price_editor.make(this.dialog.fields_dict.quick_entry_prices_html.wrapper);

		this.barcode_editor = new frappe.kenz_erp.ItemBarcodeEditor({
			get_stock_uom: () => this.dialog.get_value("stock_uom"),
		});
		this.barcode_editor.make(this.dialog.fields_dict.quick_entry_barcodes_html.wrapper);

		// Editing an existing Item (e.g. via the list view's edit icon): load its current
		// UOM / Item Price / Barcode rows into the same lists used when adding.
		if (!this.doc.__islocal) {
			this.price_editor.load_from_item(this.doc);
			this.barcode_editor.load_from_item(this.doc);
		}
	}

	insert() {
		// Item Tax Template is a child table on Item, add the selected template as its row
		const template = this.dialog.get_value("quick_entry_item_tax_template");
		this.dialog.doc.taxes = template ? [{ item_tax_template: template }] : [];
		delete this.dialog.doc.quick_entry_item_tax_template;

		const price_fields = this.price_editor.get_item_doc_fields();
		const barcode_fields = this.barcode_editor.get_item_doc_fields();
		const uoms = {};
		[...price_fields.uoms, ...barcode_fields.uoms].forEach((u) => (uoms[u.uom] = u.conversion_factor));

		this.dialog.doc.uoms = Object.entries(uoms).map(([uom, conversion_factor]) => ({
			uom,
			conversion_factor,
		}));
		this.dialog.doc.barcodes = barcode_fields.barcodes;
		this.dialog.doc.quick_entry_prices = price_fields.quick_entry_prices;
		return super.insert();
	}
};
