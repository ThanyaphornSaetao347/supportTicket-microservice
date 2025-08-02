import { 
  Controller, 
  Post, 
  Get,
  Param,
  UploadedFiles, 
  UseInterceptors, 
  Body, 
  BadRequestException, 
  NotFoundException,
  Request, 
  UseGuards,
  Res,
  Delete
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { Response } from 'express';
import { TicketService } from '../ticket/ticket.service';
import { AttachmentService } from './ticket_attachment.service';
import { Users } from '../users/entities/user.entity';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from '../auth/jwt_auth.guard';

const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);

// เก็บ counter สำหรับแต่ละ ticket
const fileCounters = new Map<string, number>();

@Controller()
export class TicketAttachmentController {
  constructor(
    private readonly ticketService: TicketService,
    private readonly attachmentService: AttachmentService
  ) {}

  // ✅ แก้ไข endpoint เดิมให้รองรับไฟล์ทุกประเภท
  @Get('images/issue_attachment/:id')
  // @UseGuards(JwtAuthGuard)
  async getIssueAttachmentImage(
    @Param('id') id: number,
    @Res() res: Response
  ) {
    try {
      console.log(`📎 Getting issue attachment file with ID: ${id}`);
      
      // ✅ หา attachment record ใน database
      const attachment = await this.attachmentService.findById(id);
      
      if (!attachment) {
        console.log(`❌ Attachment ID ${id} not found in database`);
        throw new NotFoundException('Attachment not found');
      }
      
      console.log(`📄 Found attachment: ${JSON.stringify(attachment)}`);
      
      // ✅ สร้าง path ไปยังไฟล์ (ใช้ filename จาก database)
      const filePath = path.join(process.cwd(), 'uploads', 'issue_attachment', attachment.filename);
      console.log(`📁 Looking for file at: ${filePath}`);
      
      // ✅ ตรวจสอบว่าไฟล์มีอยู่จริง
      try {
        await stat(filePath);
        console.log(`✅ File found: ${filePath}`);
      } catch (error) {
        console.log(`❌ File not found: ${filePath}`);
        throw new NotFoundException('File not found on disk');
      }
      
      // ✅ อ่านไฟล์
      const fileBuffer = await readFile(filePath);
      console.log(`📖 File read successfully, size: ${fileBuffer.length} bytes`);
      
      // ✅ กำหนด Content-Type ตามประเภทไฟล์
      const contentTypes = {
        // Images
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        // Documents
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text files
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'rtf': 'application/rtf',
        // Archives
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed'
      };
      
      const extension = attachment.extension.toLowerCase();
      const contentType = contentTypes[extension] || 'application/octet-stream';
      
      // ✅ ตรวจสอบว่าเป็นไฟล์ที่ควรแสดง inline หรือ download
      const inlineExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'pdf', 'txt', 'json', 'xml'];
      const disposition = inlineExtensions.includes(extension) ? 'inline' : 'attachment';
      
      // ✅ ส่งไฟล์กลับ
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 ชั่วโมง
        'Content-Disposition': `${disposition}; filename="${attachment.filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Attachment-ID': id,
        'X-Ticket-ID': attachment.ticket_id,
        'X-File-Extension': extension
      });
      
      res.send(fileBuffer);
      console.log(`✅ File sent successfully for ID: ${id}, type: ${contentType}, disposition: ${disposition}`);
      
    } catch (error) {
      console.error(`💥 Error getting file ${id}:`, error.message);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new NotFoundException('File not found');
    }
  }

  // 🆕 เพิ่ม endpoint ใหม่สำหรับไฟล์ทุกประเภท
  @Get('files/issue_attachment/:id')
  // @UseGuards(JwtAuthGuard)
  async getIssueAttachmentFile(
    @Param('id') id: number,
    @Res() res: Response
  ) {
    try {
      console.log(`📎 Getting issue attachment file with ID: ${id}`);
      
      // ✅ หา attachment record ใน database
      const attachment = await this.attachmentService.findById(id);
      
      if (!attachment) {
        console.log(`❌ Attachment ID ${id} not found in database`);
        throw new NotFoundException('Attachment not found');
      }
      
      console.log(`📄 Found attachment: ${JSON.stringify(attachment)}`);
      
      // ✅ สร้าง path ไปยังไฟล์
      const filePath = path.join(process.cwd(), 'uploads', 'issue_attachment', attachment.filename);
      console.log(`📁 Looking for file at: ${filePath}`);
      
      // ✅ ตรวจสอบว่าไฟล์มีอยู่จริง
      try {
        await stat(filePath);
        console.log(`✅ File found: ${filePath}`);
      } catch (error) {
        console.log(`❌ File not found: ${filePath}`);
        throw new NotFoundException('File not found on disk');
      }
      
      // ✅ อ่านไฟล์
      const fileBuffer = await readFile(filePath);
      console.log(`📖 File read successfully, size: ${fileBuffer.length} bytes`);
      
      // ✅ กำหนด Content-Type ตามประเภทไฟล์
      const contentTypes = {
        // Images
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp',
        'tiff': 'image/tiff',
        // Documents
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text files
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'rtf': 'application/rtf',
        // Archives
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed'
      };
      
      const extension = attachment.extension.toLowerCase();
      const contentType = contentTypes[extension] || 'application/octet-stream';
      
      // ✅ ตรวจสอบว่าเป็นไฟล์ที่ควรแสดง inline หรือ download
      const inlineExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'pdf', 'txt', 'json', 'xml'];
      const disposition = inlineExtensions.includes(extension) ? 'inline' : 'attachment';
      
      // ✅ ส่งไฟล์กลับ
      res.set({
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600', // Cache 1 ชั่วโมง
        'Content-Disposition': `${disposition}; filename="${attachment.filename}"`,
        'Content-Length': fileBuffer.length.toString(),
        'X-Attachment-ID': id,
        'X-Ticket-ID': attachment.ticket_id,
        'X-File-Extension': extension
      });
      
      res.send(fileBuffer);
      console.log(`✅ File sent successfully for ID: ${id}, type: ${contentType}`);
      
    } catch (error) {
      console.error(`💥 Error getting file ${id}:`, error.message);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new NotFoundException('File not found');
    }
  }

  // 🆕 เพิ่ม endpoint สำหรับดาวน์โหลดไฟล์ (force download)
  @Get('download/issue_attachment/:id')
  // @UseGuards(JwtAuthGuard)
  async downloadIssueAttachment(
    @Param('id') id: number,
    @Res() res: Response
  ) {
    try {
      console.log(`⬇️ Downloading issue attachment with ID: ${id}`);
      
      // ✅ หา attachment record ใน database
      const attachment = await this.attachmentService.findById(id);
      
      if (!attachment) {
        console.log(`❌ Attachment ID ${id} not found in database`);
        throw new NotFoundException('Attachment not found');
      }
      
      console.log(`📄 Found attachment for download: ${JSON.stringify(attachment)}`);
      
      // ✅ สร้าง path ไปยังไฟล์
      const filePath = path.join(process.cwd(), 'uploads', 'issue_attachment', attachment.filename);
      console.log(`📁 Looking for file at: ${filePath}`);
      
      // ✅ ตรวจสอบว่าไฟล์มีอยู่จริง
      try {
        const stats = await stat(filePath);
        console.log(`✅ File found: ${filePath}, size: ${stats.size} bytes`);
        
        // ✅ ใช้ res.download() สำหรับการดาวน์โหลด
        res.download(filePath, attachment.filename, (err) => {
          if (err) {
            console.error(`❌ Download error for file ${id}:`, err);
            if (!res.headersSent) {
              throw new NotFoundException('File download failed');
            }
          } else {
            console.log(`✅ File downloaded successfully: ${attachment.filename}`);
          }
        });
        
      } catch (error) {
        console.log(`❌ File not found: ${filePath}`);
        throw new NotFoundException('File not found on disk');
      }
      
    } catch (error) {
      console.error(`💥 Error downloading file ${id}:`, error.message);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new NotFoundException('File not found');
    }
  }

  @Post('api/updateAttachment')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FilesInterceptor('files', 5, {
    storage: diskStorage({
      destination: './uploads/issue_attachment',
      filename: (req, file, cb) => {
        const ticket_id = req.body.ticket_id || '1';
        
        // ใช้ sequential numbering สำหรับแต่ละ ticket
        const currentCount = fileCounters.get(ticket_id) || 0;
        const nextCount = currentCount + 1;
        fileCounters.set(ticket_id, nextCount);
        
        const ext = extname(file.originalname);
        const tempFilename = `${ticket_id}_${nextCount}${ext}`;
        cb(null, tempFilename);
      },
    }),
    fileFilter: (req, file, cb) => {
      console.log('File being uploaded:', {
        fieldname: file.fieldname,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      });

      // รายการ MIME types ที่อนุญาต
      const allowedMimeTypes = [
        // Images
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/tiff',
        // Documents
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text files
        'text/plain',
        'text/csv',
        'application/json',
        // Archives
        'application/zip',
        'application/x-rar-compressed',
        'application/x-7z-compressed',
        'application/x-zip-compressed',
        // Other common formats
        'application/rtf',
        'application/xml',
        'text/xml'
      ];

      // ตรวจสอบ extension เพิ่มเติม (เพื่อความแน่ใจ)
      const allowedExtensions = [
        '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.tiff',
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
        '.txt', '.csv', '.json', '.xml', '.rtf',
        '.zip', '.rar', '.7z'
      ];

      const fileExtension = extname(file.originalname).toLowerCase();
      
      if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
        cb(null, true);
      } else {
        console.log('File type not allowed:', {
          mimetype: file.mimetype,
          extension: fileExtension,
          filename: file.originalname
        });
        
        return cb(
          new BadRequestException(
            `File type '${file.mimetype}' with extension '${fileExtension}' is not allowed. ` +
            `Allowed types: images, PDF, Word, Excel, PowerPoint, text files, and archives.`
          ), 
          false
        );
      }
    },
    limits: {
      fileSize: 10 * 1024 * 1024, // เพิ่มเป็น 10MB
    }
  }))
  async updateAttachment(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('ticket_id') ticket_id: string,
    @Body('project_id') project_id: string,
    @Body('categories_id') categories_id: string,
    @Body('issue_description') issue_description: string,
    @Body('type') type: string = 'reporter',
    @Request() req: any
  ) {
    try {
      // ตรวจสอบว่ามีไฟล์หรือไม่
      if (!files || files.length === 0) {
        throw new BadRequestException('No files uploaded');
      }

      // ตรวจสอบ ticket_id
      if (!ticket_id) {
        throw new BadRequestException('ticket_id is required');
      }

      const uploadedFiles: any[] = [];
      const errors: any[] = [];

      // Process แต่ละไฟล์
      for (const file of files) {
        try {
          // ประมวลผลไฟล์
          const processedFile = await this.processImage(file);
          
          // เรียกใช้ AttachmentService ตามที่ต้องการ
          const attachment = await this.attachmentService.create({
            ticket_id: parseInt(ticket_id), // แปลงเป็น number
            type,
            file: file, // ส่ง Express.Multer.File object ตรงๆ
            create_by: req.user.id
          });

          // เก็บข้อมูลเพิ่มเติม (project_id, category_id, issue_description) ไว้ใช้ต่อ
          if (project_id || categories_id || issue_description) {
            console.log('Additional data to process:', { 
              project_id, 
              categories_id, 
              issue_description,
              attachment_id: attachment.id 
            });
            // สามารถเพิ่ม logic เพื่อบันทึกข้อมูลเพิ่มเติมในตารางอื่นได้ที่นี่
          }

          uploadedFiles.push({
            id: attachment.id,
            filename: attachment.filename, // ใช้ filename จาก database
            original_name: file.originalname,
            file_size: processedFile.size,
            file_url: `/images/issue_attachment/${attachment.id}`, // ✅ ใช้ endpoint เดิม
            extension: attachment.extension
          });

          // ลบไฟล์ temp ถ้าจำเป็น
          if (file.filename !== processedFile.filename) {
            await this.deleteFile(file.path);
          }

        } catch (error) {
          console.error('File processing error:', error);
          
          // ลบไฟล์ที่ upload ไว้แล้วถ้าเกิดข้อผิดพลาด
          if (file.path) {
            await this.deleteFile(file.path);
          }
          
          errors.push({
            filename: file.originalname,
            error: error.message
          });
        }
      }

      // ส่งผลลัพธ์
      const response = {
        success: uploadedFiles.length > 0,
        message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
        data: {
          uploaded_files: uploadedFiles,
          total_uploaded: uploadedFiles.length,
          total_files: files.length,
          errors: errors.length > 0 ? errors : undefined
        }
      };

      if (errors.length === 0) {
        return response;
      }
      
      if (uploadedFiles.length > 0) {
        return {
          ...response,
          message: `Uploaded ${uploadedFiles.length}/${files.length} files with some errors`
        };
      }
      
      throw new BadRequestException({
        message: 'Failed to upload any files',
        errors: errors
      });

    } catch (error) {
      console.error('Upload error:', error);
      
      // ทำความสะอาดไฟล์ที่อัปโหลดไว้แล้วถ้าเกิดข้อผิดพลาด
      if (files && files.length > 0) {
        for (const file of files) {
          if (file.path) {
            await this.deleteFile(file.path);
          }
        }
      }
      throw error;
    }
  }

  // Helper methods
  private async deleteFile(filePath: string): Promise<void> {
    try {
      const fs = require('fs').promises;
      await fs.unlink(filePath);
    } catch (error) {
      console.error('Failed to delete file:', filePath, error);
    }
  }

  private async processImage(file: Express.Multer.File): Promise<{
    filename: string;
    path: string;
    size: number;
  }> {
    return {
      filename: file.filename,
      path: file.path,
      size: file.size
    };
  }

  @Delete('api/images/issue_attachment/:id')
  @UseGuards(JwtAuthGuard)
  async deleteAttachment(
    @Param('id') id: number,
    @Request() req: any
  ) {
    const userId = req.user?.id;
    return this.attachmentService.deleteAttachment(Number(id), userId);
  }
}
