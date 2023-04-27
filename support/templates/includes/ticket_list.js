let args = {};
args.key = localStorage.getItem("support-key");

if (args.key == null) {
	frappe.toast("Session Expired");
	window.location.href = "/support/portal";
}

// ?show=Open or ?show=All
let open_or_close = frappe.utils.get_url_arg("show");
open_or_close && $(".btn-filter-text").html(`Show ${open_or_close}`);
args.open_or_close = open_or_close || "";

if (args.key) {
	get_issues(args);
}

$(".input-search").change(function () {
	args.search_text = $(".input-search").val();
	get_issues(args);
	args.open_or_close = open_or_close;
});

$(".link-logout").on("click", () => {
	localStorage.removeItem("support-key");
	frappe.call("support-logout", args, (r) => {
		if (r.deleted === "True") {
			window.location.href = "/support/portal";
			frappe.toast("You are logged out.");
		} else {
			frappe.toast("Log out failed.");
		}
	});
});

function get_issues(args) {
	frappe.call("support.www.support.portal.get_issues", args, (r) => {
		if (r.message.error == "Invalid Session") {
			frappe.toast("Invalid Session");
			window.location.href = "/support/portal";
			return;
		}

		if (r.message.error === "Disabled") {
			$(".new-issue").addClass("disabled");
			return frappe.msgprint(
				"Your Support has been disabled. Please renew to continue using the Frappe Support."
			);
		}

		$(".issues").empty();
		r.message.email && $(".user-email").html(r.message.email);
		if (!r.message.issues.length) {
			return $(`<div class="section-padding text-center">
                <img src="/assets/frappe/images/ui-states/list-empty-state.svg" 
                    alt="Generic Empty State" class="null-state" 
                    style="height: 60px; display: block; margin: auto;">
                <div class='pt-4'>No Open issues found</div>
            </div>`).appendTo($(".issues"));
		}
		for (let i of r.message.issues) {
			i.status =
				i.status == "Closed"
					? "Closed"
					: ["Awaiting Reply", "Replied"].includes(i.status)
					? "Awaiting Reply"
					: "Open";
			i.indicator =
				i.status == "Open"
					? "red"
					: i.status == "Awaiting Reply"
					? "yellow"
					: "green";
			$(`<div class='border-bottom'>
                  <div class='d-flex justify-content-between p-3'>
                      <div>
                          <a href="/support/portal/issue/${i.name}">
                              <div class="h6">${i.subject}</div>
                          </a>
                          <span class="text-muted">${i.name}</span> &#149;
                          <span class='text-muted' title="${i.creation}">
                              ${moment(i.creation).fromNow()}
                          </span>
                      </div>
                      <div class='d-flex flex-column align-items-end'>
                          <span class='indicator-pill pull-right ${
														i.indicator
													}'>
                              <span>${i.status}</span>
                          </span>
                          <span class='text-muted mt-1'>
                              ${i.site_name}
                          </span>
                      </div>
                  </div>
              </div>`).appendTo($(".issues"));
		}
	});
}
