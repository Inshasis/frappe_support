const template = /*html*/ `
	<div
		class="w-full bg-light"
		style="min-height: 100vh; height: 50rem;"
	>
		<section class="section section-padding bg-light h-full">
			<div class="container h-full" style="max-width: 50rem">
				<Login v-if="view === 'login'" />
				<Tickets v-if="view === 'tickets'" />
				<Ticket v-if="view === 'ticket'" />
				<Settings v-if="view === 'settings'" />
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

	add_agent(session_key, email) {
		return frappe
			.call({
				method: utils.get_api_url("add_agent"),
				args: { session_key, email },
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
		return frappe.call({
			method: utils.get_api_url("reply_to_ticket"),
			args: { session_key, issue_name: ticket, content },
		}).then((res) => res.message);
	},

	toggle_assignee(session_key, ticket, assignee) {
		return frappe.call({
			method: utils.get_api_url("toggle_assignee"),
			args: { session_key, issue_name: ticket, assignee },
		}).then((res) => res.message);
	},

	set_status(session_key, ticket, status) {
		return frappe.call({
			method: utils.get_api_url("set_status"),
			args: { session_key, issue_name: ticket, status },
		}).then((res) => res.message);
	}
};


const VIEW_TO_ROUTE = {
	ticket: "/support/portal/agent/tickets?ticket=",
	tickets: "/support/portal/agent/tickets",
	settings: "/support/portal/agent/settings",
	login: "/support/portal/agent",
};

function get_state_from_url() {
	const state = {}
	let view = "login";
	Object.keys(VIEW_TO_ROUTE).some((v) => {
		if (window.location.pathname.startsWith(VIEW_TO_ROUTE[v])) {
			view = v;
			return true;
		}
	});
	state.view = view;
	const session_key = frappe.utils.get_url_arg("key");
	session_key && utils.store_session_key(session_key);
	session_key && (state.session_key = session_key)

	const open_ticket = frappe.utils.get_url_arg("ticket");
	open_ticket && (state.open_ticket = open_ticket)
	return state;
}


import Login from "/assets/support/js/agent_portal/Login.js";
import Ticket from "/assets/support/js/agent_portal/Ticket.js";
import Tickets from "/assets/support/js/agent_portal/Tickets.js";
import Settings from "/assets/support/js/agent_portal/Settings.js";
const { reactive, toRefs, provide } = Vue;

export default {
	name: "AgentPortal",
	template: template,

	components: {
		Login,
		Tickets,
		Ticket,
		Settings,
	},

	setup() {
		provide("utils", utils);

		const state = reactive({
			initializing: true,
			view: "login",
			session_key: null,
			agent: {},
		});

		provide("app", state);

		state.set_route = function (view, args) {
			// set url without reloading
			let path = VIEW_TO_ROUTE[view];
			if (args) {
				const args_str = Object.keys(args)
					.map((key) => `${key}=${args[key]}`)
					.join("&");
				const base = path.split("?")[0];
				path = `${base}?${args_str}`;
			}
			window.history.pushState({}, "", path);

			state.view = view;
		};

		addEventListener("popstate", () => {
			route_based_on_url();
		});

		async function initialize() {
			if (!state.session_key) state.session_key = get_state_from_url().session_key;
			if (!state.session_key) state.session_key = utils.get_session_key();
			if (!state.session_key) {
				state.initializing = false;
				state.set_route("login");
				return;
			}

			utils
				.fetch_agent(state.session_key)
				.then((agent) => {
					state.agent = agent;
					state.initializing = false;
					route_based_on_url();
				})
				.catch((err) => {
					console.error(err);
					if (err.message.includes("Invalid Session")) state.logout();
				});
		}
		initialize();

		function route_based_on_url() {
			const url_state = get_state_from_url();
			state.view = url_state.view;
			state.open_ticket = url_state.open_ticket;
			if (state.open_ticket) {
				state.set_route("ticket", { ticket: state.open_ticket });
			} else {
				state.set_route(state.view);
			}
		}

		state.logout = function () {
			utils.store_session_key();
			utils.reload_window("/support/portal/agent");
		};

		return {
			...toRefs(state),
		};
	},
};
