import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { RpcException } from "@nestjs/microservices";
import { PrismaClient } from "@prisma/client";
import { LoginUserDto, RegisterUserDto } from "./dto";
import * as bcrypt from 'bcrypt';
import { JwtService } from "@nestjs/jwt";
import { envs } from "src/config";


@Injectable()
export class AuthService extends PrismaClient implements OnModuleInit {

    private readonly logger= new Logger("AuthService");

    constructor(private readonly jwtService: JwtService) {
        super();
    }


    onModuleInit() {
        this.$connect();
        this.logger.log("MongoDB connected");
    }
  // Implement your authentication logic here

    async signJWT(payload: any){
        return this.jwtService.sign(payload);
    }

    async verifyToken(token: string) {
        try {
            const {sub, iat, exp, ...user} = this.jwtService.verify(token, {
                secret: envs.jwtSecret
            });

            return {
                user: user,
                token: await this.signJWT(user),
            }
        } catch (error) {   
            this.logger.error("Error verifying JWT", error);
            throw new RpcException({
                status: 401,
                message: "Invalid token",
            });
        }
    }

    async registerUser(registerUserDto: RegisterUserDto) {
        try {
            const { email, name, password } = registerUserDto;

            // Check if user already exists
            const existingUser = await this.user.findUnique({ where: { email } });
            if (existingUser) {
                throw new RpcException({
                    status: 400,
                    message: "User already exists",
                });
            }

            const newUser = await this.user.create({
                data: {
                    email, name, 
                    password: bcrypt.hashSync(password, 10)
                }
            });

            const {password: __, ...rest } = newUser;

            return {
                user: rest,
                token: await this.signJWT({ sub: newUser.id, email: newUser.email, name: newUser.name })
            }

        } catch (error) {
            this.logger.error("Error registering user", error);
            throw new RpcException({
                status: 400,
                message: error.message || "Error registering user",
            });
            
        }
    }

    async loginUser(loginUserDto: LoginUserDto) {
        try {
            const { email, password } = loginUserDto;

            // Check if user already exists
            const existingUser = await this.user.findUnique({ where: { email } });
            if (!existingUser) {
                throw new RpcException({
                    status: 400,
                    message: "User not found",
                });
            }

            const ifPasswordValid = bcrypt.compareSync(password, existingUser.password);
            if (!ifPasswordValid) {
                throw new RpcException({    
                    status: 400,
                    message: "Invalid password",
                });
            }

            const {password: __, ...rest } = existingUser;

            return {
                user: rest,
                token:  await this.signJWT({ sub: existingUser.id, email: existingUser.email, name: existingUser.name })
            }

        } catch (error) {
            this.logger.error("Error registering user", error);
            throw new RpcException({
                status: 400,
                message: error.message || "Error registering user",
            });
            
        }
    }
}