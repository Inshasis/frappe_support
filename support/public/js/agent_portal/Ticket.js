const template = /*html*/ `
<div class="flex flex-col pb-10">
	<div class="mb-5 text-center">
		<a href="#" @click="back">← Back to all issues</a>
	</div>
	<div class="flex flex-col frappe-card p-0 flex-1">
		<div class="p-5 d-flex justify-content-between items-center">
			<div class="flex">
				<div class="flex flex-col">
					<div class="flex items-center space-x-2">
						<div class="font-bold text-lg text-gray-800">{{ticket.subject}}</div>
						<span class='indicator-pill pull-right' :class=[ticket.indicator]>
							<span>{{ticket.status}}</span>
						</span>
					</div>
					<div class="flex items-center space-x-1">
						<span class="text-muted text-sm">Raised by {{ticket.raised_by}}</span>
						<span>&#149;</span>
						<span class='text-muted text-sm'>{{ticket.site_name}}</span>
					</div>
				</div>
			</div>
			<div class="flex -space-x-0.5">
				<dd v-for="assignee in ticket.assignees" :key="assignee">
					<div class="h-8 w-8 cursor-default rounded-full bg-green-50 ring-2 ring-white flex items-center justify-center text-sm uppercase" :title="assignee">
						{{ assignee[0] }}
					</div>
				</dd>
				<button class="dropdown h-8 w-8 rounded-full bg-gray-100 btn btn-xs ring-2 ring-white flex items-center justify-center focus:ring-0" type="button" id="select-filter-dropdown" data-toggle="dropdown" aria-haspopup="true" aria-expanded="false">
					<svg class="icon icon-sm text-muted">
						<use href="#icon-edit"></use>
					</svg>
				</button>
				<div class="z-10 dropdown-menu dropdown-menu-right bg-white mt-2 divide-y divide-gray-100 rounded-md shadow-md w-48" role="menu" aria-labelledby="select-filter-dropdown" >
					<ul class="text-sm text-gray-700 overflow-scroll" style="max-height: 16rem">
						<li v-for="agent in agents" :key="agent.email">
							<div class="cursor-pointer rounded-md flex items-center justify-between px-3 py-1.5 hover:bg-gray-100" @click="assign(agent.email)">
								<span>{{ agent.email }}</span>
								<svg class="icon icon-xs text-gray-400 mx-0" v-if="ticket.assignees?.includes(agent.email)">
									<use href="#icon-check"></use>
								</svg>
							</div>
						</li>
					</ul>
				</div>
			</div>
		</div>
		<hr />
		<div class="issue-body p-5">
			<div
				ref="reply_content"
				contenteditable="true"
				class="form-control input-reply"
				style="min-height: 8rem; overflow: auto"
				placeholder="Add a reply..."
			></div>
			<div class="text-muted my-2" style="font-size: 14px;">
				To add images, drag and drop or copy+paste them in the description box
			</div>
			<div class="pt-2 d-flex justify-content-between align-items-center">
				<div>
					<button class="btn btn-sm small btn-reply" @click="reply">Reply</button>
				</div>
				
			</div>
		</div>
		<hr />
		<div class="flex flex-col replies flex-1 p-5 overflow-y-scroll overflow-x-hidden w-full">
			<div class="relative flex items-start space-x-3 pb-8 w-full" v-for='reply in ticket.replies' :key='reply.name'>
				<div class="relative">
					<div class="h-8 w-8 cursor-default rounded-full ring-2 ring-white flex items-center justify-center text-sm uppercase" :title="assignee" :class="reply.sent_or_received == 'Sent' ? 'bg-blue-50' : 'bg-green-50'">
						{{ reply.sender_full_name[0] }}
					</div>
				</div>
				<div class="min-w-0 flex-1 rounded-md border px-3 py-2">
					<div class="flex items-center space-x-1">
						<span class="font-medium text-gray-800 text-sm"> {{reply.sender_full_name}} </span>
						<span>&#149;</span>
						<span class='text-muted text-sm'> {{reply.creation_from_now}} </p>
					</div>
					<div class="text-sm text-gray-700">
						<p>{{reply.content}}</p>
					</div>
				</div>
			</div>
		</div>
	</div>
</div>
`;

const { reactive, toRefs, inject, computed, ref } = Vue;
export default {
	name: "Ticket",
	template: template,

	setup() {
		const utils = inject("utils");
		const app = inject("app");

		const agent = computed(() => app.agent);
		const ticket = frappe.utils.get_url_arg("ticket");

		const state = reactive({
			ticket: { name: ticket },
			agents: [],
		});

		utils.fetch_agents(app.session_key).then((agents) => {
			state.agents = agents;
		});

		utils
			.fetch_ticket(app.session_key, ticket)
			.then((ticket) => {
				state.ticket = ticket;
				state.ticket.indicator = utils.get_indicator_color(ticket.status);
				state.ticket.assignees = JSON.parse(ticket._assign || "[]");
				state.ticket.replies.forEach((reply) => {
					reply.bg_color =
						reply.sent_or_received == "Sent"
							? "var(--blue-50)"
							: "var(--gray-100)";
					reply.creation_from_now = utils.get_time_ago(reply.creation);
				});
				set_resolution_from_now();
			})
			.catch((err) => {
				console.log(err);
				if (err.message.includes("Invalid Session")) app.logout();
			});

		function set_resolution_from_now() {
			if (
				!state.ticket.resolution_by ||
				["Closed", "Resolved"].includes(state.ticket.status)
			) {
				return;
			}
			const diff = moment(state.ticket.resolution_by).diff(moment());
			if (diff >= 44500) {
				state.ticket.resolution_from_now = utils.get_time_ago(
					state.ticket.resolution_by
				);
			}
		}

		const reply_content = ref(null);
		function reply() {
			const content = reply_content.value.innerText;
			if (!content) return;
			utils
				.reply_to_ticket(app.session_key, ticket, content)
				.then((reply) => {
					console.log(reply);
					reply.bg_color = "var(--blue-50)";
					reply.creation_from_now = utils.get_time_ago(reply.creation);
					state.ticket.replies = [reply, ...state.ticket.replies];
					reply_content.value.innerText = "";
				})
				.catch((err) => {
					console.log(err);
					if (err.message.includes("Invalid Session")) app.logout();
				});
		}

		return {
			agent,
			reply_content,
			...toRefs(state),
			reply,
			back: () => app.set_route("tickets"),
			assign: (email) => {
				utils
					.toggle_assignee(app.session_key, ticket, email)
					.then((assignees) => {
						state.ticket.assignees = JSON.parse(assignees || "[]");
					});
			},
		};
	},
};
