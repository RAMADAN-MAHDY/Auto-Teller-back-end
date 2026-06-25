import { Router } from 'express';
import Container from 'typedi';
import { ReportController } from './report.controller';
import { authenticate } from '../../middlewares';
import { asyncHandler } from '../../common/utils';

const router = Router();
const controller = Container.get(ReportController);

router.use(authenticate);

/**
 * @openapi
 * /reports/dashboard:
 *   get:
 *     tags: [Reports]
 *     summary: Retrieve summary metrics for dashboard
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
router.get('/dashboard', asyncHandler(controller.getDashboardStats));

/**
 * @openapi
 * /reports/campaign-performance:
 *   get:
 *     tags: [Reports]
 *     summary: Retrieve performance metrics for active/completed campaigns
 *     responses:
 *       200:
 *         description: Campaign metrics list
 */
router.get('/campaign-performance', asyncHandler(controller.getCampaignPerformance));

export default router;
