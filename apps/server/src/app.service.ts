import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from './supabase/supabase.service';

@Injectable()
export class AppService {
  constructor(private readonly supabaseService: SupabaseService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getDevJwt(secretPassword: string): Promise<{ access_token: string }> {
    const email = process.env.SUPABASE_DEV_EMAIL;
    const password = process.env.SUPABASE_DEV_PASSWORD;

    if (!email || !password) {
      throw new InternalServerErrorException(
        'Missing SUPABASE_DEV_EMAIL or SUPABASE_DEV_PASSWORD. Contact Lucki for help.',
      );
    }

    if(secretPassword !== process.env.SECRET_PASS) {
      throw new ForbiddenException('You Don\'t Have Access To This Endpoint');
    }

    const { data, error } = await this.supabaseService.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new InternalServerErrorException(
        `Authentication failed: ${error.message}. Contact Lucki for help.`,
      );
    }

    return { access_token: data.session.access_token };
  }
}
