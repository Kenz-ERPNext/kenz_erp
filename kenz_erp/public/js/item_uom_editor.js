frappe.provide("frappe.kenz_erp");

// Shared Units of Measure editor: its own "Add Row" list (UOM / Conversion Factor), independent
// of Price List and Barcode. This is the inline-row-editor equivalent of the native "uoms" grid
// in the Item Quick Entry (item_quick_entry.js uses the real Table field there since it's inside
// a Dialog with a doctype-loaded meta; the inline row editor has no such Dialog/Layout to host a
// native grid, so it gets the same card-list treatment as the other two lists).
frappe.kenz_erp.ItemUomEditor = class ItemUomEditor {
	constructor({ get_stock_uom, on_change }) {
		this.get_stock_uom = get_stock_uom;
		this.on_change = on_change || (() => {});
		this.uoms = [];
	}

	make(wrapper) {
		this.wrapper = $(wrapper).empty();
		$(`<button class="btn btn-xs btn-default kenz-add-uom">${__("Add Row")}</button>`)
			.on("click", () => this.edit_uom())
			.appendTo(this.wrapper);
		this.list_wrapper = $('<div class="kenz-uom-list mt-2"></div>').appendTo(this.wrapper);
		this.render();
		this.ready = Promise.resolve();
	}

	load_from_item(item_doc) {
		this.uoms = (item_doc.uoms || []).map((u) => ({
			uom: u.uom,
			conversion_factor: u.conversion_factor,
		}));
		this.render();
		return this.ready;
	}

	edit_uom(idx) {
		const row = idx === undefined ? {} : this.uoms[idx];
		const stock_uom = this.get_stock_uom();
		const dialog = new frappe.ui.Dialog({
			title: idx === undefined ? __("Add Row") : __("Edit Row"),
			fields: [
				{
					label: __("UOM"),
					fieldname: "uom",
					fieldtype: "Link",
					options: "UOM",
					reqd: 1,
					default: row.uom,
				},
				{
					label: __("Conversion Factor"),
					fieldname: "conversion_factor",
					fieldtype: "Float",
					reqd: 1,
					description: __("1 UOM = ? {0}", [stock_uom]),
					default: row.conversion_factor,
				},
			],
			primary_action_label: idx === undefined ? __("Add") : __("Update"),
			primary_action: (values) => {
				if (values.uom === stock_uom) {
					frappe.throw(__("{0} is already the item's stock UOM", [stock_uom]));
				}
				const uom_row = { uom: values.uom, conversion_factor: values.conversion_factor };
				const others = this.uoms.filter((u, i) => i !== idx);
				if (others.some((u) => u.uom === uom_row.uom)) {
					frappe.throw(__("UOM {0} is already added", [uom_row.uom]));
				}

				if (idx === undefined) this.uoms.push(uom_row);
				else this.uoms[idx] = uom_row;
				this.render();
				this.on_change(this.uoms);
				dialog.hide();
			},
		});
		dialog.show();
	}

	render() {
		if (!this.list_wrapper) return;
		this.list_wrapper.empty();
		const cards = this.uoms.map((u, idx) =>
			$(`<div class="border rounded p-2 mb-2 d-flex justify-content-between align-items-center">
				<div class="bold">${frappe.utils.escape_html(u.uom)}</div>
				<div class="d-flex align-items-center">
					<span class="bold mr-3">${frappe.utils.escape_html(String(u.conversion_factor))}</span>
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
				.on("click", "[data-action=edit]", () => this.edit_uom(idx))
				.on("click", "[data-action=delete]", () => {
					this.uoms.splice(idx, 1);
					this.render();
					this.on_change(this.uoms);
				})
		);
		this.list_wrapper.append(cards);
	}

	get_item_doc_fields() {
		return {
			uoms: this.uoms.map((u) => ({ uom: u.uom, conversion_factor: u.conversion_factor })),
		};
	}
};
