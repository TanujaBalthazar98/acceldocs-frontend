// import type { Core } from '@strapi/strapi';

export default {
  /**
   * An asynchronous register function that runs before
   * your application is initialized.
   *
   * This gives you an opportunity to extend code.
   */
  register(/* { strapi }: { strapi: Core.Strapi } */) {},

  /**
   * An asynchronous bootstrap function that runs before
   * your application gets started.
   *
   * This gives you an opportunity to set up your data model,
   * run jobs, or perform some special logic.
   */
  async bootstrap({ strapi }) {
    const roleQuery = strapi.query("plugin::users-permissions.role");
    const permissionQuery = strapi.query("plugin::users-permissions.permission");

    const publicRole = await roleQuery.findOne({ where: { type: "public" } });
    if (!publicRole) return;

    const actions = [
      "api::organization.organization.find",
      "api::organization.organization.findOne",
      "api::project.project.find",
      "api::project.project.findOne",
      "api::project-version.project-version.find",
      "api::project-version.project-version.findOne",
      "api::topic.topic.find",
      "api::topic.topic.findOne",
      "api::document.document.find",
      "api::document.document.findOne",
    ];

    for (const action of actions) {
      const existing = await permissionQuery.findOne({
        where: { role: publicRole.id, action },
      });

      if (existing) {
        if (!existing.enabled) {
          await permissionQuery.update({
            where: { id: existing.id },
            data: { enabled: true },
          });
        }
      } else {
        await permissionQuery.create({
          data: {
            action,
            role: publicRole.id,
            enabled: true,
          },
        });
      }
    }
  },
};
