frappe.call(
	"support.www.support.portal.get_site_options",
	{ key: localStorage.getItem("support-key") },
	(r) => {
		if (r.message) {
			let site_list = r.message.map((site) => {
				return `<option value="${site}">${site}</option>`;
			});
			$(".input-site").html(site_list);
		}
	}
);

$(".btn-submit").on("click", () => {
	let args = {
		subject: $(".input-subject").val(),
		sitename: $(".input-site").val(),
		description: $(".input-description").html(),
		key: localStorage.getItem("support-key"),
		ref_doc: $(".ref-doctype").val(),
		ref_module: $(".ref-module").val(),
		ref_name: $(".ref-docname").val(),
	};

	if (!args.subject || !args.description || !args.sitename) {
		frappe.toast("Please fill all the mandatory fields.");
		return;
	}

	$(".btn-submit").prop("disabled", true);

	frappe
		.call("support.www.support.portal.create_issue", args)
		.then((r) => {
			$(".btn-submit").prop("disabled", false);
			if (r.message) {
				frappe.toast("Issue Raised");
				window.location.href = `/support/portal/issue/${r.message}`;
			} else {
				frappe.toast("Failed to raise the issue");
			}
		})
		.catch(() => $(".btn-submit").prop("disabled", false));
});
