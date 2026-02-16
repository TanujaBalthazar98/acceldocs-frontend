import { factories } from "@strapi/strapi";

export default factories.createCoreRouter("api::document.document", {
  config: {
    find: { auth: false },
    findOne: { auth: false },
  },
});
