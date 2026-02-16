import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::project.project", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
