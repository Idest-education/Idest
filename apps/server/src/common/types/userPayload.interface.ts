import { Role } from "../enums/role.enum";

export interface userPayload{
    id: string;
    email: string;
    full_name: string;
    avatar: string;
    role: Role
}
