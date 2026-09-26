frappe.provide("frappe.kenz_erp");

// Shared UOM / Price List editor: the "Add Price" grid used by both the Item Quick Entry
// (item_quick_entry.js) and the inline editor on transaction item rows
// (item_child_table_price_editor.js), so editing an item's prices looks and behaves the same
// everywhere. Barcodes are a separate list - see item_barcode_editor.js.
frappe.kenz_erp.ItemPriceEditor = class ItemPriceEditor {
	constructor({ get_stock_uom, get_item_code, on_change }) {
		this.get_stock_uom = get_stock_uom;
		this.get_item_code = get_item_code;
		this.on_change = on_change || (() => {});
		this.prices = [];
	}

	make(wrapper) {
		this.wrapper = $(wrapper).empty();
		this.add_button = $(`<button class="btn btn-xs btn-default kenz-add-price">${__("Add Price")}</button>`)
			.on("click", () => this.edit_price())
			.appendTo(this.wrapper);
		this.list_wrapper = $('<div class="kenz-price-list mt-2"></div>').appendTo(this.wrapper);
		this.render();
		// resolves once there is nothing left to load - get_item_doc_fields() must not run before
		// this, or it would save an empty/partial list and wipe out the item's existing rows
		this.ready = Promise.resolve();
	}

	load_from_item(item_doc) {
		const stock_uom = item_doc.stock_uom;
		const conversion_by_uom = {};
		(item_doc.uoms || []).forEach((u) => (conversion_by_uom[u.uom] = u.conversion_factor));

		this.add_button.prop("disabled", true);
		this.ready = frappe.db
			.get_list("Item Price", {
				filters: { item_code: item_doc.name },
				fields: ["uom", "price_list", "price_list_rate"],
				limit: 0,
			})
			.then((rows) => {
				this.prices = rows.map((row) => {
					const uom = row.uom || stock_uom;
					return {
						uom,
						conversion_factor: uom === stock_uom ? 1 : conversion_by_uom[uom],
						price_list: row.price_list,
						rate: row.price_list_rate,
					};
				});
				this.render();
			})
			.finally(() => this.add_button.prop("disabled", false));
		return this.ready;
	}

	edit_price(idx) {
		const row = idx === undefined ? {} : this.prices[idx];
		const stock_uom = this.get_stock_uom();
		const price_dialog = new frappe.ui.Dialog({
			title: idx === undefined ? __("Add Price") : __("Edit Price"),
			fields: [
				{
					label: __("Item Code"),
					fieldname: "item_code",
					fieldtype: "Data",
					read_only: 1,
					default: this.get_item_code(),
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
			],
			primary_action_label: idx === undefined ? __("Add") : __("Update"),
			primary_action: (values) => {
				const price = {
					uom: values.uom,
					conversion_factor: values.uom === stock_uom ? 1 : values.conversion_factor,
					price_list: values.price_list,
					rate: values.rate,
				};
				const others = this.prices.filter((p, i) => i !== idx);
				if (others.some((p) => p.uom === price.uom && p.price_list === price.price_list)) {
					frappe.throw(
						__("{0} price for {1} is already added", [price.price_list, price.uom])
					);
				}
				if (
					others.some(
						(p) => p.uom === price.uom && p.conversion_factor !== price.conversion_factor
					)
				) {
					frappe.throw(
						__("UOM {0} is already added with a different conversion factor", [price.uom])
					);
				}

				if (idx === undefined) this.prices.push(price);
				else this.prices[idx] = price;
				this.render();
				this.on_change(this.prices);
				price_dialog.hide();
			},
		});
		price_dialog.show();
	}

	render() {
		if (!this.list_wrapper) return;
		this.list_wrapper.empty();
		const cards = this.prices.map((p, idx) =>
			$(`<div class="border rounded p-2 mb-2 d-flex justify-content-between align-items-center">
				<div>
					<div class="bold">${frappe.utils.escape_html(p.price_list)}</div>
					<div class="text-muted small">${frappe.utils.escape_html(p.uom)}</div>
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
					this.render();
					this.on_change(this.prices);
				})
		);
		this.list_wrapper.append(cards);
	}

	get_item_doc_fields() {
		const stock_uom = this.get_stock_uom();
		const uoms = {};
		this.prices.filter((p) => p.uom !== stock_uom).forEach((p) => (uoms[p.uom] = p.conversion_factor));
		return {
			uoms: Object.entries(uoms).map(([uom, conversion_factor]) => ({ uom, conversion_factor })),
			quick_entry_prices: JSON.stringify(
				this.prices.map((p) => ({ uom: p.uom, price_list: p.price_list, rate: p.rate }))
			),
		};
	}
};
