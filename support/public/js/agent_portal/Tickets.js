const template = /*html*/ `
<div class="d-flex" style="flex-direction: column; height: 100%">
  <h3 class="mb-1 mt-0">Your Tickets</h3>
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
    </div>
  </div>
  <div v-if="!agent.email" class="frappe-card p-0">
    <div class="text-center" style="padding: 5rem">Fetching...</div>
  </div>
  <div v-else-if="!tickets?.length" class="frappe-card p-0">
    <div class="text-center" style="padding: 5rem">No tickets found</div>
  </div>
  <div v-else class="frappe-card p-0" style="flex-grow: 1; overflow-y: auto; overflow-x: hidden">
    <div
      v-for="ticket in tickets"
      :key="ticket.name"
      style="cursor: pointer"
      class='border-bottom'
      @click="open_ticket(ticket)"
    >
      <div class='d-flex justify-content-between p-3'>
          <div>
              <div class="h6">{{ticket.subject}}</div>
              <span class="text-muted">{{ticket.name}}</span> &#149;
              <span class='text-muted' :title="ticket.creation">{{ticket.creation_from_now}}</span>
          </div>
          <div class='d-flex flex-column align-items-end'>
              <span class='indicator-pill pull-right' :class=[ticket.indicator]>
                <span>{{ticket.status}}</span>
              </span>
              <span class='text-muted mt-1'>{{ticket.site_name}}</span>
          </div>
      </div>
    </div>
  </div>
  <div class="mt-6 text-center">
    <a href="#" @click="logout">Logout</a>
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

		const tickets = computed(() => {
			if (!agent.value.tickets) return [];
			return agent.value.tickets
				.filter((ticket) => {
					if (state.status_filter === "All") return true;
					return ticket.status === state.status_filter;
				})
				.map((ticket) => {
					return {
						...ticket,
						status: utils.get_status(ticket.status),
						indicator: utils.get_indicator_color(ticket.status),
						creation_from_now: utils.get_time_ago(ticket.creation),
					};
				});
		});
		const state = reactive({
			search_text: "",
			status_filter: "Open",
		});

		return {
			agent,
			tickets,
			...toRefs(state),
			logout: () => app.logout(),
			open_ticket: (ticket) => app.set_route("ticket", { ticket: ticket.name }),
		};
	},
};
