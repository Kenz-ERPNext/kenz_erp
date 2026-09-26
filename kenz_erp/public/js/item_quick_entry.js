frappe.provide("frappe.ui.form");

// Item quick entry: 3 column layout with item tax template, opening stock and a price list
// (UOM, price list, rate, barcode per row). Price list rows become Item Prices in
// kenz_erp.kenz_erp.item_quick_entry, everything else is saved on the Item directly.
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

			section("Opening Stock", 1),
			"opening_stock",
			column(),
			"valuation_rate",
			column(),

			section("Price List"),
			{
				label: __("Add Price"),
				fieldname: "quick_entry_add_price",
				fieldtype: "Button",
				click: () => this.edit_price(),
			},
			{
				fieldname: "quick_entry_prices_html",
				fieldtype: "HTML",
			},
		];
		const used = new Set(layout.filter((f) => typeof f === "string"));

		// other mandatory / quick entry fields (e.g. from customizations) go at the end of the first section
		const others = this.mandatory.filter((f) => f.fieldname && !used.has(f.fieldname));
		const first_section_end = layout.indexOf("asset_category") + 1;
		layout.splice(first_section_end, 0, ...others.map((f) => f.fieldname));

		this.mandatory = layout.map((f) => (typeof f === "string" ? df[f] : f)).filter(Boolean);
		this.prices = [];
		super.render_dialog();
		this.render_prices();
	}

	edit_price(idx) {
		const row = idx === undefined ? {} : this.prices[idx];
		const stock_uom = this.dialog.get_value("stock_uom");
		const price_dialog = new frappe.ui.Dialog({
			title: idx === undefined ? __("Add Price") : __("Edit Price"),
			fields: [
				{
					label: __("Item Code"),
					fieldname: "item_code",
					fieldtype: "Data",
					read_only: 1,
					default: this.dialog.get_value("item_code"),
				},
				{ fieldname: "stock_uom", fieldtype: "Data", hidden: 1, default: stock_uom },
				{
					label: __("UOM"),
					fieldname: "uom",
					fieldtype: "Link",
					options: "UOM",
					reqd: 1,
					default: row.uom || stock_uom,
				},
				{
					label: __("Conversion Factor"),
					fieldname: "conversion_factor",
					fieldtype: "Float",
					description: __("1 UOM = ? {0}", [stock_uom]),
					depends_on: "eval:doc.uom && doc.uom != doc.stock_uom",
					mandatory_depends_on: "eval:doc.uom && doc.uom != doc.stock_uom",
					default: row.conversion_factor,
				},
				{
					label: __("Price List"),
					fieldname: "price_list",
					fieldtype: "Link",
					options: "Price List",
					reqd: 1,
					get_query: () => ({ filters: { enabled: 1 } }),
					default: row.price_list,
				},
				{
					label: __("Rate"),
					fieldname: "rate",
					fieldtype: "Currency",
					reqd: 1,
					default: row.rate,
				},
				{
					label: __("Barcode"),
					fieldname: "barcode",
					fieldtype: "Data",
					default: row.barcode,
				},
			],
			primary_action_label: idx === undefined ? __("Add") : __("Update"),
			primary_action: (values) => {
				const price = {
					uom: values.uom,
					conversion_factor: values.uom === stock_uom ? 1 : values.conversion_factor,
					price_list: values.price_list,
					rate: values.rate,
					barcode: values.barcode,
				};
				const others = this.prices.filter((p, i) => i !== idx);
				if (price.barcode && others.some((p) => p.barcode === price.barcode)) {
					frappe.throw(__("Barcode {0} is already added", [price.barcode]));
				}
				if (others.some((p) => p.uom === price.uom && p.price_list === price.price_list)) {
					frappe.throw(
						__("{0} price for {1} is already added", [price.price_list, price.uom])
					);
				}
				if (
					others.some(
						(p) =>
							p.uom === price.uom && p.conversion_factor !== price.conversion_factor
					)
				) {
					frappe.throw(
						__("UOM {0} is already added with a different conversion factor", [
							price.uom,
						])
					);
				}

				if (idx === undefined) this.prices.push(price);
				else this.prices[idx] = price;
				this.render_prices();
				price_dialog.hide();
			},
		});
		price_dialog.show();
	}

	render_prices() {
		const wrapper = $(this.dialog.fields_dict.quick_entry_prices_html.wrapper).empty();
		const cards = this.prices.map((p, idx) =>
			$(`<div class="border rounded p-2 mb-2 d-flex justify-content-between align-items-center">
				<div>
					<div class="bold">${frappe.utils.escape_html(p.barcode || __("No Barcode"))}</div>
					<div class="text-muted small">
						${frappe.utils.escape_html(p.uom)} · ${frappe.utils.escape_html(p.price_list)}
					</div>
				</div>
				<div class="d-flex align-items-center">
					<span class="bold mr-3">${format_currency(p.rate)}</span>
					<button class="btn btn-xs btn-default mr-1" data-action="edit">${frappe.utils.icon(
						"edit",
						"xs"
					)}</button>
					<button class="btn btn-xs btn-default" data-action="delete">${frappe.utils.icon(
						"delete",
						"xs"
					)}</button>
				</div>
			</div>`)
				.on("click", "[data-action=edit]", () => this.edit_price(idx))
				.on("click", "[data-action=delete]", () => {
					this.prices.splice(idx, 1);
					this.render_prices();
				})
		);
		wrapper.append(cards);
	}

	insert() {
		// Item Tax Template is a child table on Item, add the selected template as its row
		const template = this.dialog.get_value("quick_entry_item_tax_template");
		this.dialog.doc.taxes = template ? [{ item_tax_template: template }] : [];
		delete this.dialog.doc.quick_entry_item_tax_template;

		// Price list rows: UOM conversions and barcodes go on the Item, prices are created after insert
		const uoms = {};
		this.prices
			.filter((p) => p.uom !== this.dialog.doc.stock_uom)
			.forEach((p) => (uoms[p.uom] = p.conversion_factor));
		this.dialog.doc.uoms = Object.entries(uoms).map(([uom, conversion_factor]) => ({
			uom,
			conversion_factor,
		}));
		this.dialog.doc.barcodes = this.prices
			.filter((p) => p.barcode)
			.map((p) => ({ barcode: p.barcode, uom: p.uom }));
		this.dialog.doc.quick_entry_prices = JSON.stringify(
			this.prices.map((p) => ({ uom: p.uom, price_list: p.price_list, rate: p.rate }))
		);
		return super.insert();
	}
};
