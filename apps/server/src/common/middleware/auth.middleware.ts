import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { NextFunction } from "express";
import * as JWT from "jsonwebtoken"

@Injectable()
export class AuthMiddleware implements NestMiddleware {
    use(req: Request,res: Response, next: NextFunction){
        const authHeader = req.headers['authorization']
        if(!authHeader) throw "Authorization Required";
        if(!authHeader.startsWith('Bearer ')) throw "Authorization Tampered"
        const token = authHeader.split(' ')[1];
        const jwtSecret = process.env.JWTSECRET;
        const decoded = JWT.verify(token, jwtSecret);
        req['user'] = decoded;
        next()
    } catch(e:string){
        throw new UnauthorizedException(e)
    }
}