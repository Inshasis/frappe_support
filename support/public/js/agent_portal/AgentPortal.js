const template = /*html*/ `
	<div
		class="w-full bg-light"
		style="min-height: 100vh; height: 50rem;"
	>
		<section class="section section-padding bg-light h-full">
			<div class="container h-full" style="max-width: 50rem">
				<component
					v-if="router.route.name"
					:is="router.route.component"
					v-bind="router.route.props"
				/>
			</div>
		</section>
	</div>
`;

const BASE = "support.www.support.portal.agent";
const utils = {
	get_api_url: (method) => `${BASE}.${method}`,
	reload_window: (location) => (window.location.href = location),
	get_time_ago: (date) => moment(date).fromNow(),
	get_status: (status) => {
		return status == "Closed"
			? "Closed"
			: ["Awaiting Reply", "Replied"].includes(status)
			? "Awaiting Reply"
			: "Open";
	},
	get_indicator_color: (status) => {
		return status == "Open"
			? "red"
			: status == "Awaiting Reply"
			? "yellow"
			: "green";
	},

	store_session_key: (value) => {
		!value && localStorage.removeItem("support-agent-key");
		value && localStorage.setItem("support-agent-key", value);
	},
	get_session_key: () => localStorage.getItem("support-agent-key"),

	validate_session_key(session_key) {
		return frappe.call({
			method: utils.get_api_url("login"),
			args: { session_key: session_key },
		});
	},

	send_login_link(email) {
		return frappe.call({
			method: utils.get_api_url("send_login_link"),
			args: { email },
		});
	},

	fetch_agent(session_key) {
		return frappe
			.call({
				method: utils.get_api_url("get_agent"),
				args: { session_key },
			})
			.then((res) => res.message);
	},

	add_agent(session_key, new_agent) {
		return frappe
			.call({
				method: utils.get_api_url("add_agent"),
				args: { session_key, new_agent },
			})
			.then((res) => res.message);
	},

	remove_agent(session_key, email) {
		return frappe
			.call({
				method: utils.get_api_url("remove_agent"),
				args: { session_key, email },
			})
			.then((res) => res.message);
	},

	disable_agent(session_key, email) {
		return frappe
			.call({
				method: utils.get_api_url("disable_agent"),
				args: { session_key, email },
			})
			.then((res) => res.message);
	},

	fetch_agents(session_key) {
		return frappe
			.call({
				method: utils.get_api_url("get_agents"),
				args: { session_key },
			})
			.then((res) => res.message);
	},

	fetch_ticket(session_key, ticket) {
		return frappe
			.call({
				method: utils.get_api_url("get_ticket"),
				args: { session_key, issue_name: ticket },
			})
			.then((res) => res.message);
	},

	reply_to_ticket(session_key, ticket, content) {
		return frappe
			.call({
				method: utils.get_api_url("reply_to_ticket"),
				args: { session_key, issue_name: ticket, content },
			})
			.then((res) => res.message);
	},

	toggle_assignee(session_key, ticket, assignee) {
		return frappe
			.call({
				method: utils.get_api_url("toggle_assignee"),
				args: { session_key, issue_name: ticket, assignee },
			})
			.then((res) => res.message);
	},

	set_status(session_key, ticket, status) {
		return frappe
			.call({
				method: utils.get_api_url("set_status"),
				args: { session_key, issue_name: ticket, status },
			})
			.then((res) => res.message);
	},
};

function get_session_key() {
	const session_key = frappe.utils.get_url_arg("key");
	session_key && utils.store_session_key(session_key);
	return session_key || utils.get_session_key();
}

import useRouter from "/assets/support/js/agent_portal/useRouter.js";
const { reactive, toRefs, provide, defineAsyncComponent } = Vue;

const routes = [
	{
		name: "ticket",
		path: "/support/portal/agent/ticket?:ticket",
		props: ["ticket"],
		component: defineAsyncComponent(() =>
			import("/assets/support/js/agent_portal/Ticket.js")
		),
	},
	{
		path: "/support/portal/agent/tickets",
		name: "tickets",
		component: defineAsyncComponent(() =>
			import("/assets/support/js/agent_portal/Tickets.js")
		),
	},
	{
		path: "/support/portal/agent/settings",
		name: "settings",
		component: defineAsyncComponent(() =>
			import("/assets/support/js/agent_portal/Settings.js")
		),
	},
	{
		path: "/support/portal/agent",
		name: "login",
		component: defineAsyncComponent(() =>
			import("/assets/support/js/agent_portal/Login.js")
		),
	},
	{
		path: "/support/portal/agent/logout",
		name: "logout",
		component: defineAsyncComponent(() =>
			import("/assets/support/js/agent_portal/Logout.js")
		),
	},
];

export default {
	name: "AgentPortal",
	template: template,

	setup() {
		const router = useRouter(routes);
		const state = reactive({
			initializing: true,
			session_key: null,
			agent: {},
		});

		provide("app", state);
		provide("utils", utils);
		provide("router", router);

		async function initialize() {
			state.session_key = get_session_key();
			if (!state.session_key) {
				state.initializing = false;
				router.push({ name: "login" });
				return;
			}

			utils
				.fetch_agent(state.session_key)
				.then((agent) => {
					state.agent = agent;
					state.initializing = false;
					router.push({ name: router.route.name });
				})
				.catch((err) => {
					console.error(err);
					if (err.message.includes("Invalid Session")) state.logout();
				});
		}
		initialize();

		state.logout = function () {
			state.session_key = null;
			utils.store_session_key();
			router.push({ name: "login" });
		};

		return { ...toRefs(state), router };
	},
};
