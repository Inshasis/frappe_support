const template = /*html*/ `
<div class="d-flex" style="flex-direction: column; height: 100%">
  <h3 class="mb-1 mt-0 text-xl font-bold">Your Tickets</h3>
  <p class="mb-3 text-muted small">You are logged in as {{ agent.email }}</p>
  <div class="d-flex justify-content-between">
    <div
      class="form-group frappe-control input-max-width"
      style="position: relative"
    >
      <input
        v-model="search_text"
        type="text"
        autocomplete="off"
        class="input-with-feedback form-control input-xs pl-8"
        placeholder="Search by title or site"
      />
      <svg
        class="icon icon-xs"
        style="
          position: absolute;
          top: 50%;
          left: 0.75rem;
          transform: translateY(-50%);
          z-index: 1;
        "
      >
        <use class="" href="#icon-search"></use>
      </svg>
    </div>
    <div class="d-flex">
      <div class="btn btn-default btn-sm btn-select-filter mr-3" style="height: fit-content">
        <select
          v-model="status_filter"
          style="border: none; background: transparent; outline: none"
        >
          <option value="Open" selected>Show Open</option>
          <option value="All">Show All</option>
          <option value="Close">Show Close</option>
        </select>
      </div>
      <div class="btn btn-default btn-sm btn-select-filter" style="height: fit-content">
        <select
          v-model="assignment_filter"
          style="border: none; background: transparent; outline: none"
        >
          <option value="me" selected>Assigned to me</option>
          <option value="all">Assigned to all</option>
        </select>
      </div>
    </div>
  </div>
  <div v-if="!agent.email" class="frappe-card p-0">
    <div class="text-center" style="padding: 5rem">Fetching...</div>
  </div>
  <div v-else-if="!tickets?.length" class="frappe-card p-0">
    <div class="text-center" style="padding: 5rem">No tickets found</div>
  </div>
  <div v-else class="frappe-card p-0" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden">
    <router-link
      v-for="ticket in tickets"
      :key="ticket.name"
      style="cursor: pointer"
      class='border-bottom'
      :to="{ name: 'ticket', params: { ticket: ticket.name } }"
    >
      <div class='d-flex justify-content-between p-3'>
          <div class="flex flex-col">
            <div class="flex items-center space-x-2">
              <div class="font-bold">{{ticket.subject}}</div>
              <span class='indicator-pill pull-right' :class=[ticket.indicator]>
                <span>{{ticket.status}}</span>
              </span>
            </div>
            <div class="flex items-center space-x-1">
              <span class="text-muted text-sm">{{ticket.name}}</span>
              <span>&#149;</span>
              <span class='text-muted text-sm' :title="ticket.creation">{{ticket.creation_from_now}}</span>
            </div>
          </div>
          <div class="d-flex items-center space-x-4">
            <div class="flex -space-x-0.5">
              <dd v-for="assignee in ticket.assignees" :key="assignee">
                <div class="h-8 w-8 rounded-full bg-green-50 ring-2 ring-white flex items-center justify-center text-sm uppercase" :title="assignee">
                  {{ assignee[0] }}
                </div>
              </dd>
            </div>
            <div class="text-sm space-x-1">
              <svg class="icon icon-sm text-muted">
                <use href="#icon-comment"></use>
              </svg>
              <span>{{ticket.comments.length}}</span>
            </div>
          </div>
      </div>
    </router-link>
  </div>
  <div class="mt-6 text-center space-x-1">
    <router-link :to="{ name: 'settings' }">Settings</router-link>
    <span>&#149;</span>
    <a href="#" @click.prevent.stop="logout">Logout</a>
  </div>
</div>
`;

const { reactive, toRefs, inject, computed } = Vue;
export default {
	name: "AgentTickets",
	template: template,

	setup() {
		const utils = inject("utils");
		const app = inject("app");

		const agent = computed(() => app.agent);
		const state = reactive({
			search_text: "",
			status_filter: "Open",
			assignment_filter: "me",
		});

		const tickets = computed(() => {
			if (!agent.value.tickets) return [];
			return agent.value.tickets
				.map((ticket) => {
					return {
						...ticket,
						status: utils.get_status(ticket.status),
						indicator: utils.get_indicator_color(ticket.status),
						creation_from_now: utils.get_time_ago(ticket.creation),
						assignees: JSON.parse(ticket._assign || "[]"),
						comments: JSON.parse(ticket._comments || "[]"),
					};
				})
				.filter((ticket) => {
					const conditions = [true];
					if (state.status_filter === "Open") {
						conditions.push(ticket.status !== "Closed");
					}
					if (state.status_filter === "Close") {
						conditions.push(ticket.status === "Closed");
					}
					if (state.assignment_filter === "me") {
						conditions.push(ticket.assignees.includes(agent.value.email));
					}
					return conditions.every(Boolean);
				});
		});

		return {
			agent,
			tickets,
			...toRefs(state),
			logout: () => app.logout(),
		};
	},
};
