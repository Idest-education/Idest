import { Role } from "../enum/role.enum";

export interface userPayload{
    id: string;
    email: string;
    avatar: string;
    role: Role
}
