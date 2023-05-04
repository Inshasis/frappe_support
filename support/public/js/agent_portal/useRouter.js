const { reactive } = Vue;

export default function router(routes) {
	function get_props(path) {
		const query_string = path?.split("?")[1] || window.location.search;
		return query_string
			? Object.fromEntries(new URLSearchParams(query_string))
			: null;
	}

	function get_current_route() {
		return routes.find((route) => {
			const path = window.location.pathname;
			const base_path = route.path.split("?")[0];
			const regex = new RegExp(`^${base_path}$`);
			return regex.test(path);
		});
	}
	const current_route = get_current_route();
	const state = reactive({
		name: current_route.name,
		props: get_props(window.location.pathname),
		component: current_route.component,
	});

	function push({ name, params }) {
		const matching_routes = routes.filter((route) => route.name === name);
		if (!matching_routes.length)
			throw new Error(`Route not found: ${name} ${path}`);

		// check if there is a query string
		let route = undefined;
		if (params) {
			route = matching_routes.find(
				(route) =>
					route.props?.length &&
					Object.keys(params).every((key) => route.props.includes(key))
			);
		}
		if (!route) route = matching_routes[0];

		const base_path = route.path.split("?")[0];
		const url = params
			? `${base_path}?${new URLSearchParams(params)}`
			: base_path;
		window.history.pushState({}, "", url);
		state.name = route.name;
		state.props = params;
		state.component = route.component;
	}

	window.addEventListener("popstate", () => {
		const currentRoute = get_current_route();
		state.name = currentRoute.name;
		state.props = get_props(window.location.pathname);
		state.component = currentRoute.component;
	});

	return {
		route: state,
		push,
	};
}
