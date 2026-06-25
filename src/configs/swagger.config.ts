import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env.config';

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BankReach — WhatsApp Campaign Management API',
      version: '1.0.0',
      description:
        'API documentation for the BankReach WhatsApp Campaign Management System. ' +
        'Used by bank employees to create, schedule, and send WhatsApp campaigns to customers.',
      contact: {
        name: 'BankReach Support',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}/api/v1`,
        description: 'Development Server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your JWT access token',
        },
      },
      schemas: {
        ApiResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'object' },
          },
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            data: { type: 'array', items: { type: 'object' } },
            meta: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
            errors: { type: 'array', items: { type: 'object' } },
          },
        },
      },
    },
    security: [{ BearerAuth: [] }],
  },
  apis: [
    './src/modules/*/routes.ts',
    './src/modules/*/*.routes.ts',
    './src/docs/*.ts',
  ],
};

export const swaggerSpec = swaggerJsdoc(swaggerOptions);
