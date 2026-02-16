import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::topic.topic", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
