/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { RouteRecordRaw } from 'vue-router';
import EntitySchema from 'src/qiksar/qikflow/base/EntitySchema';

/**
 * This method generates a set of routes for viewing and editing a specific entity
 *
 * @param entityName Name of the entity
 * @param requiredRole Role required to access the route
 * @returns Route record comprising the path to the view and edit pages
 */
function getRoutesForEntity(
  entityName: string,
  requiredRole: string
): RouteRecordRaw[] {
  return [
    {
      meta: { role: requiredRole },
      path: `/${entityName}`,
      component: () => import('src/qiksar/qikflow/ui/EntityList.vue'),
      props: { entity_type: entityName },
    },
    {
      meta: { role: requiredRole },
      path: `/${entityName}/edit/:id`,
      component: () => import('src/qiksar/qikflow/ui/EntityEdit.vue'),
      props: (route: any) => {
        const props = {
          context: {
            entity_type: entityName,
            entity_id: route.params.id as string,
            real_time: true,
          },
        };

        return props;
      },
    },
  ];
}

/**
 *
 * @returns Return
 */
export default function getEntityRoutes(): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = [];

  EntitySchema.Schemas.map((s: EntitySchema) => {
    getRoutesForEntity(s.EntityName, 'tenant_admin').map(r => routes.push(r));
  });

  return routes;
}