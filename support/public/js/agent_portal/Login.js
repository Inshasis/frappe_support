const template = /*html*/ `
  <div class="frappe-card p-5">
    <div v-if="!loginLinkSent">
      <h3 class="mb-3 mt-0">Agent Login</h3>
      <p class="mb-3">
        Welcome to Frappe Support, to manage your assigned tickets, please login
        with your email id.
      </p>
      <div class="d-flex">
        <input
          v-model="email"
          autocomplete="on"
          class="form-control input-email"
          placeholder="Enter your email id"
          style="max-width: 20rem"
        />
        <button
          class="start-btn btn btn-primary btn-validate btn-sm ml-2"
          @click="send_login_link"
          :disabled="!verify_email() || sending"
        >
          Login
        </button>
      </div>
      <p class="text-muted small pl-2 pt-1">
        We will send you a login link to your email id
      </p>
    </div>
    <div v-else>
      <h3 class="mb-1 mt-0">Login Link Sent</h3>
      <div class="alert alert-info small mt-3 mb-0">
        Please check your inbox for a confirmation email
      </div>
    </div>
  </div>
`;

const { reactive, toRefs, inject } = Vue;
export default {
	name: "AgentPortalLogin",
	template: template,

	setup() {
		const state = reactive({
			email: "",
			loginLinkSent: false,
			sending: false,
		});

		function verify_email() {
			const regex = /\S+@\S+\.\S+/;
			return regex.test(state.email);
		}

		const utils = inject("utils");
		async function send_login_link() {
			if (!verify_email()) {
				frappe.show_alert("Please enter a valid email address");
				return;
			}
			state.sending = true;
			await utils.send_login_link(state.email);
			state.sending = false;
			state.loginLinkSent = true;
		}

		const app = inject("app");
		const router = inject("router");
		if (app.session_key) {
			router.push({ name: "tickets" });
		}

		return {
			...toRefs(state),
			send_login_link,
			verify_email,
		};
	},
};
