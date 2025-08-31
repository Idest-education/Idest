import { User } from "@prisma/client";

export type AllUsers = {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
};
