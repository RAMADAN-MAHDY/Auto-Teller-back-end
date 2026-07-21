import { Router } from 'express';
import Container from 'typedi';
import { CustomerController } from './customer.controller';
import { authenticate, validate, authorize } from '../../middlewares';
import { createCustomerSchema, updateCustomerSchema, customerQuerySchema } from './customer.dto';
import { asyncHandler } from '../../common/utils';
import { UserRole } from '../../common/constants';
import multer from 'multer';

const router = Router();
const controller = Container.get(CustomerController);
const upload = multer({ storage: multer.memoryStorage() });

router.use(authenticate);

/**
 * @openapi
 * /customers:
 *   post:
 *     tags: [Customers]
 *     summary: Create a new customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fullName, phoneNumber, dueDate, importedOverdueDays]
 *             properties:
 *               fullName: { type: string }
 *               phoneNumber: { type: string, example: "+966501234567" }
 *               guarantorName: { type: string }
 *               guarantorPhone: { type: string, example: "+966501234567" }
 *               dueDate: { type: string, format: date-time }
 *               importedOverdueDays: { type: number }
 *               notes: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       201:
 *         description: Customer created
 *       409:
 *         description: Phone number already exists
 */
router.post('/', validate(createCustomerSchema), asyncHandler(controller.create));

/**
 * @openapi
 * /customers/import-excel:
 *   post:
 *     tags: [Customers]
 *     summary: Import customers from an Excel file
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel file (.xlsx or .csv) containing customer data
 *     responses:
 *       200:
 *         description: Customer import process completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 imported: { type: number }
 *                 updated: { type: number }
 *                 failed: { type: number }
 *                 errors: { type: array, items: { type: string } }
 *       400:
 *         description: No file uploaded or error processing file
 */
router.post('/import-excel', upload.single('file'), asyncHandler(controller.import));

/**
 * @openapi
 * /customers:
 *   get:
 *     tags: [Customers]
 *     summary: Get all customers (with search, filter, pagination)
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by name
 *       - in: query
 *         name: customerGroup
 *         schema:
 *           type: string
 *           enum: [COMPLIANT, LATE, DEFAULTED, TRANSFERRED]
 *       - in: query
 *         name: tag
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customers list
 */
router.get('/', validate(customerQuerySchema, 'query'), asyncHandler(controller.findAll));

/**
 * @openapi
 * /customers/{id}:
 *   get:
 *     tags: [Customers]
 *     summary: Get a customer by ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Customer details
 *       404:
 *         description: Not found
 */
router.get('/:id', asyncHandler(controller.findById));

/**
 * @openapi
 * /customers/{id}:
 *   patch:
 *     tags: [Customers]
 *     summary: Update a customer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName: { type: string }
 *               phoneNumber: { type: string, example: "+966501234567" }
 *               guarantorName: { type: string }
 *               guarantorPhone: { type: string, example: "+966501234567" }
 *               dueDate: { type: string, format: date-time }
 *               importedOverdueDays: { type: number }
 *               notes: { type: string }
 *               tags: { type: array, items: { type: string } }
 *     responses:
 *       200:
 *         description: Customer updated
 */
router.patch('/:id', validate(updateCustomerSchema), asyncHandler(controller.update));

/**
 * @openapi
 * /customers:
 *   delete:
 *     tags: [Customers]
 *     summary: Delete all customers (Admin only)
 *     responses:
 *       200:
 *         description: All customers deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 deletedCount: { type: number }
 *       403:
 *         description: Forbidden - Admin only
 */
router.delete('/', asyncHandler(controller.deleteAll));

/**
 * @openapi
 * /customers/{id}:
 *   delete:
 *     tags: [Customers]
 *     summary: Delete a customer
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       204:
 *         description: Customer deleted
 */
router.delete('/:id', asyncHandler(controller.delete));

export default router;
