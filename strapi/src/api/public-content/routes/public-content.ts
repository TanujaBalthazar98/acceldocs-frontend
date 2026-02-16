export default {
  routes: [
    {
      method: "GET",
      path: "/public-content",
      handler: "api::public-content.public-content.get",
      config: {
        auth: false,
      },
    },
  ],
};
