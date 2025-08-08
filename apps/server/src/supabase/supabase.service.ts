import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly client: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceRoleKey) {
      throw new Error(
        'Supabase is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY',
      );
    }

    this.client = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  get authAdmin() {
    return this.client.auth.admin;
  }

  async inviteUserByEmail(email: string, metadata?: Record<string, any>) {
    const { data, error } = await this.authAdmin.inviteUserByEmail(email, {
      data: metadata,
    });
    if (error) throw error;
    return data.user;
  }
}
