import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1752651255981 implements MigrationInterface {
    name = 'InitialMigration1752651255981'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."ticket_notification_notification_type_enum" AS ENUM('new_ticket', 'status_change', 'assignment')`);
        await queryRunner.query(`CREATE TABLE "ticket_notification" ("id" SERIAL NOT NULL, "ticket_no" character varying NOT NULL, "user_id" integer NOT NULL, "status_id" integer, "notification_type" "public"."ticket_notification_notification_type_enum" NOT NULL, "title" character varying NOT NULL, "message" text, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP, "email_sent" boolean NOT NULL DEFAULT false, "email_sent_at" TIMESTAMP, "create_date" TIMESTAMP NOT NULL DEFAULT now(), "update_date" TIMESTAMP NOT NULL DEFAULT now(), "ticket_id" integer, CONSTRAINT "PK_d9ab85d30ed976f2041328eae7a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "ticket_status_history" ADD CONSTRAINT "FK_42be96b83b41ecbe8fb2c8313dd" FOREIGN KEY ("status_id") REFERENCES "ticket_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket" ADD CONSTRAINT "FK_a39055e902c270197f3711e0ee3" FOREIGN KEY ("status_id") REFERENCES "ticket_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_notification" ADD CONSTRAINT "FK_9360ebd65f766c667e8199cdea1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_notification" ADD CONSTRAINT "FK_7dad26e158290e1bf87d919f04c" FOREIGN KEY ("ticket_id") REFERENCES "ticket"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "ticket_notification" ADD CONSTRAINT "FK_4cb92ebbaa5722242954c09162e" FOREIGN KEY ("status_id") REFERENCES "ticket_status"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "ticket_notification" DROP CONSTRAINT "FK_4cb92ebbaa5722242954c09162e"`);
        await queryRunner.query(`ALTER TABLE "ticket_notification" DROP CONSTRAINT "FK_7dad26e158290e1bf87d919f04c"`);
        await queryRunner.query(`ALTER TABLE "ticket_notification" DROP CONSTRAINT "FK_9360ebd65f766c667e8199cdea1"`);
        await queryRunner.query(`ALTER TABLE "ticket" DROP CONSTRAINT "FK_a39055e902c270197f3711e0ee3"`);
        await queryRunner.query(`ALTER TABLE "ticket_status_history" DROP CONSTRAINT "FK_42be96b83b41ecbe8fb2c8313dd"`);
        await queryRunner.query(`DROP TABLE "ticket_notification"`);
        await queryRunner.query(`DROP TYPE "public"."ticket_notification_notification_type_enum"`);
    }

}
