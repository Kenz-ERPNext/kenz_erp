frappe.provide("frappe.ui.form");

// Assigning a plain array of plain objects straight to a doc's child table field (e.g.
// `doc.barcodes = [...]`) works for the initial insert, but those rows never get registered in
// Frappe's `locals` the way frappe.model.add_child() registers them - so if that insert then
// fails server-side (e.g. a barcode checksum error) and the dialog falls back to showing the item
// as a full form, that table's grid can no longer be edited: no rows are "found" to attach clicks
// to. Clearing and rebuilding the table through add_child() keeps every row properly tracked
// either way.
function set_child_table(doc, fieldname, rows) {
	const child_doctype = frappe.get_meta(doc.doctype).fields.find(
		(f) => f.fieldname === fieldname
	).options;
	frappe.model.clear_table(doc, fieldname);
	rows.forEach((row) => {
		const child = frappe.model.add_child(doc, child_doctype, fieldname);
		Object.assign(child, row);
	});
}

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
		// shown only when another installed app (e.g. kenz_trading) has actually put the field on
		// Item - reuses that real field directly, no kenz_erp-owned duplicate or mapping needed
		const arabic_name_field = df["custom_item_name_in_arabic"] ? "custom_item_name_in_arabic" : null;
		const layout = [
			section(),
			"item_code",
			"item_name",
			arabic_name_field,
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

			section("Units of Measure"),
			{
				// a Table field's grid only shows inline columns when it can look them up via
				// a form (this.frm) - a bare Dialog has none, so they have to be given directly
				...df["uoms"],
				fields: frappe.get_meta("UOM Conversion Detail").fields,
			},

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
		// dedupe by both fieldname and label: a customization on some other installed app can mark
		// its own, differently-named field as mandatory/allow_in_quick_entry (e.g. its own "Item
		// Tax Template" link) - fieldname alone wouldn't catch that as a duplicate of the one this
		// layout already defines above, but the visible label repeating would.
		const used = new Set(
			layout
				.filter(Boolean)
				.map((f) => (typeof f === "string" ? f : f.fieldname))
				.filter(Boolean)
		);
		const used_labels = new Set(
			layout
				.filter(Boolean)
				.map((f) => (typeof f === "string" ? df[f]?.label : f.label))
				.filter(Boolean)
		);

		// other mandatory / quick entry fields (e.g. from customizations) go at the end of the first section
		const others = this.mandatory.filter(
			(f) => f.fieldname && !used.has(f.fieldname) && !(f.label && used_labels.has(f.label))
		);
		const first_section_end = layout.indexOf("valuation_rate") + 1;
		layout.splice(first_section_end, 0, ...others.map((f) => f.fieldname));

		this.mandatory = layout.map((f) => (typeof f === "string" ? df[f] : f)).filter(Boolean);
		super.render_dialog();

		// a new Item always ends up with its stock UOM as a Units of Measure row (ERPNext adds it
		// on save if it's missing) - show that row from the start instead of an empty grid. A
		// Table field in a bare Dialog (no frm) keeps its rows on the field itself (df.data), not
		// on doc.uoms - that's only synced from df.data when the dialog's values are read on
		// save - so the row has to be added the same way the grid's own "Add Row" button does it.
		const uom_grid = this.dialog.fields_dict.uoms.grid;
		let default_uom_row = null;
		if (this.doc.__islocal && !uom_grid.get_data().length) {
			const stock_uom = this.dialog.get_value("stock_uom");
			if (stock_uom) {
				uom_grid.add_new_row(null, null, false);
				default_uom_row = uom_grid.get_data().slice(-1)[0];
				Object.assign(default_uom_row, { uom: stock_uom, conversion_factor: 1 });
				uom_grid.refresh();
			}
		}

		// that row only reflects whatever "Default Unit of Measure" was set to at the moment the
		// dialog opened - if the user changes it afterwards, the row doesn't follow along on its
		// own. Keep it in sync: whichever row still has the 1:1 conversion factor (the "this row
		// IS the stock uom" row, whether auto-added above or already there when editing) follows
		// stock_uom as it changes, unless the user has since retyped that row's own UOM by hand.
		const stock_uom_field = this.dialog.fields_dict.stock_uom;
		if (stock_uom_field) {
			let last_stock_uom = this.dialog.get_value("stock_uom");
			stock_uom_field.df.onchange = () => {
				const new_uom = this.dialog.get_value("stock_uom");
				if (!new_uom || new_uom === last_stock_uom) return;
				const row =
					default_uom_row && default_uom_row.uom === last_stock_uom
						? default_uom_row
						: uom_grid.get_data().find((r) => r.uom === last_stock_uom && flt(r.conversion_factor) === 1);
				if (row) {
					row.uom = new_uom;
					default_uom_row = row;
					uom_grid.refresh();
				}
				last_stock_uom = new_uom;
			};
		}

		// looks up the conversion factor for a UOM already added to the Units of Measure grid above
		// - reads the grid's own rows (uom_grid.get_data()), not this.dialog.doc.uoms, since a
		// Table field in a bare Dialog only syncs doc.uoms from the grid when the dialog's values
		// are read on save (see the default-row comment above); before that, doc.uoms is stale, so
		// reading from it here would reject a UOM the user can plainly see in the grid.
		const get_conversion_factor = (uom) => {
			const row = uom_grid.get_data().find((u) => u.uom === uom);
			return row && row.conversion_factor;
		};

		this.price_editor = new frappe.kenz_erp.ItemPriceEditor({
			get_stock_uom: () => this.dialog.get_value("stock_uom"),
			get_conversion_factor,
		});
		this.price_editor.make(this.dialog.fields_dict.quick_entry_prices_html.wrapper);

		this.barcode_editor = new frappe.kenz_erp.ItemBarcodeEditor({
			get_stock_uom: () => this.dialog.get_value("stock_uom"),
			get_conversion_factor,
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
		delete this.dialog.doc.quick_entry_item_tax_template;
		set_child_table(this.dialog.doc, "taxes", template ? [{ item_tax_template: template }] : []);

		// wait for the existing Price List / Barcode rows to finish loading (edit mode) before
		// reading them - saving while that fetch is still in flight would read empty lists and
		// wipe out the item's existing rows instead of keeping them
		return Promise.all([this.price_editor.ready, this.barcode_editor.ready]).then(() => {
			const price_fields = this.price_editor.get_item_doc_fields();
			const barcode_fields = this.barcode_editor.get_item_doc_fields();
			// UOM conversions can come from the "Units of Measure" grid itself, from a Price
			// List row, or from a Barcode row - merge all three, the grid's own rows winning
			// on conflict since the user put them there directly.
			const uoms = {};
			[...price_fields.uoms, ...barcode_fields.uoms].forEach(
				(u) => (uoms[u.uom] = u.conversion_factor)
			);
			(this.dialog.doc.uoms || []).forEach((u) => (uoms[u.uom] = u.conversion_factor));

			set_child_table(
				this.dialog.doc,
				"uoms",
				Object.entries(uoms).map(([uom, conversion_factor]) => ({ uom, conversion_factor }))
			);
			set_child_table(this.dialog.doc, "barcodes", barcode_fields.barcodes);
			this.dialog.doc.quick_entry_prices = price_fields.quick_entry_prices;
			return super.insert();
		});
	}
};
