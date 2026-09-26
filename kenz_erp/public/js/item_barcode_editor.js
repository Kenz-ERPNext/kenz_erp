frappe.provide("frappe.kenz_erp");

// same Select options as ERPNext's Item Barcode child doctype (barcode_type field)
const KENZ_BARCODE_TYPES = [
	"",
	"EAN",
	"UPC-A",
	"CODE-39",
	"EAN-12",
	"EAN-8",
	"GS1",
	"GTIN",
	"ISBN",
	"ISBN-10",
	"ISBN-13",
	"ISSN",
	"JAN",
	"PZN",
	"UPC",
].join("\n");

// Shared Barcode editor: its own "Add Barcode" list (Barcode / Barcode Type / UOM), independent
// of the Price List (item_price_editor.js) - a barcode doesn't need a price and a price doesn't
// need a barcode. Used by both the Item Quick Entry (item_quick_entry.js) and the inline editor
// on transaction item rows (item_child_table_price_editor.js).
frappe.kenz_erp.ItemBarcodeEditor = class ItemBarcodeEditor {
	constructor({ get_stock_uom, on_change }) {
		this.get_stock_uom = get_stock_uom;
		this.on_change = on_change || (() => {});
		this.barcodes = [];
	}

	make(wrapper) {
		this.wrapper = $(wrapper).empty();
		$(`<button class="btn btn-xs btn-default kenz-add-barcode">${__("Add Barcode")}</button>`)
			.on("click", () => this.edit_barcode())
			.appendTo(this.wrapper);
		this.list_wrapper = $('<div class="kenz-barcode-list mt-2"></div>').appendTo(this.wrapper);
		this.render();
		// resolves once there is nothing left to load - kept for symmetry with ItemPriceEditor,
		// whose own get_item_doc_fields() must not run before ITS load finishes (see its .ready).
		this.ready = Promise.resolve();
	}

	load_from_item(item_doc) {
		const stock_uom = item_doc.stock_uom;
		const conversion_by_uom = {};
		(item_doc.uoms || []).forEach((u) => (conversion_by_uom[u.uom] = u.conversion_factor));
		this.barcodes = (item_doc.barcodes || []).map((b) => {
			const uom = b.uom || stock_uom;
			return {
				barcode: b.barcode,
				barcode_type: b.barcode_type,
				uom,
				conversion_factor: uom === stock_uom ? 1 : conversion_by_uom[uom],
			};
		});
		this.render();
		return this.ready;
	}

	edit_barcode(idx) {
		const row = idx === undefined ? {} : this.barcodes[idx];
		const stock_uom = this.get_stock_uom();
		const dialog = new frappe.ui.Dialog({
			title: idx === undefined ? __("Add Barcode") : __("Edit Barcode"),
			fields: [
				{
					label: __("Barcode"),
					fieldname: "barcode",
					fieldtype: "Data",
					reqd: 1,
					default: row.barcode,
				},
				{
					label: __("Barcode Type"),
					fieldname: "barcode_type",
					fieldtype: "Select",
					options: KENZ_BARCODE_TYPES,
					default: row.barcode_type,
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
			],
			primary_action_label: idx === undefined ? __("Add") : __("Update"),
			primary_action: (values) => {
				const barcode = {
					barcode: values.barcode,
					barcode_type: values.barcode_type,
					uom: values.uom,
					conversion_factor: values.uom === stock_uom ? 1 : values.conversion_factor,
				};
				const others = this.barcodes.filter((b, i) => i !== idx);
				if (others.some((b) => b.barcode === barcode.barcode)) {
					frappe.throw(__("Barcode {0} is already added", [barcode.barcode]));
				}
				if (
					others.some(
						(b) => b.uom === barcode.uom && b.conversion_factor !== barcode.conversion_factor
					)
				) {
					frappe.throw(
						__("UOM {0} is already added with a different conversion factor", [barcode.uom])
					);
				}

				if (idx === undefined) this.barcodes.push(barcode);
				else this.barcodes[idx] = barcode;
				this.render();
				this.on_change(this.barcodes);
				dialog.hide();
			},
		});
		dialog.show();
	}

	render() {
		if (!this.list_wrapper) return;
		this.list_wrapper.empty();
		const cards = this.barcodes.map((b, idx) =>
			$(`<div class="border rounded p-2 mb-2 d-flex justify-content-between align-items-center">
				<div>
					<div class="bold">${frappe.utils.escape_html(b.barcode)}</div>
					<div class="text-muted small">
						${frappe.utils.escape_html(b.uom)}${
				b.barcode_type ? " · " + frappe.utils.escape_html(b.barcode_type) : ""
			}
					</div>
				</div>
				<div class="d-flex align-items-center">
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
				.on("click", "[data-action=edit]", () => this.edit_barcode(idx))
				.on("click", "[data-action=delete]", () => {
					this.barcodes.splice(idx, 1);
					this.render();
					this.on_change(this.barcodes);
				})
		);
		this.list_wrapper.append(cards);
	}

	get_item_doc_fields() {
		const stock_uom = this.get_stock_uom();
		const uoms = {};
		this.barcodes
			.filter((b) => b.uom !== stock_uom)
			.forEach((b) => (uoms[b.uom] = b.conversion_factor));
		return {
			uoms: Object.entries(uoms).map(([uom, conversion_factor]) => ({ uom, conversion_factor })),
			barcodes: this.barcodes.map((b) => ({
				barcode: b.barcode,
				barcode_type: b.barcode_type,
				uom: b.uom,
			})),
		};
	}
};
