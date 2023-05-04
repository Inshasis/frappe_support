const template = /*html*/ `
<div v-if="app" class="d-flex" style="flex-direction: column; height: 100%">
	<div class="mb-5 text-center">
		<a href="#" @click="back">← Back to all issues</a>
	</div>
	<div class="flex justify-between items-center">
  	<h3 class="mb-3 mt-0 text-xl font-bold">Manage Agents</h3>
		<a href="#" class="text-sm flex items-center space-x-1" @click="show_add_agent_modal">
			<svg class="icon icon-xs text-muted">
				<use href="#icon-add"></use>
			</svg>
			<span>Add Agent</span>
		</a>
	</div>
	<div v-if="!agents.length" class="frappe-card p-0">
		<div class="text-center" style="padding: 5rem">Fetching...</div>
	</div>
	<div v-else class="frappe-card p-0 w-full" style="overflow-y: auto; overflow-x: hidden; min-height: 16rem">
		<div
			v-for="agent in agents"
			:key="agent.name"
			style="cursor: pointer"
			class='border-bottom'
		>
			<div class='d-flex p-3 items-center space-x-2'>
				<div class="h-8 w-8 rounded-full bg-green-50 ring-2 ring-white flex items-center justify-center text-sm uppercase" :title="agent.full_name">
					{{ agent.full_name[0] }}
				</div>
				<span class="font-bold text-sm">{{agent.full_name}}</span>
				<span class="text-muted text-sm">{{agent.email}}</span>
				<span class='ml-auto indicator-pill pull-right' :class="[agent.disabled ? 'red' : 'green']">
					<span>{{agent.disabled ? 'Disabled' : 'Active'}}</span>
				</span>
				<button class="dropdown h-8 w-8 rounded-md hover:bg-gray-100 flex items-center justify-center focus:ring-0 focus:outline-none" type="button" id="agent-dropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
					<svg class="icon icon-sm text-muted">
						<use href="#icon-dot-horizontal"></use>
					</svg>
				</button>
				<div class="z-10 dropdown-menu dropdown-menu-right bg-white mt-2 divide-y divide-gray-100 rounded-md shadow-md w-32" role="menu" aria-labelledby="agent-dropdown" >
					<ul class="text-sm text-gray-700 overflow-scroll" style="max-height: 16rem">
						<li class="cursor-pointer rounded-md flex items-center justify-between px-3 py-1.5 hover:bg-gray-100" @click="disable_agent(agent)">
							{{ agent.disabled ? 'Enable' : 'Disabled' }}
						</li>
						<li class="cursor-pointer rounded-md flex items-center justify-between px-3 py-1.5 hover:bg-gray-100" @click="remove_agent(agent)">
							Remove
						</li>
					</ul>
				</div>
			</div>
		</div>
	</div>
</div>
`;

const { reactive, toRefs, inject } = Vue;
export default {
	name: "Settings",
	template: template,

	setup() {
		const utils = inject("utils");
		const app = inject("app");

		const state = reactive({
			agents: [],
		});

		utils.fetch_agents(app.session_key).then((agents) => {
			state.agents = agents;
		});

		function show_add_agent_modal() {
			const dialog = frappe.msgprint(
				`<div class="form-group">
					<div class="clearfix">
						<label class="text-sm" style="padding-right: 0px;">First Name</label>
					</div>
					<div class="control-input-wrapper mb-4">
						<div class="control-input">
							<input type="text" autocomplete="off" class="firstname-input input-with-feedback form-control" maxlength="140" data-fieldtype="Data" data-fieldname="firstname" placeholder="eg. John">
						</div>
					</div>
					<div class="clearfix">
						<label class="text-sm" style="padding-right: 0px;">Last Name</label>
					</div>
					<div class="control-input-wrapper mb-4">
						<div class="control-input">
							<input type="text" autocomplete="off" class="lastname-input input-with-feedback form-control" maxlength="140" data-fieldtype="Data" data-fieldname="lastname" placeholder="eg. Doe">
						</div>
					</div>
					<div class="clearfix">
						<label class="text-sm" style="padding-right: 0px;">Email</label>
					</div>
					<div class="control-input-wrapper mb-4">
						<div class="control-input">
							<input type="text" autocomplete="off" class="email-input input-with-feedback form-control" maxlength="140" data-fieldtype="Data" data-fieldname="email" placeholder="eg. user@example.com">
						</div>
					</div>
				</div>
				<div class="flex justify-end">
					<button type="button" class="btn btn-primary btn-sm add-btn">Add</button>
				</div>`,
				"Add Agent"
			);

			dialog.$wrapper.find(".add-btn").on("click", () => {
				const email = dialog.$wrapper.find(".email-input").val();
				const firstname = dialog.$wrapper.find(".firstname-input").val();
				const lastname = dialog.$wrapper.find(".lastname-input").val();
				if (!email || !firstname || !lastname) {
					frappe.toast("All fields are required.");
					return;
				}
				const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
				if (!email_regex.test(email)) {
					frappe.toast("Invalid Email");
					return;
				}
				const new_agent = { email, firstname, lastname };
				utils.add_agent(app.session_key, new_agent).then((agent) => {
					if (!agent) return;
					state.agents.push(agent);
					dialog.hide();
				});
			});
		}

		function disable_agent(agent) {
			utils.disable_agent(app.session_key, agent.email).then(() => {
				agent.disabled = !agent.disabled;
			});
		}

		function remove_agent(agent) {
			utils.remove_agent(app.session_key, agent.email).then(() => {
				state.agents = state.agents.filter((a) => a.email !== agent.email);
			});
		}

		return {
			app,
			back: () => app.set_route("tickets"),
			show_add_agent_modal,
			disable_agent,
			remove_agent,
			...toRefs(state),
		};
	},
};
