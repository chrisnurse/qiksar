/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */

// This helped us understand how to provide claims to Hasura...
// https://github.com/janhapke/hasura-keycloak

import { boot } from 'quasar/wrappers';
import QiksarAuthWrapper from 'src/qiksar/auth/QiksarAuthWrapper';
import { QiksarKeycloakWrapper } from 'src/qiksar/auth/QiksarKeycloakWrapper';
import { Router } from 'src/router';

// Set the auth wrapper to an instance of the Qiksar Keycloak wrapper
export const AuthWrapper:QiksarAuthWrapper = new QiksarKeycloakWrapper();

//----------------------------------------------------------------------------------------------------------------
//
// BOOT - Auth
//
// Initialise the authentication and authorisation system. This should not trigger a log in as they user
// may start on a landing page that does not require authentication.
//
// Tt is assumed that Quasar has initialised the global Router instance by running createRouter from src/router/index.ts
//
export default boot(async () => { 
  await AuthWrapper.Init();
  AuthWrapper.SetupRouterGuards(Router);
 });