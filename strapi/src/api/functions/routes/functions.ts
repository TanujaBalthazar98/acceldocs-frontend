export default {
  routes: [
    {
      method: "POST",
      path: "/functions/:name",
      handler: "api::functions.functions.invoke",
      config: {
        auth: false,
      },
    },
  ],
};
