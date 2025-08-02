import { ArrayNotEmpty, IsArray, IsNumber } from "class-validator";

export class CreateUsersAllowRoleDto {
    @IsNumber()
    user_id: number;

    @IsArray()
    @ArrayNotEmpty()
    @IsNumber({}, {each: true})
    role_id: number[];
}
