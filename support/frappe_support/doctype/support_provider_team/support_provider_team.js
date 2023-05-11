// Copyright (c) 2023, developers@frappe.io and contributors
// For license information, please see license.txt

frappe.ui.form.on("Support Provider Team", {
	setup(frm) {
		frm.fields_dict.members.grid.get_field('user').get_query = function(doc, cdt, cdn) {
			return {
				query: "frappe.core.doctype.user.user.user_query",
				filters: {ignore_user_type: 1}
			}
		}
	}
});
