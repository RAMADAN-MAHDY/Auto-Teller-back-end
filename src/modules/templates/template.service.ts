import Container, { Service } from 'typedi';
import { FilterQuery } from 'mongoose';
import { TemplateRepository } from './template.repository';
import { CreateTemplateDto, UpdateTemplateDto, TemplateQueryDto, TemplateResponseDto } from './template.dto';
import { ConflictException, NotFoundException } from '../../common/exceptions';
import { IPaginatedResult } from '../../common/interfaces';
import { ITemplate } from './template.model';
import { extractVariables } from '../../common/utils/template-engine';
import { logger } from '../../logger';

@Service()
export class TemplateService {
  private readonly templateRepository = Container.get(TemplateRepository);

  async create(dto: CreateTemplateDto, userId: string): Promise<TemplateResponseDto> {
    const existing = await this.templateRepository.findByName(dto.name);
    if (existing) {
      throw new ConflictException('A template with this name already exists');
    }

    const variables = extractVariables(dto.body);

    const template = await this.templateRepository.create({
      ...dto,
      variables,
      createdBy: userId,
    } as any);

    logger.info(`Template created: ${template.name} by User: ${userId}`);
    return this.toResponseDto(template);
  }

  async findAll(query: TemplateQueryDto): Promise<IPaginatedResult<TemplateResponseDto>> {
    const filter: FilterQuery<ITemplate> = {};

    if (query.search) {
      filter.name = { $regex: query.search, $options: 'i' };
    }

    const result = await this.templateRepository.findPaginated(filter, {
      page: query.page,
      limit: query.limit,
      sort: query.sort,
      order: query.order,
    }, { path: 'createdBy', select: 'fullName email' });

    return {
      data: result.data.map(this.toResponseDto),
      meta: result.meta,
    };
  }

  async findById(id: string): Promise<TemplateResponseDto> {
    const template = await this.templateRepository.findById(id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    // Populate createdBy
    await template.populate('createdBy', 'fullName email');
    return this.toResponseDto(template);
  }

  async update(id: string, dto: UpdateTemplateDto): Promise<TemplateResponseDto> {
    if (dto.name) {
      const existing = await this.templateRepository.findByName(dto.name);
      if (existing && existing.id !== id) {
        throw new ConflictException('A template with this name already exists');
      }
    }

    const updateData: Partial<ITemplate> & { variables?: string[] } = { ...dto };
    if (dto.body) {
      updateData.variables = extractVariables(dto.body);
    }

    const template = await this.templateRepository.updateById(id, updateData);
    if (!template) {
      throw new NotFoundException('Template not found');
    }

    await template.populate('createdBy', 'fullName email');
    logger.info(`Template updated: ${template.name}`);
    return this.toResponseDto(template);
  }

  async delete(id: string): Promise<void> {
    const template = await this.templateRepository.deleteById(id);
    if (!template) {
      throw new NotFoundException('Template not found');
    }
    logger.info(`Template deleted: ${template.name}`);
  }

  private toResponseDto(template: ITemplate): TemplateResponseDto {
    const creator = template.createdBy as any;
    return {
      id: template.id,
      name: template.name,
      body: template.body,
      variables: template.variables,
      createdBy: creator && typeof creator === 'object' && creator.fullName
        ? { id: creator.id || creator._id?.toString(), fullName: creator.fullName }
        : template.createdBy?.toString(),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
