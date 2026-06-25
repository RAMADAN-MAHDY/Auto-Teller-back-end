import Container, { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { CampaignRepository } from './campaign.repository';
import { CreateCampaignDto, UpdateCampaignDto, CampaignQueryDto, CampaignResponseDto } from './campaign.dto';
import { BadRequestException, NotFoundException } from '../../common/exceptions';
import { IPaginatedResult } from '../../common/interfaces';
import { ICampaign } from './campaign.model';
import { CampaignStatus, CustomerGroup } from '../../common/constants';
import { QueueService } from '../../queues/queue.service';
import { logger } from '../../logger';

@Service()
export class CampaignService {
  private readonly campaignRepository = Container.get(CampaignRepository);
  private readonly queueService = Container.get(QueueService);

  async create(dto: CreateCampaignDto, userId: string): Promise<CampaignResponseDto> {
    const status = dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT;

    const campaign = await this.campaignRepository.create({
      title: dto.title,
      templateId: dto.templateId,
      targetCustomerGroup: dto.targetCustomerGroup,
      scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
      status,
      createdBy: userId,
    } as any);

    logger.info(`Campaign created: ${campaign.title} [Status: ${status}] by User: ${userId}`);

    // If scheduled for the past or now, trigger immediately
    if (campaign.status === CampaignStatus.SCHEDULED && campaign.scheduledAt && campaign.scheduledAt <= new Date()) {
      await this.trigger(campaign.id);
    }

    const populated = await this.campaignRepository.findByIdPopulated(campaign.id);
    return this.toResponseDto(populated!);
  }

  async findAll(query: CampaignQueryDto): Promise<IPaginatedResult<CampaignResponseDto>> {
    const filter: FilterQuery<ICampaign> = {};

    if (query.status) {
      filter.status = query.status;
    }
    if (query.search) {
      filter.title = { $regex: query.search, $options: 'i' };
    }
    if (query.targetCustomerGroup) {
      filter.targetCustomerGroup = query.targetCustomerGroup;
    }

    const { data, total } = await this.campaignRepository.findAllPopulated(
      filter,
      query.page,
      query.limit,
    );

    const pages = Math.ceil(total / query.limit);

    return {
      data: data.map(this.toResponseDto),
      meta: {
        total,
        page: query.page,
        limit: query.limit,
        totalPages: pages,
        hasNextPage: query.page < pages,
        hasPrevPage: query.page > 1,
      },
    };
  }

  async findById(id: string): Promise<CampaignResponseDto> {
    const campaign = await this.campaignRepository.findByIdPopulated(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.toResponseDto(campaign);
  }

  async update(id: string, dto: UpdateCampaignDto): Promise<CampaignResponseDto> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException(`Cannot update campaign with status: ${campaign.status}`);
    }

    const updateData: Partial<ICampaign> = { ...dto } as any;
    if (dto.scheduledAt !== undefined) {
      updateData.scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
      updateData.status = dto.scheduledAt ? CampaignStatus.SCHEDULED : CampaignStatus.DRAFT;
    }

    const updated = await this.campaignRepository.updateById(id, updateData);
    logger.info(`Campaign updated: ${updated?.title}`);

    const populated = await this.campaignRepository.findByIdPopulated(id);
    return this.toResponseDto(populated!);
  }

  async trigger(id: string): Promise<CampaignResponseDto> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.SCHEDULED) {
      throw new BadRequestException(`Campaign cannot be triggered in status: ${campaign.status}`);
    }

    await this.campaignRepository.updateStatus(id, CampaignStatus.RUNNING);
    await this.queueService.queueCampaign(id);

    logger.info(`Campaign triggered manually: ${campaign.title}`);
    const populated = await this.campaignRepository.findByIdPopulated(id);
    return this.toResponseDto(populated!);
  }

  async delete(id: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(id);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    if (campaign.status !== CampaignStatus.DRAFT) {
      throw new BadRequestException('Only DRAFT campaigns can be deleted');
    }

    await this.campaignRepository.deleteById(id);
    logger.info(`Campaign deleted: ${campaign.title}`);
  }

  private toResponseDto(campaign: ICampaign): CampaignResponseDto {
    const template = campaign.templateId as any;

    return {
      id: campaign.id,
      title: campaign.title,
      template: {
        id: template?.id || template?._id?.toString() || '',
        name: template?.name || '',
      },
      targetCustomerGroup: campaign.targetCustomerGroup,
      status: campaign.status,
      scheduledAt: campaign.scheduledAt,
      completedAt: campaign.completedAt,
      createdBy: {
        id: (campaign.createdBy as any)?.id || (campaign.createdBy as any)?._id?.toString() || '',
        fullName: (campaign.createdBy as any)?.fullName || (campaign.createdBy as any)?.name || '',
      },
      stats: campaign.stats,
      createdAt: campaign.createdAt,
      updatedAt: campaign.updatedAt,
    };
  }
}
