email = frappe.utils.get_url_arg("email");
email && $(".input-email").val(email);

$(".btn-register").on("click", () => {
  $(".btn-register").prop("disabled", true);
  let args = {
    email: $(".input-email").val(),
    name: $(".input-name").val(),
    company: $(".input-company").val(),
    site: $(".input-site").val(),
  };
  if (!(args.company && args.site && args.name)) {
    return frappe.toast("All fields are mandatory.");
  }
  frappe.call(
    "support.www.support.portal.validate_user",
    { email: args.email, site: args.site },
    (r) => {
      if (!r.valid) {
        frappe.call("support.www.support.portal.register_user", args, (r) => {
          $(".register").addClass("hidden");
          $(".register-complete").removeClass("hidden");
          const key = localStorage.getItem("support-key");
          key &&
            frappe.call("support.www.support.portal.delete_session_key", {
              key,
            });
        });
      } else {
        frappe.toast({
          message: `You are already registered on ${args.site}`,
          indicator: "orange",
        });
        $(".btn-register").prop("disabled", false);
      }
    }
  );
});
