import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::project-version.project-version", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
