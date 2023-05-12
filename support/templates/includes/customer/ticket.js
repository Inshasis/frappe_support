issue_name = window.location.href.split("/").slice(-1)[0];
key = localStorage.getItem("support-key");

function validate_session() {
  if (!key) {
    frappe.msgprint("Please login to view this page");
    window.location.href = "/support/portal/customer";
    return;
  }
  return frappe.call(
    "support.www.support.portal.validate_session_key",
    { key: key },
    (r) => !r.message && (window.location.href = "/support/portal/customer")
  );
}
function load_ticket() {
  frappe.call(
    "support.www.support.portal.get_ticket",
    { issue: issue_name, key: key },
    (r) => {
      if (!r.message || r.message.error) {
        frappe.msgprint(r.message.error || "Invalid ticket");
        window.location.href = "/support/portal/customer";
        return;
      }
      update_html(r.message);
      set_sla(r.message);
      set_replies(r.message);
    }
  );
}
validate_session().then(() => load_ticket());

function update_html(issue) {
  $(".issue-name").html(issue.name);
  $(".subject").html(issue.subject);
  $(".status").html(issue.status);
  $(".site-name").html(issue.site_name);
  $(".raised-by-info").html(`Raised by: ${issue.raised_by}`);
  $(".indicator-pill").addClass(issue.indicator);
  issue.state == "Closed" && $(".issue-body").addClass("hidden");
}
function set_replies(issue) {
  for (let r of issue.replies) {
    let creation = moment(r.creation).fromNow();
    let bg_color = "bg-gray-100";
    if (r.sent_or_received == "Sent") {
      r.sender_full_name = "Support Agent";
      bg_color = "bg-blue-50";
    }
    $(`<div class='reply py-3'>
				<div class='py-2' style='font-weight: 800;'>${r.sender_full_name}</div>
				<span class='pull-right text-muted small' style="margin-top: -1.8rem" title="${r.creation}">
					${creation}
				</span>
				<div class='reply-card p-3 rounded ${bg_color}'>${r.content}</div>
			</div>`).appendTo(".replies");
  }
}

function set_sla(issue) {
  if (!issue.resolution_by || ["Closed", "Resolved"].includes(issue.status)) {
    return;
  }
  const diff = moment(issue.resolution_by).diff(moment());
  if (diff >= 44500) {
    $(".sla-info").html(
      `Expected to be resolved ${moment(issue.resolution_by).fromNow()}`
    );
  }
}

let get_args = (validate = true) => {
  if (validate && !$(".input-reply").text()) {
    frappe.toast({ message: "Please add a reply", indicator: "red" });
    return;
  }
  let args = {
    issue: $(".issue-name").html(),
    subject: $(".subject").html(),
    content: $(".input-reply").html(),
    key: localStorage.getItem("support-key"),
  };
  return args;
};

$(".btn-reply").on("click", () => {
  let args = get_args();
  if (args) {
    frappe.call("support.www.support.portal.reply", args, (data) => {
      // refresh replies
      $(".input-reply").empty();
      $(".replies").empty();
      set_replies({ replies: data.message });
    });
  }
});

$(".btn-close").on("click", () => get_stars());

function get_stars() {
  frappe.msgprint(`
			<p>Please give a rating</p>
			<p class='stars' style='font-size: 1.5rem; cursor:pointer;'>
				<span class='star' data-value='1'>✩</span>
				<span class='star' data-value='2'>✩</span>
				<span class='star' data-value='3'>✩</span>
				<span class='star' data-value='4'>✩</span>
				<span class='star' data-value='5'>✩</span>
			</p>
			<p>
				<button class='btn btn-sm btn-primary btn-submit-close'>Submit</button>
			</p>
	`);

  $("body").on("click", ".star", (e) => {
    let star = parseInt($(e.target).attr("data-value"));
    let stars = $(".stars .star").html("✩");
    for (let i = 1; i < star + 1; i++) {
      $(`.star[data-value='${i}']`).html("✭");
    }
    frappe.support_rating = star;
  });

  $("body").on("click", ".btn-submit-close", () => {
    let args = get_args(false);
    // check if rating is given
    if (!frappe.support_rating) {
      return frappe.toast("Please give a rating");
    }
    args.support_rating = frappe.support_rating;
    frappe.call("support.www.support.portal.close_issue", args, () => {
      window.location.reload();
    });
  });
}
