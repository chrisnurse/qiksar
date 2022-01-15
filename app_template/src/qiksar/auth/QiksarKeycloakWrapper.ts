/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { Router as vueRouter } from 'vue-router';
import Keycloak, { KeycloakProfile } from 'keycloak-js';

import QiksarAuthWrapper from './QiksarAuthWrapper';
import User from './user';
import { CreateStore } from '../qikflow/store/GenericStore';
import Translator from '../Translator/Translator';
import TokenStore from '../Translator/TokenStore';

export class QiksarKeycloakWrapper implements QiksarAuthWrapper {

    //#region Properties

    // actual instance of keycloak
    private keycloak:Keycloak.KeycloakInstance;
  
    // The realm detected at login
    private realm = 'none specified';
    
    // Check for token refresh every 30 seconds
    private kc_token_check_seconds = (30*1000);
  
    // When token is checked, it must be valid for at least this amount of time, else it will be refreshed
    private kc_min_validity_seconds = 60;
  
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private tokenRefresh: any = null;
  
    private user:User = new User();
    private userStore:any;  
    
    //#endregion

    constructor () {
      if (!process.env.PUBLIC_AUTH_ENDPOINT) 
        throw 'PUBLIC_AUTH_ENDPOINT is not defined';
  
      const [ , , subdomain] = window.location.hostname.split('.').reverse();
      
      if(!subdomain || subdomain.length == 0)
        this.realm='app';
      else
        this.realm=subdomain;
      
      //console.log('Realm: >' + this.realm + '<');
  
      // Configuration details for REALM and CLIENT
      const kc_config: Keycloak.KeycloakConfig = {
        url: process.env.PUBLIC_AUTH_ENDPOINT,
        realm: this.realm,
        clientId: 'app-client'
      }
  
      // Create a keycloak instance
       this.keycloak = Keycloak(kc_config);
  
       if(!this.keycloak)
        throw 'Qiksar Initialisation Error: Keycloak did not initialise';
    }
    
    //#region getters

    get User():User {
      return this.user;
    }

    // Check if user is authenticated
    IsAuthenticated():boolean {
      return (this.keycloak.authenticated || false) ? true : false;
    }

    // Get authorisation token from keycloak
    GetAuthToken():string {
      //console.log(keycloak.token);
      return this.keycloak.token ?? 'unauthenticated';
    }
  
    // Test if the  user has a specified role
    HasRealmRole(roleName:string | undefined): boolean {
      const hasRole = this.keycloak.hasRealmRole(roleName ?? '');
      
      //console.log('HasRealmRole: ' + (roleName ?? 'none') + ' = ' + hasRole.toString());
    
      return hasRole;
    }

    // Get the full host URL and append the destination path in order to form a redirect URI
    private getRedirectTarget(path:string):string {
      let basePath:string = window.location.toString();
      let index:number = basePath.indexOf('//') + 2;
    
      while (index < basePath.length && basePath[index] != '/')
        index ++;
  
      basePath = basePath.substr(0, index + 1) + path;
    
      return basePath;
    }
  
        // Get Keycloak user profile
    async GetUserProfile():Promise<User> {
      let kc_profile: KeycloakProfile = {};
  
      if (this.IsAuthenticated()) {
        await this
        .keycloak
        .loadUserProfile()
        .then((p: KeycloakProfile) => {
            kc_profile = p;
            })
        .catch((e) => {
            console.error('!!!! Failed to load user profile');
            console.error(JSON.stringify(e));
          });
      }

      const piniaStore = CreateStore('members');
      const where =`user_id: {_eq: "${this.keycloak.subject ?? ''}"}`;
      const user_rows = await piniaStore.fetchWhere(where);
      let locale_setting = '';

      if(piniaStore.hasRecord) {
        const user = user_rows[0];
        locale_setting = user['locale_id'] as string;
      } 
      else {
        
        const new_user = {
          user_id: this.keycloak.subject ?? '',
          email:kc_profile.email,
          mobile:'123456789',
          firstname: kc_profile.firstName ?? '',
          lastname: kc_profile.lastName ?? '',
          locale_id: process.env.DEFAULT_LOCALE,
          status_id: 'active',
          role_id: 'member'
        }

        const inserted_user = await piniaStore.add(new_user);

        if(!piniaStore.hasRecord) {
          throw 'Failed to insert new user profile';
        }
        
        locale_setting = process.env.DEFAULT_LOCALE ?? '';
        
        console.log('INSERTED USER:')
        console.log(JSON.stringify(inserted_user))
      }

      const user_profile: User = {
        auth_id: this.keycloak.subject ?? '',
        realm: this.realm,
        username: kc_profile.username ?? '',
        email: kc_profile.email ?? '',
        emailVerified: kc_profile.emailVerified ?? false,
        firstname: kc_profile.firstName ?? '',
        lastname: kc_profile.lastName ?? '',
        roles: this.GetUserRoles(),
        locale: locale_setting,
        lastLogin: '',
      };

      console.log('CURRENT USER AUTHID: ' + user_profile.auth_id );
      console.log('CURRENT USER LOCALE: ' + this.user.locale);

      // Import the locale for the user
      await import('src/domain/i18n/' + this.user.locale)
      .then((module) => {
        //console.log('Loaded : ' + JSON.stringify(module.default))
        Translator.InitInstance(this.user, module.default, new TokenStore());
      });
    
      return user_profile;
    }
  
    GetUserRoles():string[] {
      return this.keycloak.realmAccess?.roles ?? []
    }
  
    //#endregion

    //#region Auth Lifecycle

    async Init(userStore:any):Promise<void> {
      
      this.userStore = userStore;

      // Initialisation options
      const kc_init_options: Keycloak.KeycloakInitOptions = {
        // onLoad: 'login-required',
        checkLoginIframe: false 
      }
  
      await this
            .keycloak
            .init(kc_init_options)
            .then(async (auth_result) => { await this.AuthComplete(auth_result); }) 
      }

    // The login flow is executed
    Login(path: string): void {
      const redirectUri= this.getRedirectTarget(path);
      const options: Keycloak.KeycloakLoginOptions = { redirectUri }
    
      void this
        .keycloak
        .login(options)
        .then(async () => { await this.AuthComplete(true) });
    }
  
    // The current user will be logged out
    Logout() {
      this.userStore.$reset();
      void this.keycloak.logout();
    }
  
    // Triggered when authentication is completed
    async AuthComplete(auth: boolean):Promise<void> { 
      if (auth) {

        const profile = await this.GetUserProfile();
        this.userStore.setUser(profile);
        this.userStore.setLoggedIn(this.IsAuthenticated());

        if(this.tokenRefresh)
          clearTimeout(this.tokenRefresh);
    
        this.tokenRefresh = setInterval(
          () => {
            if(this.keycloak) {
                this
                .keycloak
                .updateToken(this.kc_min_validity_seconds)
                .catch(e => {
                  console.error('Token refresh failed');
                  console.error('Exception: ' + JSON.stringify(e));
                });
              }
            },
    
          this.kc_token_check_seconds);
        }
    }

    //#endregion

    //#region Router

    SetupRouterGuards(router: vueRouter):void {
          
      router.beforeEach((to, from, next) => {
        const required_role: string = <string>to.meta.role ?? 'unauthorized';
        const allow_anonymous: boolean = <boolean>to.meta.anonymous ?? false;

        if (allow_anonymous) {
          // Page doesn't require auth
          next();
        } else if (!this.IsAuthenticated()) {
          // User must be logged in
          this.Login(to.path);
        } else if (this.HasRealmRole(required_role)) {
          // User must have at least the default role
          next();
        } else {
          next({ path: '/unauthorized' });
        }
      });
    }

    //#endregion

  }