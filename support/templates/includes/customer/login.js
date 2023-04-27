let key = frappe.utils.get_url_arg("key");
key && localStorage.setItem("support-key", key);

if (localStorage.getItem("support-key")) {
  frappe.call(
    "support.www.support.portal.validate_session_key",
    { key: localStorage.getItem("support-key") },
    (r) => {
      if (r.message) {
        window.location.href = "/support/portal/customer/issues";
      }
    }
  );
}

$(".btn-validate").on("click", () => {
  $(".btn-validate").prop("disabled", true);
  let email = $(".input-email").val();

  if (!email) {
    frappe.toast({
      message: "Please enter your email id.",
      indicator: "orange",
    });
    $(".btn-validate").prop("disabled", false);
    return;
  }
  if (email && !frappe.utils.validate_type(email, "email")) {
    frappe.toast({
      message: "Please enter a valid email id.",
      indicator: "orange",
    });
    $(".btn-validate").prop("disabled", false);
    return;
  }
  frappe.call(
    "support.www.support.portal.send_session_key",
    { email: email },
    (r) => {
      $(".start-btn").prop("disabled", true);
      if (r.message) {
        $(".start").addClass("hidden");
        $(".valid").removeClass("hidden");
      } else {
        window.location.href = `/support/portal/customer/register?email=${email}`;
      }
    }
  );
});
