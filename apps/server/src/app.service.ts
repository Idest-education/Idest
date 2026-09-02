import { ForbiddenException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { SupabaseService } from './supabase/supabase.service';

@Injectable()
export class AppService {
  constructor(private readonly supabaseService: SupabaseService) {}



  async getDevJwt(secretPassword: string): Promise<{ access_token: string }> {
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('This endpoint is disabled in production');
    }

    const expected = process.env.SECRET_PASS ?? '';
    const provided = secretPassword ?? '';
    const a = Buffer.from(provided);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException("You don't have access to this endpoint");
    }

    const email = process.env.SUPABASE_DEV_EMAIL;
    const password = process.env.SUPABASE_DEV_PASSWORD;

    if (!email || !password) {
      throw new InternalServerErrorException(
        'Missing SUPABASE_DEV_EMAIL or SUPABASE_DEV_PASSWORD. Contact Lucki for help.',
      );
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
