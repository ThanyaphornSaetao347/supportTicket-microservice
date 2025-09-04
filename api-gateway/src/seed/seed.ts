import { DataSource, In } from "typeorm";
import * as bcrypt from 'bcrypt';
import { Users } from "../users/entities/user.entity";
import { UserAllowRole } from "../user_allow_role/entities/user_allow_role.entity";

// กำหนดการเชื่อมต่อ DB แบบง่าย
const AppDataSource = new DataSource({
    type: 'postgres',
    host: 'localhost',
    port: 5432,
    username: 'postgres',
    password: 'thanya7746',
    database: 'db_support_ticket',
    entities: [__dirname + '/../../../**/*.entity.{ts,js}'],
    synchronize: false,
    logging: false, 
});

async function seed() {
    try {
        await AppDataSource.initialize();
        console.log('✅ Database connected');

        const userRepo = AppDataSource.getRepository(Users);
        const uarRepo = AppDataSource.getRepository(UserAllowRole);

        const existingAdmin = await userRepo.findOne({ where: { username: 'admin' } });
        if (existingAdmin) {
            console.log('⚠️ Admin user already exists. Skipping creation.');
        }

        const hashedPassword = await bcrypt.hash('admin1234', 10);
        const adminUser = userRepo.create({
            username: 'admin',
            password: hashedPassword,
            email: 'admin@example.com',
            firstname: 'Admin',
            lastname: 'KTW',
            phone: '0999999996',
            create_by: 1,
            update_by: 1
        });

        const savedAdmin = await userRepo.save(adminUser);
        console.log('✅ Admin user created successfully:', savedAdmin);

        const roles = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
        const roleEntities = roles.map(role => uarRepo.create({
            user_id: savedAdmin.id,
            role_id: role
        }));
        console.log('Role entities to save:', roleEntities);

        const existingRoles = await uarRepo.findOne({
            where: {
                user_id: savedAdmin.id,
                role_id: In(roles)  // import { In } from 'typeorm'
            }
        });

        if (existingRoles) {
            console.log('⚠️ Admin user already has some roles assigned. Skipping creation.');
            process.exit(0);
        }

        await uarRepo
            .createQueryBuilder()
            .insert()
            .into(UserAllowRole)
            .values(roleEntities)
            .execute();

        console.log('✅ Role assigned to admin user');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding error:', error);
        process.exit(1);
    }
}
seed();