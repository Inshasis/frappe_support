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
		const utils = inject("utils");

		const state = reactive({
			email: "",
			loginLinkSent: false,
		});

		async function send_login_link() {
			await utils.send_login_link(state.email);
			state.loginLinkSent = true;
		}

		return {
			...toRefs(state),
			send_login_link,
		}
	},
};
