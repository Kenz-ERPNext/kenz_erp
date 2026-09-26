// Transaction item row editor: shows the linked Item's Price List (frappe.kenz_erp.ItemPriceEditor)
// and Barcode (frappe.kenz_erp.ItemBarcodeEditor) grids inline in the row's expanded form, as two
// separate sections, instead of opening a second edit dialog on top of it. Changes save straight
// to the Item. Registered for every "* Item" child table where this was asked for - add more
// doctypes to the list below as needed.
const KENZ_ITEM_CHILD_DOCTYPES = [
	"Purchase Order Item",
	"Purchase Invoice Item",
	"Purchase Receipt Item",
	"Sales Order Item",
	"Sales Invoice Item",
	"Quotation Item",
	"Supplier Quotation Item",
	"Delivery Note Item",
	"Material Request Item",
	"Stock Entry Detail",
	"Stock Reconciliation Item",
	"POS Invoice Item",
	"Pick List Item",
];

// same markup/behaviour as a collapsible Section Break (Manufacture, Item Weight Details, ...)
// so it looks and behaves like the sections above it - full width, open by default.
function make_kenz_section(label, css_class) {
	const wrapper = $(`<div class="row form-section ${css_class}">
		<div class="section-head collapsible">
			${label}
			<span class="ml-2 collapse-indicator mb-1">${frappe.utils.icon("es-line-up", "sm", "mb-1")}</span>
		</div>
		<div class="section-body"></div>
	</div>`);

	wrapper.find(".section-head").on("click", function () {
		const body = wrapper.find(".section-body");
		const hide = !body.hasClass("hide");
		body.toggleClass("hide", hide);
		$(this).toggleClass("collapsed", hide);
		$(this)
			.find(".collapse-indicator")
			.html(frappe.utils.icon(hide ? "es-line-down" : "es-line-up", "sm", "mb-1"));
	});

	// .section-body is a flex row (like every form section); without a col-sm-12 span this
	// plain div would only be as wide as its own content instead of stretching to fill it.
	wrapper.body = $('<div class="col-sm-12"></div>').appendTo(wrapper.find(".section-body"));
	return wrapper;
}

function save_kenz_item(item_doc, price_editor, barcode_editor) {
	const price_fields = price_editor.get_item_doc_fields();
	const barcode_fields = barcode_editor.get_item_doc_fields();
	const uoms = {};
	[...price_fields.uoms, ...barcode_fields.uoms].forEach((u) => (uoms[u.uom] = u.conversion_factor));

	Object.assign(item_doc, {
		uoms: Object.entries(uoms).map(([uom, conversion_factor]) => ({ uom, conversion_factor })),
		barcodes: barcode_fields.barcodes,
		quick_entry_prices: price_fields.quick_entry_prices,
	});
	frappe.call({
		method: "frappe.client.save",
		args: { doc: item_doc },
		freeze: true,
		callback: (r) => {
			Object.assign(item_doc, r.message);
			frappe.show_alert({ message: __("Item updated"), indicator: "green" });
		},
	});
}

function mount_kenz_item_price_editor(frm, cdt, cdn) {
	const row = locals[cdt][cdn];
	const grid_row = frm.open_grid_row();
	const form_area = grid_row && grid_row.wrapper.find(".grid-form-body .form-area");
	if (!form_area || !form_area.length) return;

	const existing = form_area.find(".kenz-item-price-editor, .kenz-item-barcode-editor");
	if (!row.item_code) {
		existing.remove();
		return;
	}
	if (existing.length && existing.first().data("item_code") === row.item_code) return;
	existing.remove();

	const price_section = make_kenz_section(__("Item Price List"), "kenz-item-price-editor").data(
		"item_code",
		row.item_code
	);
	const barcode_section = make_kenz_section(__("Item Barcode"), "kenz-item-barcode-editor").data(
		"item_code",
		row.item_code
	);

	// insert right after the first section (Item Code / Item Name, ...) - this is a fieldname-
	// independent anchor, since the field before it differs across doctypes (Description,
	// description_section, or none at all on Sales Invoice Item). Sections sit a level or two
	// under form_area (via .form-layout / .form-page depending on the doctype), so this has to
	// be a descendant search, not form_area.children().
	const first_section = form_area.find(".form-section").first();
	if (first_section.length) {
		barcode_section.insertAfter(first_section);
		price_section.insertAfter(first_section);
	} else {
		barcode_section.prependTo(form_area);
		price_section.prependTo(form_area);
	}

	frappe.db.get_doc("Item", row.item_code).then((item_doc) => {
		if (price_section.data("item_code") !== item_doc.name) return; // row moved on before the fetch resolved

		const price_editor = new frappe.kenz_erp.ItemPriceEditor({
			get_stock_uom: () => item_doc.stock_uom,
			get_item_code: () => item_doc.name,
			on_change: () => save_kenz_item(item_doc, price_editor, barcode_editor),
		});
		const barcode_editor = new frappe.kenz_erp.ItemBarcodeEditor({
			get_stock_uom: () => item_doc.stock_uom,
			on_change: () => save_kenz_item(item_doc, price_editor, barcode_editor),
		});
		price_editor.make(price_section.body);
		barcode_editor.make(barcode_section.body);
		price_editor.load_from_item(item_doc);
		barcode_editor.load_from_item(item_doc);
	});
}

KENZ_ITEM_CHILD_DOCTYPES.forEach((doctype) => {
	frappe.ui.form.on(doctype, {
		form_render: mount_kenz_item_price_editor,
		item_code: mount_kenz_item_price_editor,
	});
});
