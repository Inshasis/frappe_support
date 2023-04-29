const template = /*html*/ `
<div class="d-flex" style="flex-direction: column; height: 100%">
	<div class="mb-5 text-center">
		<a href="#" @click="back">← Back to all issues</a>
	</div>
	<div class="frappe-card p-0">
		<div class="support-header px-5 pt-5 d-flex justify-content-between">
			<div class="flex">
				<div>
					<h5 class="subject pr-2 mb-1" style="font-weight: bold">{{ ticket.subject }}</h5>
					<div class="sla-info text-muted small mb-0">Expected to be resolved {{ ticket.resolution_from_now }}</div>
					<div class="raised-by-info text-muted small mb-0">Raised by: {{ ticket.raised_by }}</div>
				</div>
			</div>
			<div
				style="
					min-width: 10rem;
					display: flex;
					flex-direction: column;
					align-items: end;
				"
			>
				<div
					class="indicator-pill mb-1 float-right"
					:class="ticket.indicator"
					style="max-width: fit-content"
				>
					<span class="status"> {{ ticket.status }} </span>
				</div>
				<div
					class="text-muted issue-name text-right"
					style="margin-top: 1px"
				>
					{{ ticket.name }}
				</div>
			</div>
		</div>
		<hr />
		<div class="thread">
			<div class="issue-body px-5 pb-5">
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
					<div class="text-muted site-name text-right">{{ ticket.site_name }}</div>
				</div>
			</div>
			<div class="replies px-5">
				<div class='reply py-3'
					v-for='reply in ticket.replies'
					:key='reply.name'
				>
					<div class='py-2' style='font-weight: 800;'>{{reply.sender_full_name}}</div>
					<span class='pull-right text-muted small' style="margin-top: -1.8rem" :title="reply.creation">
						{{ reply.creation_from_now }}
					</span>
					<div class='reply-card p-3 rounded' :style="{ backgroundColor: reply.bg_color }">{{reply.content}}</div>
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
			ticket: {
				name: ticket,
			},
		});

		utils
			.fetch_ticket(app.session_key, ticket)
			.then((ticket) => {
				state.ticket = ticket;
				state.ticket.indicator = utils.get_indicator_color(ticket.status);
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
		};
	},
};
