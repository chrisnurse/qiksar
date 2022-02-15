import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { Http2ServerRequest } from 'http2';
import { Roles, Unprotected } from 'nest-keycloak-connect';

import AuthService from '../auth/auth.service';
import TenantService from './tenant.service';

@Controller({ path: 'tenant' })
export default class TenantController {
  constructor(private readonly tenantService: TenantService, private readonly authService: AuthService) {}

  /*
  @Get('/public')
  @Unprotected()
  getPublic(): string {
    return `${this.tenantService.getHello()} the public method`;
  }
  */

  /**
   * Create a user
   *
   * @param req incoming request
   * @param admin indicates if the user is to be an admin
   * @param username unique login id of the user
   * @param password initial password for the user
   * @param email email address of the user
   * @param firstname first name of the user
   * @param lastname last name of the user
   * @returns uuid of the user assigned by the auth server
   */
  @Post('create_user')
  @Roles({ roles: ['realm:tenant_admin'] })
  async createUser(
    @Req() req: Http2ServerRequest,
    @Body('admin') admin: boolean,
    @Body('username') username: string,
    @Body('password') password: string,
    @Body('email') email: string,
    @Body('firstname') firstname: string,
    @Body('lastname') lastname: string,
  ): Promise<Record<string, any>> {
    const token = this.authService.tokenFromRequest(req);
    const decoded = this.authService.decodeToken(token);

    // Realm is implicit, it is the same realm as the calling user
    const realm = decoded['https://hasura.io/jwt/claims']['x-hasura-realm-id'];
    const locale = decoded['locale'];

    const user = await this.authService.createUser(admin, realm, username, password, locale, email, firstname, lastname, token);

    return { userid: user };
  }
}
