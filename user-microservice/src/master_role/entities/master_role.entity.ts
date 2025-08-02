import { Entity, PrimaryGeneratedColumn, Column, OneToMany, ManyToMany } from "typeorm";
import { UsersAllowRole } from "../../users_allow_role/entities/users_allow_role.entity";
import { Users } from "../../users/entities/user.entity";

@Entity('master_role')
export class MasterRole {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true})
    role_name: string;

    @OneToMany(() => UsersAllowRole, userRole => userRole.role)
    userRole: UsersAllowRole[];

    @ManyToMany(() => Users, user => user.role)
    userAllowRole: Users[];
}
