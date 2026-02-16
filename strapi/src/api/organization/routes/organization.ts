import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::organization.organization", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
