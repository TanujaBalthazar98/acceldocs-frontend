export default {
  routes: [
    {
      method: "POST",
      path: "/rpc/:name",
      handler: "api::rpc.rpc.invoke",
      config: {
        auth: {
          scope: ["authenticated"],
        },
      },
    },
  ],
};
