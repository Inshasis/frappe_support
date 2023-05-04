// eg. <router-link :to="{ name: 'logout' }">Logout</router-link>

const template = /*html*/ `
	<a :href="$props.to" @click.prevent.stop="navigate">
		<slot></slot>
	</a>
`;

const { inject } = Vue;
export default {
	name: "RouterLink",
	template: template,
	props: { to: Object },
	setup(props) {
		const router = inject("router");
		function navigate() {
			router.push(props.to);
		}
		return { navigate };
	},
};
